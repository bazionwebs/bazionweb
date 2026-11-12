import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type HostingCutoverClassification =
  | 'linked'
  | 'linked_projection_missing'
  | 'linked_client_mismatch'
  | 'linked_domain_mismatch'
  | 'linked_domain_collision'
  | 'linked_ambiguous_claims'
  | 'ready_to_map'
  | 'ambiguous_platform_claims'
  | 'domain_claimed_by_other_client'
  | 'platform_claim_not_ready'
  | 'legacy_only';

export interface HostingCutoverItem {
  hostingAccountId: string;
  clientId: string;
  domain: string;
  hostingStatus: string;
  platformDeploymentId: string | null;
  platformProjectionStatus: string | null;
  domainClaimCount: number;
  clientDomainClaimCount: number;
  domainClaimConflict: boolean;
  candidatePlatformDeploymentId: string | null;
  platformClaimStatuses: string[];
  classification: HostingCutoverClassification;
}

export interface HostingCutoverReport {
  generatedAt: string;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    activeHostingAccounts: number;
    linked: number;
    readyToMap: number;
    ambiguousPlatformClaims: number;
    domainClaimedByOtherClient: number;
    platformClaimNotReady: number;
    linkedConflicts: number;
    legacyOnly: number;
  };
  items: HostingCutoverItem[];
}

interface HostingCutoverQueryRow {
  activeHostingAccounts: number | bigint;
  linked: number | bigint;
  readyToMap: number | bigint;
  ambiguousPlatformClaims: number | bigint;
  domainClaimedByOtherClient: number | bigint;
  platformClaimNotReady: number | bigint;
  linkedConflicts: number | bigint;
  legacyOnly: number | bigint;
  items: HostingCutoverItem[] | null;
}

function toCount(value: number | bigint | null | undefined): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

@Injectable()
export class PlatformHostingCutoverService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(page = 1, pageSize = 50): Promise<HostingCutoverReport> {
    const safePage = Math.min(100_000, Math.max(1, Math.trunc(Number(page) || 1)));
    const safePageSize = Math.min(100, Math.max(1, Math.trunc(Number(pageSize) || 50)));
    const offset = (safePage - 1) * safePageSize;
    const generatedAt = new Date().toISOString();

