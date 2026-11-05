import {
  renderDocumentLetterheadHtml,
  renderSecurityVerificationSectionHtml,
  getAntiFraudWatermarkCss,
} from '@/lib/document-branding';

export interface ReceiptData {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  channel?: string;
  paidAt?: string;
  description?: string;
  customer?: {
    email?: string;
    first_name?: string | null;
    last_name?: string | null;
    customer_code?: string;
    phone?: string | null;
  };
  metadata?: {
    planSlug?: string;
    phone?: string;
    customer_type?: string;
    source?: string;
    billingCycle?: string;
  };
}

const PLAN_LOOKUP: Record<string, { title: string; subtitle: string; period: string }> = {
  'care-essential': {
    title: 'Care Essential Plan',
    subtitle: 'Core Maintenance, CMS & Plugin Updates, 24/7 Security & Offsite Backups',
    period: 'Monthly Subscription',
  },
  'care-business': {
    title: 'Care Business Plan',
    subtitle: 'Performance Acceleration, Core Web Vitals, SEO Audits & Priority Support',
    period: 'Monthly Subscription',
  },
  'care-professional': {
    title: 'Care Professional Plan',
    subtitle: 'Full-Stack Dedicated Engineering, 24/7 Uptime SLA & Quarterly Strategy',
    period: 'Monthly Subscription',
  },
  'starter': {
    title: 'Care Starter Plan',
    subtitle: 'Managed Cloud Deployment, SSL Management & Uptime Monitoring',
    period: 'Monthly Subscription',
  },
};

