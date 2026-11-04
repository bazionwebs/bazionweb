import { BadRequestException } from '@nestjs/common';

export type EmailProviderType =
  | 'CLOUDFLARE_EMAIL_ROUTING'
  | 'ZOHO_MAIL'
  | 'MXROUTE'
  | 'GOOGLE_WORKSPACE'
  | 'MICROSOFT_365';

export interface EmailDnsRecordMx {
  host: string;
  priority: number;
  ttl: number;
}

export interface EmailDnsRecordTxt {
  type: 'TXT';
  name: string;
  value: string;
  ttl: number;
}

export interface EmailDnsRecordDkim {
  type: 'CNAME' | 'TXT';
  name: string;
  target: string;
  ttl: number;
}

export interface EmailDnsConfig {
  provider: EmailProviderType;
  domain: string;
  plan: string;
  maxInboxes: number;
  mxRecords: EmailDnsRecordMx[];
  spfRecord: EmailDnsRecordTxt;
  dkimRecords: EmailDnsRecordDkim[];
  dmarcRecord: EmailDnsRecordTxt;
  aliases: string[];
  instructions: string[];
}

export const TIER_MAILBOX_LIMITS: Record<string, number> = {
  'host-essential': 0,
  'host-business': 5,
  'host-pro': 10,
  'host-professional': 10,
  'host-cloud': Number.POSITIVE_INFINITY,
  'managed-cloud': Number.POSITIVE_INFINITY,
};

export const DEFAULT_BUSINESS_ALIASES = ['info', 'sales', 'billing', 'support', 'admin'];