    const rows = await this.prisma.$queryRaw<HostingCutoverQueryRow[]>`
      WITH hosting AS (
        SELECT
          h.id::text AS hosting_account_id,
          h.client_id::text AS client_id,
          lower(regexp_replace(trim(h.domain), '\\.$', '')) AS normalized_domain,
          h.status::text AS hosting_status,
          h.platform_deployment_id::text AS platform_deployment_id,
          h.created_at
        FROM "hosting_accounts" h
        WHERE h.deleted_at IS NULL
      ),
      claims AS (
        SELECT
          p.client_id::text AS client_id,
          lower(regexp_replace(trim(p.requested_domain), '\\.$', '')) AS normalized_domain,
          p.status::text AS status,
          p.platform_tenant_id::text AS platform_tenant_id,
          p.platform_deployment_id::text AS platform_deployment_id,
          true AS is_projection,
          false AS domain_claim_conflict
        FROM "platform_provisioning_projections" p
        WHERE NULLIF(trim(p.requested_domain), '') IS NOT NULL
        UNION ALL
        SELECT
          o.client_id::text AS client_id,
          lower(regexp_replace(trim(o.payload ->> 'requestedDomain'), '\\.$', '')) AS normalized_domain,
          o.status::text AS status,
          NULL::text AS platform_tenant_id,
          NULL::text AS platform_deployment_id,
          false AS is_projection,
          o.last_error_code = 'PLATFORM_DOMAIN_CLAIM_CONFLICT' AS domain_claim_conflict
        FROM "platform_provisioning_outbox" o
        WHERE NULLIF(trim(o.payload ->> 'requestedDomain'), '') IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "platform_provisioning_projections" p
            WHERE p.external_order_id = o.external_order_id
              AND NULLIF(trim(p.requested_domain), '') IS NOT NULL
          )
      ),
      domain_claims AS (
        SELECT normalized_domain, count(*)::int AS claim_count
        FROM claims
        GROUP BY normalized_domain
      ),
      client_domain_claims AS (
        SELECT
          normalized_domain,
          client_id,
          count(*)::int AS claim_count,
          count(*) FILTER (
            WHERE is_projection
              AND status = 'ready'
              AND platform_tenant_id IS NOT NULL
              AND platform_deployment_id IS NOT NULL
          )::int AS ready_candidate_count,
          min(platform_deployment_id) FILTER (
            WHERE is_projection
              AND status = 'ready'
              AND platform_tenant_id IS NOT NULL
              AND platform_deployment_id IS NOT NULL
          ) AS candidate_platform_deployment_id,
          bool_or(domain_claim_conflict) AS has_domain_claim_conflict,
          COALESCE(array_agg(DISTINCT status ORDER BY status) FILTER (WHERE status IS NOT NULL), ARRAY[]::text[]) AS claim_statuses
        FROM claims
        GROUP BY normalized_domain, client_id
      ),
      compared AS (
        SELECT
          h.*,
          linked.status AS linked_projection_status,
          lower(regexp_replace(trim(linked.requested_domain), '\\.$', '')) AS linked_projection_domain,
          linked.client_id::text AS linked_projection_client_id,
          COALESCE(dc.claim_count, 0) AS domain_claim_count,
          COALESCE(cc.claim_count, 0) AS client_domain_claim_count,
          COALESCE(cc.ready_candidate_count, 0) AS ready_candidate_count,
          COALESCE(cc.has_domain_claim_conflict, false) AS domain_claim_conflict,
          cc.candidate_platform_deployment_id,
          COALESCE(cc.claim_statuses, ARRAY[]::text[]) AS claim_statuses,
          CASE
            WHEN h.platform_deployment_id IS NOT NULL AND linked.id IS NULL THEN 'linked_projection_missing'
            WHEN h.platform_deployment_id IS NOT NULL AND linked.client_id::text IS DISTINCT FROM h.client_id THEN 'linked_client_mismatch'
            WHEN h.platform_deployment_id IS NOT NULL
              AND lower(regexp_replace(trim(linked.requested_domain), '\\.$', '')) IS DISTINCT FROM h.normalized_domain
              THEN 'linked_domain_mismatch'
            WHEN h.platform_deployment_id IS NOT NULL AND COALESCE(dc.claim_count, 0) > COALESCE(cc.claim_count, 0)
              THEN 'linked_domain_collision'
            WHEN h.platform_deployment_id IS NOT NULL AND COALESCE(cc.claim_count, 0) > 1
              THEN 'linked_ambiguous_claims'
            WHEN h.platform_deployment_id IS NOT NULL THEN 'linked'
            WHEN COALESCE(dc.claim_count, 0) > COALESCE(cc.claim_count, 0) THEN 'domain_claimed_by_other_client'
            WHEN COALESCE(cc.claim_count, 0) > 1 THEN 'ambiguous_platform_claims'
            WHEN COALESCE(cc.claim_count, 0) = 1 AND COALESCE(cc.ready_candidate_count, 0) = 1 THEN 'ready_to_map'
            WHEN COALESCE(cc.claim_count, 0) = 1 THEN 'platform_claim_not_ready'
            ELSE 'legacy_only'
          END AS classification
        FROM hosting h
        LEFT JOIN "platform_provisioning_projections" linked
          ON linked.platform_deployment_id = h.platform_deployment_id
        LEFT JOIN domain_claims dc ON dc.normalized_domain = h.normalized_domain
        LEFT JOIN client_domain_claims cc
          ON cc.normalized_domain = h.normalized_domain
          AND cc.client_id IS NOT DISTINCT FROM h.client_id
      ),
      classified AS (
        SELECT compared.*,
          CASE
            WHEN classification = 'ready_to_map' THEN 0
            WHEN classification IN ('ambiguous_platform_claims', 'domain_claimed_by_other_client') THEN 1
            WHEN classification LIKE 'linked_%' THEN 2
            WHEN classification = 'platform_claim_not_ready' THEN 3
            ELSE 4
          END AS sort_rank
        FROM compared
      ),
      summary AS (
        SELECT
          count(*)::int AS active_hosting_accounts,
          count(*) FILTER (WHERE classification = 'linked')::int AS linked,
          count(*) FILTER (WHERE classification = 'ready_to_map')::int AS ready_to_map,
          count(*) FILTER (WHERE classification = 'ambiguous_platform_claims')::int AS ambiguous_platform_claims,
          count(*) FILTER (WHERE classification = 'domain_claimed_by_other_client')::int AS domain_claimed_by_other_client,
          count(*) FILTER (WHERE classification = 'platform_claim_not_ready')::int AS platform_claim_not_ready,
          count(*) FILTER (WHERE classification LIKE 'linked_%')::int AS linked_conflicts,
          count(*) FILTER (WHERE classification = 'legacy_only')::int AS legacy_only
        FROM classified
      ),
      page AS (
        SELECT *
        FROM classified
        ORDER BY sort_rank, normalized_domain, hosting_account_id
        OFFSET ${offset}
        LIMIT ${safePageSize}
      ),
      page_items AS (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'hostingAccountId', hosting_account_id,
              'clientId', client_id,
              'domain', normalized_domain,
              'hostingStatus', hosting_status,
              'platformDeploymentId', platform_deployment_id,
              'platformProjectionStatus', linked_projection_status,
              'domainClaimCount', domain_claim_count,
              'clientDomainClaimCount', client_domain_claim_count,
              'domainClaimConflict', domain_claim_conflict,
              'candidatePlatformDeploymentId', CASE
                WHEN classification = 'ready_to_map' THEN candidate_platform_deployment_id
                ELSE NULL
              END,
              'platformClaimStatuses', claim_statuses,
              'classification', classification
            ) ORDER BY sort_rank, normalized_domain, hosting_account_id
          ),
          '[]'::jsonb
        ) AS items
        FROM page
      )
      SELECT
        summary.active_hosting_accounts AS "activeHostingAccounts",
        summary.linked AS "linked",
        summary.ready_to_map AS "readyToMap",
        summary.ambiguous_platform_claims AS "ambiguousPlatformClaims",
        summary.domain_claimed_by_other_client AS "domainClaimedByOtherClient",
        summary.platform_claim_not_ready AS "platformClaimNotReady",
        summary.linked_conflicts AS "linkedConflicts",
        summary.legacy_only AS "legacyOnly",
        page_items.items AS "items"
      FROM summary CROSS JOIN page_items
    `;

    const row = rows[0];
    const total = toCount(row?.activeHostingAccounts);
    return {
      generatedAt,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
      summary: {
        activeHostingAccounts: total,
        linked: toCount(row?.linked),
        readyToMap: toCount(row?.readyToMap),
        ambiguousPlatformClaims: toCount(row?.ambiguousPlatformClaims),
        domainClaimedByOtherClient: toCount(row?.domainClaimedByOtherClient),
        platformClaimNotReady: toCount(row?.platformClaimNotReady),
        linkedConflicts: toCount(row?.linkedConflicts),
        legacyOnly: toCount(row?.legacyOnly),
      },
      items: Array.isArray(row?.items) ? row.items : [],
    };
  }
}