function formatCurrency(amount: number, currency: string): string {
  const cur = currency ? currency.toUpperCase() : 'KES';
  return `${escapeHtml(cur)} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatChannel(channel?: string): string {
  if (!channel) return 'Electronic Payment';
  const c = channel.toLowerCase();
  if (c.includes('mobile_money') || c.includes('mpesa')) return 'M-Pesa (Mobile Money)';
  if (c.includes('card')) return 'Credit / Debit Card';
  if (c.includes('bank')) return 'Direct Bank Transfer';
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

export function generateReceiptHtml(data: ReceiptData): string {
  const planSlug = data.metadata?.planSlug;
  const planInfo = (planSlug && PLAN_LOOKUP[planSlug]) || {
    title: data.description || 'BazionWeb Service',
    subtitle: 'Service details from your BazionWeb invoice',
    period: data.metadata?.billingCycle || 'Service payment',
  };

  const formattedAmount = formatCurrency(data.amount, data.currency);
  const channelDisplay = formatChannel(data.channel);
  const customerEmail = data.customer?.email || 'billing-customer@bazionweb.com';
  const customerPhone = data.metadata?.phone || data.customer?.phone || 'On file';
  const customerName = [data.customer?.first_name, data.customer?.last_name].filter(Boolean).join(' ') || customerEmail.split('@')[0];
  const receiptNumber = `REC-${data.reference.toUpperCase()}`;

  const letterheadHtml = renderDocumentLetterheadHtml({
    docType: 'PAYMENT RECEIPT',
    docNumber: receiptNumber,
    statusTone: 'emerald',
    statusBadgeText: 'PAYMENT CONFIRMED',
    issueDate: data.paidAt,
    settledDate: data.paidAt,
    gatewayRef: data.reference,
  });

  const securitySectionHtml = renderSecurityVerificationSectionHtml({
    docNumber: receiptNumber,
    docType: 'PAYMENT RECEIPT',
    totalAmount: data.amount,
    currency: data.currency,
    recipientEmail: customerEmail,
    issueDate: data.paidAt,
    status: 'PAID',
    isPaid: true,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt – ${escapeHtml(receiptNumber)} | BazionWeb</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    ${getAntiFraudWatermarkCss()}
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0B0F17;
      color: #0F172A;
      line-height: 1.5;
      padding: 24px 16px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    /* Top action banner */
    .action-bar {
      width: 100%;
      max-width: 820px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding: 12px 20px;
      background: rgba(30, 41, 59, 0.85);
      border: 1px solid rgba(71, 85, 105, 0.4);
      backdrop-filter: blur(12px);
      border-radius: 14px;
      color: #F8FAFC;
    }
    .action-bar .brand-badge {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      font-weight: 500;
      color: #94A3B8;
    }
    .action-bar .brand-badge strong {
      color: #F8FAFC;
    }
    .action-buttons {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      padding: 9px 18px;
      border-radius: 10px;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }
    .btn-primary {
      background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
      color: #FFFFFF;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: rgba(51, 65, 85, 0.8);
      color: #E2E8F0;
      border: 1px solid rgba(100, 116, 139, 0.3);
    }
    .btn-secondary:hover {
      background: rgba(71, 85, 105, 0.9);
      color: #FFFFFF;
    }

    /* Paper Receipt Container */
    .receipt-card {
      width: 100%;
      max-width: 820px;
      background: #FFFFFF;
      border-radius: 20px;
      padding: 48px;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
      position: relative;
      overflow: hidden;
    }

    /* Top decorative gradient edge */
    .receipt-card::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: linear-gradient(90deg, #14B8A6, #2563EB, #8B5CF6);
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #F1F5F9;
      padding-bottom: 32px;
      margin-bottom: 32px;
    }
    .company-info h1 {
      font-size: 22px;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .company-info h1 span.highlight {
      color: #2563EB;
    }
    .company-info .meta {
      font-size: 12px;
      color: #64748B;
      margin-top: 6px;
      line-height: 1.6;
    }

    .receipt-meta {
      text-align: right;
    }
    .badge-paid {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #ECFDF5;
      color: #059669;
      border: 1px solid #A7F3D0;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .badge-paid svg {
      width: 14px;
      height: 14px;
    }
    .receipt-meta .ref-title {
      font-size: 11px;
      font-weight: 600;
      color: #94A3B8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .receipt-meta .ref-number {
      font-family: 'JetBrains Mono', monospace;
      font-size: 15px;
      font-weight: 700;
      color: #0F172A;
      margin-top: 2px;
    }
    .receipt-meta .date-text {
      font-size: 12px;
      color: #64748B;
      margin-top: 4px;
    }

    /* Billing info grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 36px;
    }
    .info-col h3 {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #94A3B8;
      margin-bottom: 8px;
    }
    .info-col p {
      font-size: 14px;
      color: #1E293B;
      font-weight: 500;
      line-height: 1.5;
    }
    .info-col .sub {
      font-size: 12px;
      color: #64748B;
      margin-top: 2px;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Items table */
    .table-container {
      margin-bottom: 32px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748B;
      padding: 12px 16px;
      background: #F1F5F9;
      border-bottom: 1px solid #E2E8F0;
    }
    th:first-child {
      border-top-left-radius: 8px;
    }
    th:last-child {
      border-top-right-radius: 8px;
      text-align: right;
    }
    td {
      padding: 18px 16px;
      border-bottom: 1px solid #F1F5F9;
      font-size: 14px;
      color: #1E293B;
    }
    td:last-child {
      text-align: right;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
    }
    .item-title {
      font-weight: 700;
      color: #0F172A;
      font-size: 14px;
    }
    .item-desc {
      font-size: 12px;
      color: #64748B;
      margin-top: 4px;
    }

    /* Summary section */
    .summary-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 36px;
    }
    .summary-box {
      width: 320px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #64748B;
      padding: 6px 0;
    }
    .summary-row.total {
      border-top: 2px solid #E2E8F0;
      margin-top: 8px;
      padding-top: 14px;
      font-size: 16px;
      font-weight: 800;
      color: #0F172A;
    }
    .summary-row.total .total-amount {
      color: #2563EB;
      font-family: 'JetBrains Mono', monospace;
      font-size: 18px;
    }

    /* Verification Badge & Stamp */
    .stamp-section {
      border: 1px dashed #CBD5E1;
      border-radius: 12px;
      padding: 16px 20px;
      background: #F8FAFC;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }
    .stamp-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .stamp-icon {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #EFF6FF;
      color: #2563EB;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .stamp-text {
      font-size: 12px;
      color: #475569;
    }
    .stamp-text strong {
      color: #0F172A;
      display: block;
      font-size: 13px;
    }
    .stamp-ref {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #64748B;
    }

    /* Footer */
    .receipt-footer {
      border-top: 1px solid #F1F5F9;
      padding-top: 24px;
      text-align: center;
      color: #94A3B8;
      font-size: 11px;
      line-height: 1.6;
    }
    .receipt-footer strong {
      color: #64748B;
    }

    /* Print Specific Styles */
    @media print {
      @page {
        size: A4 portrait;
        margin: 12mm 15mm;
      }
      body {
        background: #FFFFFF !important;
        padding: 0 !important;
        color: #000000 !important;
      }
      .action-bar {
        display: none !important;
      }
      .receipt-card {
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        max-width: 100% !important;
      }
      .receipt-card::before {
        display: none;
      }
      .info-grid {
        background: #F8FAFC !important;
        border-color: #E2E8F0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .badge-paid {
        background: #ECFDF5 !important;
        color: #059669 !important;
        border-color: #A7F3D0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      th {
        background: #F1F5F9 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>

  <!-- Floating action bar for interactive browser view -->
  <div class="action-bar">
    <div class="brand-badge">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
      <span>Official Payment Receipt &bull; <strong>Verified by Paystack</strong></span>
    </div>
    <div class="action-buttons">
      <a href="/portal" class="btn btn-secondary">
        &larr; Back to Portal
      </a>
      <button onclick="window.print()" class="btn btn-primary">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        Print / Save as PDF
      </button>
    </div>
  </div>

  <!-- Main Paper Receipt -->
  <div class="receipt-card">
    <div class="security-watermark-overlay">OFFICIAL RECEIPT · PAID</div>
    
    <!-- Executive Corporate Letterhead -->
    ${letterheadHtml}

    <!-- Customer & Payment Grid -->
    <div class="info-grid">
      <div class="info-col">
        <h3>Billed To</h3>
        <p><strong>${escapeHtml(customerName)}</strong></p>
        <p>${escapeHtml(customerEmail)}</p>
        <div class="sub">Phone: ${escapeHtml(customerPhone)}</div>
        ${data.customer?.customer_code ? `<div class="sub">Customer Ref: ${escapeHtml(data.customer.customer_code)}</div>` : ''}
      </div>
      <div class="info-col">
        <h3>Payment Breakdown</h3>
        <p><strong>Channel:</strong> ${escapeHtml(channelDisplay)}</p>
          <p><strong>Status:</strong> Payment confirmed</p>
        <div class="sub">Paystack Ref: ${escapeHtml(data.reference)}</div>
        <div class="sub">Gateway: Secured 256-bit SSL</div>
      </div>
    </div>

    <!-- Itemized Table -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Service / Description</th>
            <th>Billing Cycle</th>
            <th>Qty</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="item-title">${escapeHtml(planInfo.title)}</div>
              <div class="item-desc">${escapeHtml(planInfo.subtitle)}</div>
            </td>
            <td>${escapeHtml(planInfo.period)}</td>
            <td>1</td>
            <td>${formattedAmount}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Financial Summary -->
    <div class="summary-section">
      <div class="summary-box">
        <div class="summary-row">
          <span>Subtotal</span>
          <span>${formattedAmount}</span>
        </div>
        <div class="summary-row">
          <span>VAT / Taxes (Inclusive)</span>
          <span>16.0% (Included)</span>
        </div>
        <div class="summary-row total">
          <span>Total Paid</span>
          <span class="total-amount">${formattedAmount}</span>
        </div>
      </div>
    </div>

    <!-- Security, E-Stamp & Anti-Fake Verification Center -->
    ${securitySectionHtml}

    <!-- Footer -->
    <div class="receipt-footer">
      <p>Thank you for choosing <strong>Bazion Technologies</strong>. Your payment has been confirmed; view the dashboard for current service status.</p>
      <p>For billing assistance or questions regarding this transaction, contact <strong>billing@bazionweb.com</strong> or call <strong>+254 721 287 053</strong>.</p>
    </div>

  </div>

</body>
</html>`;
}

export function generateErrorReceiptHtml(reference: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt Not Found | BazionWeb</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      background: #0B0F17;
      color: #F8FAFC;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .card {
      background: #1E293B;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 40px;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }
    .icon {
      width: 56px;
      height: 56px;
      background: rgba(239, 68, 68, 0.1);
      color: #EF4444;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    h2 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    p { font-size: 14px; color: #94A3B8; line-height: 1.6; margin-bottom: 20px; }
    .ref {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      background: #0F172A;
      padding: 8px 12px;
      border-radius: 8px;
      color: #CBD5E1;
      margin-bottom: 24px;
      word-break: break-all;
    }
    .btn {
      display: inline-block;
      background: #2563EB;
      color: #FFF;
      font-weight: 600;
      font-size: 13px;
      padding: 10px 20px;
      border-radius: 10px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    </div>
    <h2>Receipt Verification Failed</h2>
    <p>${escapeHtml(message || 'Unable to load receipt for this transaction reference.')}</p>
    <div class="ref">REF: ${escapeHtml(reference || 'N/A')}</div>
    <a href="/portal" class="btn">Return to Portal</a>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