export class EmailRoutingHelper {
  /**
   * Normalizes domain name by stripping protocols, paths, ports, and trailing dots.
   */
  static normalizeDomain(domain: string): string {
    if (!domain || typeof domain !== 'string') {
      throw new BadRequestException('A valid domain name is required for email routing configuration.');
    }
    let clean = domain.trim().toLowerCase();
    clean = clean.replace(/^[a-z]+:\/\//i, '');
    clean = clean.split('/')[0];
    clean = clean.split(':')[0];
    clean = clean.replace(/\.+$/, '');

    const fqdnRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
    if (!fqdnRegex.test(clean) || clean.length > 253) {
      throw new BadRequestException(`Invalid domain format for email configuration: "${domain}"`);
    }
    return clean;
  }

  /**
   * Normalizes email alias local part and deduplicates.
   */
  static normalizeAliases(aliases: string[] = [], domain: string): string[] {
    const cleanDomain = `@${domain.toLowerCase()}`;
    const normalizedSet = new Set<string>();

    for (const raw of aliases) {
      if (!raw || typeof raw !== 'string') continue;
      let localPart = raw.trim().toLowerCase();
      if (localPart.endsWith(cleanDomain)) {
        localPart = localPart.slice(0, -cleanDomain.length);
      }
      localPart = localPart.replace(/^@+/, '');

      const aliasRegex = /^[a-z0-9][a-z0-9._%+-]{0,63}$/;
      if (!aliasRegex.test(localPart)) {
        throw new BadRequestException(`Invalid email alias format: "${raw}"`);
      }
      normalizedSet.add(localPart);
    }

    return Array.from(normalizedSet);
  }

  /**
   * Normalizes provider string to canonical EmailProviderType enum.
   */
  static normalizeProvider(provider?: string): EmailProviderType {
    if (!provider) return 'CLOUDFLARE_EMAIL_ROUTING';
    const p = provider.trim().toUpperCase().replace(/[-\s]/g, '_');
    if (p.includes('CLOUDFLARE')) return 'CLOUDFLARE_EMAIL_ROUTING';
    if (p.includes('ZOHO')) return 'ZOHO_MAIL';
    if (p.includes('MXROUTE')) return 'MXROUTE';
    if (p.includes('GOOGLE') || p.includes('GSUITE') || p.includes('WORKSPACE')) return 'GOOGLE_WORKSPACE';
    if (p.includes('MICROSOFT') || p.includes('O365') || p.includes('OFFICE365')) return 'MICROSOFT_365';
    return 'CLOUDFLARE_EMAIL_ROUTING';
  }

  /**
   * Resolves maximum allowable inboxes for a given hosting tier.
   */
  static getMaxInboxesForTier(plan: string): number {
    const canonical = plan.toLowerCase().trim();
    if (canonical in TIER_MAILBOX_LIMITS) {
      return TIER_MAILBOX_LIMITS[canonical];
    }
    if (canonical.includes('essential') || canonical.includes('starter')) return 0;
    if (canonical.includes('business') || canonical.includes('growth')) return 5;
    if (canonical.includes('pro') || canonical.includes('scale')) return 10;
    if (canonical.includes('cloud') || canonical.includes('enterprise') || canonical.includes('managed')) {
      return Number.POSITIVE_INFINITY;
    }
    return 0;
  }

  /**
   * Merges SPF records into a single RFC 7208 compliant TXT record.
   */
  static mergeSpf(existingSpf: string | undefined, includeMechanism: string): string {
    if (!existingSpf || !existingSpf.startsWith('v=spf1')) {
      return `v=spf1 ${includeMechanism} ~all`;
    }
    if (existingSpf.includes(includeMechanism)) {
      return existingSpf;
    }
    const cleanSpf = existingSpf.replace(/~all|\-all|\?all|\+all/g, '').trim();
    return `${cleanSpf} ${includeMechanism} ~all`;
  }

  /**
   * Generates deterministic DNS record set for external corporate email routing.
   */
  static generateEmailDnsRecords(
    rawDomain: string,
    rawProvider: string = 'CLOUDFLARE_EMAIL_ROUTING',
    customAliases?: string[],
    plan: string = 'host-business',
  ): EmailDnsConfig {
    const domain = this.normalizeDomain(rawDomain);
    const provider = this.normalizeProvider(rawProvider);
    const maxInboxes = this.getMaxInboxesForTier(plan);

    // Enforce mailbox boundaries
    let aliases: string[] = [];
    if (customAliases && customAliases.length > 0) {
      aliases = this.normalizeAliases(customAliases, domain);
    } else if (maxInboxes > 0 && maxInboxes !== Number.POSITIVE_INFINITY) {
      aliases = DEFAULT_BUSINESS_ALIASES.slice(0, Math.min(DEFAULT_BUSINESS_ALIASES.length, maxInboxes));
    } else if (maxInboxes === Number.POSITIVE_INFINITY) {
      aliases = [...DEFAULT_BUSINESS_ALIASES];
    }

    if (maxInboxes === 0 && aliases.length > 0) {
      throw new BadRequestException(
        `Host Essential plan does not include custom corporate email inboxes (transactional email only). ` +
        `Upgrade to Host Business for up to 5 corporate inboxes.`,
      );
    }

    if (aliases.length > maxInboxes) {
      throw new BadRequestException(
        `Plan "${plan}" allows a maximum of ${maxInboxes} corporate inboxes. ` +
        `Received ${aliases.length} aliases (${aliases.join(', ')}). ` +
        `Upgrade to a higher hosting tier to configure additional mailboxes.`,
      );
    }

    const dmarcRecord: EmailDnsRecordTxt = {
      type: 'TXT',
      name: '_dmarc',
      value: `v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@bazionweb.com; aspf=r; adkim=r`,
      ttl: 3600,
    };

    let mxRecords: EmailDnsRecordMx[] = [];
    let spfRecord: EmailDnsRecordTxt;
    let dkimRecords: EmailDnsRecordDkim[] = [];
    let instructions: string[] = [];

    switch (provider) {
      case 'CLOUDFLARE_EMAIL_ROUTING':
        mxRecords = [
          { host: 'route1.mx.cloudflare.net', priority: 14, ttl: 3600 },
          { host: 'route2.mx.cloudflare.net', priority: 28, ttl: 3600 },
          { host: 'route3.mx.cloudflare.net', priority: 89, ttl: 3600 },
        ];
        spfRecord = {
          type: 'TXT',
          name: '@',
          value: 'v=spf1 include:_spf.mx.cloudflare.net ~all',
          ttl: 3600,
        };
        dkimRecords = [
          {
            type: 'TXT',
            name: 'cf._domainkey',
            target: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC0...',
            ttl: 3600,
          },
        ];
        instructions = [
          `1. Add Cloudflare Email Routing MX records to your domain's DNS.`,
          `2. Add the SPF TXT record allowing _spf.mx.cloudflare.net.`,
          `3. Configure forwarding rules in Cloudflare Email Routing dashboard for aliases: ${aliases.map((a) => `${a}@${domain}`).join(', ')}.`,
          `4. For outbound sending, configure your mail client with authenticated SMTP relay (e.g. Resend, Brevo, or Gmail Send-As).`,
        ];
        break;

      case 'ZOHO_MAIL':
        mxRecords = [
          { host: 'mx.zoho.com', priority: 10, ttl: 3600 },
          { host: 'mx2.zoho.com', priority: 20, ttl: 3600 },
          { host: 'mx3.zoho.com', priority: 50, ttl: 3600 },
        ];
        spfRecord = {
          type: 'TXT',
          name: '@',
          value: 'v=spf1 include:zoho.com ~all',
          ttl: 3600,
        };
        dkimRecords = [
          {
            type: 'TXT',
            name: 'zoho._domainkey',
            target: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDr...',
            ttl: 3600,
          },
        ];
        instructions = [
          `1. Point MX records to mx.zoho.com (10), mx2.zoho.com (20), mx3.zoho.com (50).`,
          `2. Add Zoho SPF record: v=spf1 include:zoho.com ~all.`,
          `3. Create up to ${maxInboxes} mailboxes in the Zoho Mail admin console for: ${aliases.map((a) => `${a}@${domain}`).join(', ')}.`,
        ];
        break;

      case 'MXROUTE':
        mxRecords = [
          { host: 'route.mxroute.com', priority: 10, ttl: 3600 },
          { host: 'route-fallback.mxroute.com', priority: 20, ttl: 3600 },
        ];
        spfRecord = {
          type: 'TXT',
          name: '@',
          value: 'v=spf1 include:mxroute.com ~all',
          ttl: 3600,
        };
        dkimRecords = [
          {
            type: 'TXT',
            name: 'x._domainkey',
            target: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...',
            ttl: 3600,
          },
        ];
        instructions = [
          `1. Point MX records to route.mxroute.com (10) and route-fallback.mxroute.com (20).`,
          `2. Add MXroute SPF record: v=spf1 include:mxroute.com ~all.`,
          `3. Create user inboxes on the MXroute DirectAdmin panel.`,
        ];
        break;

      case 'GOOGLE_WORKSPACE':
        mxRecords = [
          { host: 'smtp.google.com', priority: 1, ttl: 3600 },
        ];
        spfRecord = {
          type: 'TXT',
          name: '@',
          value: 'v=spf1 include:_spf.google.com ~all',
          ttl: 3600,
        };
        dkimRecords = [
          {
            type: 'TXT',
            name: 'google._domainkey',
            target: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...',
            ttl: 3600,
          },
        ];
        instructions = [
          `1. Add Google Workspace MX record smtp.google.com (priority 1).`,
          `2. Add Google SPF record: v=spf1 include:_spf.google.com ~all.`,
        ];
        break;

      case 'MICROSOFT_365': {
        const domainSlug = domain.replace(/\./g, '-');
        mxRecords = [
          { host: `${domainSlug}.mail.protection.outlook.com`, priority: 0, ttl: 3600 },
        ];
        spfRecord = {
          type: 'TXT',
          name: '@',
          value: 'v=spf1 include:spf.protection.outlook.com ~all',
          ttl: 3600,
        };
        dkimRecords = [
          {
            type: 'CNAME',
            name: 'selector1._domainkey',
            target: `selector1-${domainSlug}._domainkey.tenant.onmicrosoft.com`,
            ttl: 3600,
          },
        ];
        instructions = [
          `1. Add Microsoft 365 MX record pointing to ${domainSlug}.mail.protection.outlook.com (0).`,
          `2. Add SPF record include:spf.protection.outlook.com.`,
        ];
        break;
      }
    }

    return {
      provider,
      domain,
      plan,
      maxInboxes,
      mxRecords,
      spfRecord,
      dkimRecords,
      dmarcRecord,
      aliases,
      instructions,
    };
  }
}
