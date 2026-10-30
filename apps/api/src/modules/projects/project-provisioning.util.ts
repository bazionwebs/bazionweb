import { Logger } from '@nestjs/common';

const logger = new Logger('ProjectProvisioning');

export interface ProvisionableInvoice {
  id: string;
  clientId: string;
  invoiceNumber?: string;
  amount: unknown;
  currency: string;
  paidAt?: Date | string | null;
  notes?: string | null;
  lineItems?: unknown;
}

function extractProposalCode(invoice: ProvisionableInvoice): string | null {
  if (typeof invoice.notes === 'string') {
    const match = /proposal\s+(BZ-[A-Z0-9-]+)/i.exec(invoice.notes);
    if (match?.[1]) return match[1].toUpperCase();
  }
  if (Array.isArray(invoice.lineItems)) {
    for (const item of invoice.lineItems) {
      const desc = typeof (item as Record<string, unknown>)?.description === 'string'
        ? String((item as Record<string, unknown>).description)
        : '';
      const match = /\b(BZ-[A-Z0-9]{2,}-\d{4}-[A-Z0-9]+)\b/i.exec(desc);
      if (match?.[1]) return match[1].toUpperCase();
    }
  }
  return null;
}

function humanizeSlug(slug: string): string {
  return slug
    .replace(/^(addon|website|ecommerce|care|host)-/i, '')
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
    .join(' ');
}

/**
 * Idempotently provisions a client Project + 5-milestone ProjectTask roadmap
 * whenever a proposal kickoff deposit invoice is settled.
 */
export async function provisionProjectFromProposalInvoice(
  db: any,
  invoice: ProvisionableInvoice,
): Promise<{ project: any; created: boolean } | null> {
  const proposalCode = extractProposalCode(invoice);
  if (!proposalCode) return null;

  const existing = await db.project.findFirst({
    where: {
      clientId: invoice.clientId,
      deletedAt: null,
      OR: [
        { name: { contains: proposalCode, mode: 'insensitive' } },
        { description: { contains: proposalCode, mode: 'insensitive' } },
      ],
    },
    include: { tasks: { orderBy: { sortOrder: 'asc' } } },
  });

  if (existing) {
    return { project: existing, created: false };
  }

  const proposal = await db.proposal.findUnique({
    where: { proposalCode },
  });

  const rawItems = Array.isArray(proposal?.lineItems)
    ? (proposal.lineItems as Array<Record<string, any>>)
    : [];

  const packageItem = rawItems.find((i) => i?.kind === 'package');
  const packageName =
    typeof packageItem?.name === 'string' && packageItem.name.trim()
      ? packageItem.name.trim()
      : typeof packageItem?.productId === 'string'
        ? humanizeSlug(packageItem.productId)
        : 'Custom Web Build';

  const addOnNames = rawItems
    .filter((i) => i?.kind === 'add-on')
    .map((i) =>
      typeof i?.name === 'string' && i.name.trim()
        ? i.name.trim()
        : typeof i?.productId === 'string'
          ? humanizeSlug(i.productId)
          : null,
    )
    .filter((v): v is string => Boolean(v));

  const extraPages = Number(rawItems.find((i) => i?.kind === 'extra-pages')?.quantity || 0);
  const isRush = rawItems.some((i) => i?.kind === 'rush-delivery');

  const startDate = invoice.paidAt ? new Date(invoice.paidAt) : new Date();
  const totalDays = isRush ? 14 : 28;
  const addDays = (days: number) => new Date(startDate.getTime() + days * 86_400_000);
  const dueDate = addDays(totalDays);

  const depositAmt = Number(invoice.amount || 0);
  const proposalTotal = proposal ? Number(proposal.totalAmount || 0) : depositAmt * 2;
  const remainingAmt = Math.max(0, Math.round((proposalTotal - depositAmt) * 100) / 100);

  const scopeParts = [
    packageName,
    extraPages > 0 ? `${extraPages} extra page${extraPages === 1 ? '' : 's'}` : null,
    addOnNames.length > 0 ? `Add-ons: ${addOnNames.join(', ')}` : null,
    isRush ? 'Rush Delivery Track' : null,
  ].filter(Boolean);

  const description = [
    `Provisioned from accepted proposal ${proposalCode}.`,
    `Scope: ${scopeParts.join(' · ')}.`,
    `Kickoff deposit settled (${invoice.currency} ${depositAmt.toLocaleString()})`,
    remainingAmt > 0
      ? `— launch milestone balance: ${invoice.currency} ${remainingAmt.toLocaleString()} due at staging sign-off.`
      : '— paid in full.',
  ].join(' ');

  const projectName = `${packageName} — ${proposalCode}`;

  const project = await db.project.create({
    data: {
      clientId: invoice.clientId,
      name: projectName,
      description,
      status: 'IN_PROGRESS',
      completionPct: 20,
      startDate,
      dueDate,
      tasks: {
        create: [
          {
            title: 'Kickoff Deposit & Architecture Discovery',
            description: `Proposal ${proposalCode} locked, kickoff settlement verified, and engineering workspace provisioned.`,
            status: 'DONE',
            priority: 'HIGH',
            sortOrder: 1,
            dueDate: startDate,
            completedAt: startDate,
          },
          {
            title: 'Information Architecture & UI/UX Wireframes',
            description: 'Brand direction, conversion user flows, responsive layout system, and interactive design sign-off.',
            status: 'IN_PROGRESS',
            priority: 'HIGH',
            sortOrder: 2,
            dueDate: addDays(isRush ? 3 : 7),
          },
          {
            title: 'Core Full-Stack Engineering & Content Integration',
            description:
              addOnNames.length > 0
                ? `Production Next.js/API build integrating scoped capabilities: ${addOnNames.join(', ')}.`
                : 'Responsive frontend engineering, CMS/API integration, technical SEO schema, and copy population.',
            status: 'TODO',
            priority: 'HIGH',
            sortOrder: 3,
            dueDate: addDays(isRush ? 8 : 16),
          },
          {
            title: 'Staging Preview, Security Audit & Client Review',
            description: 'Cross-device QA, Core Web Vitals tuning, OWASP security headers verification, and staging walkthrough.',
            status: 'TODO',
            priority: 'MEDIUM',
            sortOrder: 4,
            dueDate: addDays(isRush ? 11 : 23),
          },
          {
            title: 'Production DNS Cutover & Sovereign Handover',
            description: 'Zero-downtime domain DNS cutover, TLS certificate issuance, analytics verification, and repository handover.',
            status: 'TODO',
            priority: 'CRITICAL',
            sortOrder: 5,
            dueDate,
          },
        ],
      },
    },
    include: {
      client: { select: { businessName: true, userId: true } },
      tasks: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { tasks: true } },
    },
  });

  if (project.client?.userId) {
    await db.notification
      .create({
        data: {
          userId: project.client.userId,
          type: 'SYSTEM',
          title: 'Delivery Roadmap Provisioned',
          message: `${projectName} is active. Track sprint milestones and deliverables in your workspace.`,
          actionUrl: '/portal/milestones',
          metadata: { projectId: project.id, proposalCode },
        },
      })
      .catch((err: Error) => logger.warn(`Project notification skipped: ${err.message}`));
  }

  logger.log(`Provisioned project "${projectName}" (${project.id}) for client ${invoice.clientId}`);
  return { project, created: true };
}

