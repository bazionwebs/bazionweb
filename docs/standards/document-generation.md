# BazionWeb document generation standard

## Purpose

Create consistent, readable and trustworthy customer documents from authoritative BazionWeb records. This standard applies to invoices, payment receipts, proposals, statements, downloadable PDFs and document-related email content.

## Source of truth

- Invoice and payment amounts, status, dates, recipient details and line items come from the API and persisted billing records.
- A browser-rendered checkout page is never an invoice. Customer invoice/receipt actions use the official API document endpoint.
- Public receipts show only the minimum customer information needed to identify the recipient. Use masked contact details when the lookup URL is public.
- Proposals identify their registry reference and scope. Do not describe a visual mark, reference barcode, record lookup or unkeyed digest as a digital signature or legal certification.

## Branding and layout

- Use BazionWeb's navy `#0F172A`, blue `#2563EB` and teal `#14B8A6` accents, the approved logo and clear document titles/reference numbers.
- Prefer system fonts, embedded/local assets and vector shapes so documents render consistently without external network requests.
- Standalone receipt HTML embeds the approved BazionWeb mark when the server asset is available, with a local vector fallback.
- Use an 8-point spacing rhythm, strong contrast, readable body text, repeated table headers where possible and intentional page breaks. Do not clip long descriptions or allow totals, payment instructions or verification details to overlap.
- Print actions must hide navigation and controls. Define paper size/margins and keep related rows/cards together across page breaks.

## Integrity and access

- Server HMAC-SHA256 signatures bind canonical invoice and proposal record fields, including amounts, recipient, status, dates, line items and applicable payment instructions. They authenticate the server record data; they do not cryptographically sign the PDF bytes. Never create a purported authenticity checksum in frontend code or embed a secret in a client bundle.
- Compare complete signatures exactly with a constant-time comparison. Public verification returns the current record fields so recipients can compare them with the document. A barcode encodes a reference only; it does not prove authenticity.
- Keep the document signing key in the runtime secret manager. Use a dedicated stable `DOCUMENT_SIGNING_SECRET`; the service can use a domain-separated `JWT_SECRET` fallback. During rotation, set `DOCUMENT_SIGNING_PREVIOUS_SECRET` until documents signed with the prior key no longer need verification.
- Invoice download URLs are bearer capabilities: keep their lifetime short, scope them to a single invoice, do not cache them and set `Referrer-Policy: no-referrer`. Do not log the token or expose it in analytics.
- Public verification pages distinguish a registry record lookup from a verified cryptographic signature. Show only masked personal information.

## Required quality checks

Before merging a document template change:

1. Add tests for required branded fields, escaping/untrusted inputs, status/date/amount semantics and relevant access controls.
2. Test valid, altered, partial and missing signatures. Confirm a reference lookup alone is not described as cryptographic verification.
3. Generate representative PDFs for paid/unpaid and short/long line-item cases; validate the PDF structure and page count.
4. Render every output page to an image and inspect for clipping, overlap, awkward whitespace, broken logos, unreadable text, and unexpected browser chrome.
5. Confirm the generated document makes no unsupported security, compliance or statutory-validity claims.

The API's server-generated invoice PDF is the canonical invoice and receipt format. Separate HTML receipt/proposal views must follow the same content, privacy, branding and verification rules until they are migrated to canonical PDFs.
