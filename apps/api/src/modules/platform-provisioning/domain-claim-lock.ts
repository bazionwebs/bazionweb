/**
 * Serialize legacy hosting creation and Platform outbox claims for one canonical
 * domain. Both operations must call this inside their database transaction and
 * use the same namespace/key derivation.
 */
export function normalizeProvisioningDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, '');
}

export async function lockProvisioningDomainClaim(tx: any, normalizedDomain: string): Promise<void> {
  if (typeof tx?.$queryRaw !== 'function') {
    throw new Error('PROVISIONING_DOMAIN_CLAIM_TRANSACTION_REQUIRED');
  }

  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended('bazion.domain-claim:' || ${normalizedDomain}, 0)
    )
  `;
}

/** Find every competing owner of a domain while its advisory transaction lock is held. */
export async function findProvisioningDomainClaims(
  tx: any,
  normalizedDomain: string,
  excludeExternalOrderId?: string,
): Promise<Array<{ claimId: string; source: string; externalOrderId: string | null }>> {
  if (typeof tx?.$queryRaw !== 'function') {
    throw new Error('PROVISIONING_DOMAIN_CLAIM_TRANSACTION_REQUIRED');
  }

  const excludedOrder = excludeExternalOrderId ?? '';
  return tx.$queryRaw<Array<{ claimId: string; source: string; externalOrderId: string | null }>>`
    SELECT h.id::text AS "claimId", 'legacy_hosting' AS source, NULL::text AS "externalOrderId"
      FROM "hosting_accounts" h
     WHERE lower(regexp_replace(trim(h.domain), '\\.$', '')) = ${normalizedDomain}
    UNION ALL
    SELECT p.external_order_id AS "claimId", 'projection' AS source, p.external_order_id AS "externalOrderId"
      FROM "platform_provisioning_projections" p
     WHERE lower(regexp_replace(trim(p.requested_domain), '\\.$', '')) = ${normalizedDomain}
       AND (${excludedOrder} = '' OR p.external_order_id <> ${excludedOrder})
    UNION ALL
    SELECT o.external_order_id AS "claimId", 'outbox' AS source, o.external_order_id AS "externalOrderId"
      FROM "platform_provisioning_outbox" o
     WHERE lower(regexp_replace(trim(o.payload ->> 'requestedDomain'), '\\.$', '')) = ${normalizedDomain}
       AND (${excludedOrder} = '' OR o.external_order_id <> ${excludedOrder})
       AND NOT EXISTS (
         SELECT 1
           FROM "platform_provisioning_projections" p
          WHERE p.external_order_id = o.external_order_id
            AND lower(regexp_replace(trim(p.requested_domain), '\\.$', '')) = ${normalizedDomain}
       )
     LIMIT 1
  `;
}
