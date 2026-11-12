import nodemailer from 'nodemailer';
import { escapeHtml } from '@/lib/utils';
import { HELP_CENTER_ABSOLUTE_URL } from '@/lib/contact';

export interface SendMagicLinkOptions {
  to: string;
  magicLinkUrl: string;
}

export interface SendClaimLinkOptions {
  to: string;
  claimLinkUrl: string;
}

export interface SendPasswordResetOptions {
  to: string;
  resetLinkUrl: string;
}

export interface ContactInquiryOptions {
  clientName: string;
  clientEmail: string;
  company?: string;
  phone?: string;
  serviceInterest?: string;
  message?: string;
  leadId?: string;
  country?: string;
}

export interface QuoteSummaryOptions {
  clientName: string;
  clientEmail: string;
  clientCompany?: string;
  proposalId: string;
  proposalCode: string;
  packageName: string;
  currency: string;
  totalBuild: number | string;
  formattedTotalBuild: string;
  monthlyCare?: number | string;
  formattedMonthlyCare?: string;
  annualHosting?: number | string;
  formattedAnnualHosting?: string;
  totalYearOne?: number | string;
  formattedTotalYearOne?: string;
  proposalUrl?: string;
  breakdownSummary?: Array<{ label: string; value: string }>;
}

export interface SendEmailResult {
  success: boolean;
  delivered: boolean;
  provider?: string;
  error?: string;
  previewUrl?: string;
  message?: string;
}

/**
 * Shared executive email branding components (Client compatible, Table-based)
 */
function renderEmailHeaderHtml(badge: string, subtitle = 'Managed Website Lifecycle & Enterprise Infrastructure'): string {
  return `<!-- Corporate Letterhead Header -->
  <div style="border-bottom: 2px solid #334155; padding-bottom: 20px; margin-bottom: 24px; text-align: center;">
    <div style="height: 3px; background: linear-gradient(90deg, #0F172A 0%, #2563EB 60%, #10B981 100%); border-radius: 2px; margin-bottom: 18px;"></div>
    <div style="margin-bottom: 10px;">
      <img src="https://bazionweb.com/brand/logo-with-background.png" alt="BazionWeb – Build, Host n Grow" width="96" height="86" style="display: inline-block; height: 76px; width: auto; border-radius: 8px; border: 1px solid #334155; background: #EBEBEB;" />
    </div>
    <div style="font-size: 24px; font-weight: 900; color: #FFFFFF; letter-spacing: -0.02em;">
      Bazion<span style="color: #38BDF8;">Web</span>
    </div>
    <div style="font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px;">
      BAZION WEB &bull; ${escapeHtml(subtitle)}
    </div>
    <div style="margin-top: 10px;">
      <span style="display: inline-block; padding: 4px 14px; background: rgba(37, 99, 235, 0.15); border: 1px solid rgba(37, 99, 235, 0.35); color: #60A5FA; border-radius: 9999px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;">
        ${escapeHtml(badge)}
      </span>
    </div>
  </div>`;
}

function renderEmailSecuritySealHtml(docRef?: string): string {
  return `<!-- BazionWeb document reference -->
  <div style="margin-top: 26px; background: #0F172A; border: 1px solid #334155; border-radius: 12px; padding: 14px 16px; text-align: left;">
    <div style="display: table; width: 100%;">
      <div style="display: table-cell; vertical-align: middle; width: 40px;">
        <div style="width: 34px; height: 34px; border-radius: 50%; border: 2px dashed #2563EB; background: #1E293B; color: #34D399; text-align: center; line-height: 32px; font-size: 15px; font-weight: 900;">
          BW
        </div>
      </div>
      <div style="display: table-cell; vertical-align: middle; padding-left: 12px;">
        <div style="font-size: 10.5px; font-weight: 800; color: #F8FAFC; letter-spacing: 0.04em;">
          BAZION WEB &bull; DOCUMENT RECORD
        </div>
        <div style="font-size: 9.5px; color: #94A3B8; margin-top: 2px; line-height: 1.4;">
          Check the current BazionWeb registry record. ${docRef ? `Reference: <span style="font-family: monospace; color: #38BDF8;">${escapeHtml(docRef)}</span>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function renderEmailCorporateFooterHtml(): string {
  const year = new Date().getFullYear();
  return `<!-- BazionWeb corporate footer -->
  <div style="font-size: 11px; color: #64748B; text-align: center; line-height: 1.6; margin-top: 24px;">
    &copy; ${year} BAZION WEB &bull; Mwiki, Gituamba, Embakasi, Nairobi (P.O. Box 46376, 00100 - G.P.O Nairobi).<br>
    <strong>BRS Reg:</strong> BN-DLSZOZ6O (Cap 499) &bull; <strong>KRA PIN:</strong> A006926734I<br>
    billing@bazionweb.com &bull; support@bazionweb.com &bull; +254 721 287 053 &bull; www.bazionweb.com
  </div>`;
}

export function generateMagicLinkEmailHtml(magicLinkUrl: string, recipientEmail: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Sign in to BazionWeb</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0B0F17;
      color: #F8FAFC;
      margin: 0;
      padding: 32px 16px;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background: #1E293B;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    h2 {
      font-size: 20px;
      font-weight: 700;
      color: #FFFFFF;
      margin: 0 0 12px;
      text-align: center;
    }
    p {
      font-size: 14px;
      color: #94A3B8;
      line-height: 1.6;
      margin: 0 0 24px;
      text-align: center;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
      color: #FFFFFF !important;
      font-weight: 700;
      font-size: 14px;
      padding: 14px 32px;
      border-radius: 12px;
      text-decoration: none;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
    }
    .btn:hover {
      background: #1D4ED8;
    }
    .subtext {
      font-size: 12px;
      color: #64748B;
      text-align: center;
      line-height: 1.5;
      border-top: 1px solid #334155;
      padding-top: 20px;
      margin-top: 24px;
    }
    .url-fallback {
      word-break: break-all;
      color: #38BDF8;
      font-size: 11px;
      margin-top: 8px;
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    ${renderEmailHeaderHtml('Client Operating Space')}

    <h2>Sign in to your client hub</h2>
    <p>
      We received a request to sign in to BazionWeb for <strong>${escapeHtml(recipientEmail)}</strong>.
      Click the secure button below to authenticate instantly.
    </p>
    <div class="btn-container">
      <a href="${escapeHtml(magicLinkUrl)}" class="btn" target="_blank">Sign In to Client Hub &rarr;</a>
    </div>
    <div class="subtext">
      This link is valid for <strong>15 minutes</strong> and can only be used once. If you did not request this login link, you can safely ignore this email.
      <span class="url-fallback">${escapeHtml(magicLinkUrl)}</span>
    </div>

    ${renderEmailSecuritySealHtml('AUTH-MAGIC-LINK')}
  </div>
  ${renderEmailCorporateFooterHtml()}
</body>
</html>`;
}

export function generateClaimLinkEmailHtml(claimLinkUrl: string, recipientEmail: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Claim your BazionWeb account</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#0B0F17;color:#F8FAFC;margin:0;padding:32px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#1E293B;border:1px solid #334155;border-radius:16px;padding:36px 32px;box-shadow:0 10px 30px rgba(0,0,0,0.4);">
    ${renderEmailHeaderHtml('Payment Confirmed · Activation')}

    <h2 style="font-size:20px;font-weight:700;color:#FFFFFF;margin:0 0 12px;text-align:center;">Claim your client hub</h2>
    <p style="font-size:14px;color:#94A3B8;line-height:1.6;margin:0 0 24px;text-align:center;">
      Your payment is confirmed for <strong>${escapeHtml(recipientEmail)}</strong>. Open the secure link below to set your password and activate the workspace.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${escapeHtml(claimLinkUrl)}" style="display:inline-block;background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);color:#FFFFFF;font-weight:700;font-size:14px;padding:14px 32px;border-radius:12px;text-decoration:none;box-shadow:0 4px 14px rgba(37,99,235,0.4);" target="_blank">Claim My Account &rarr;</a>
    </div>
    <div style="font-size:12px;color:#64748B;text-align:center;line-height:1.5;border-top:1px solid #334155;padding-top:20px;margin-top:24px;">
      This link is valid for <strong>15 minutes</strong> and can only be used once. We will never ask for your password by email. If you did not make this payment, you can ignore this message or contact billing@bazionweb.com.
      <span style="word-break:break-all;color:#38BDF8;font-size:11px;margin-top:8px;display:block;">${escapeHtml(claimLinkUrl)}</span>
    </div>

    ${renderEmailSecuritySealHtml('AUTH-ACCOUNT-CLAIM')}
  </div>
  ${renderEmailCorporateFooterHtml()}
</body>
</html>`;
}

export function generatePasswordResetEmailHtml(resetLinkUrl: string, recipientEmail: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Reset your BazionWeb password</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#0B0F17;color:#F8FAFC;margin:0;padding:32px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#1E293B;border:1px solid #334155;border-radius:16px;padding:36px 32px;box-shadow:0 10px 30px rgba(0,0,0,0.4);">
    ${renderEmailHeaderHtml('Secure Password Recovery')}

    <h2 style="font-size:20px;font-weight:700;color:#FFFFFF;margin:0 0 12px;text-align:center;">Reset your password</h2>
    <p style="font-size:14px;color:#94A3B8;line-height:1.6;margin:0 0 24px;text-align:center;">
      We received a request to reset the password for <strong>${escapeHtml(recipientEmail)}</strong>. Open the secure link below to choose a new one.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${escapeHtml(resetLinkUrl)}" style="display:inline-block;background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);color:#FFFFFF;font-weight:700;font-size:14px;padding:14px 32px;border-radius:12px;text-decoration:none;box-shadow:0 4px 14px rgba(37,99,235,0.4);" target="_blank">Choose a New Password &rarr;</a>
    </div>
    <div style="font-size:12px;color:#64748B;text-align:center;line-height:1.5;border-top:1px solid #334155;padding-top:20px;margin-top:24px;">
      This link is valid for <strong>15 minutes</strong>, can only be used once, and cannot be forwarded for reuse. After a successful reset, every active session will be signed out. If you did not request this, ignore this email &mdash; your password stays unchanged. We will never ask for your password by email.
      <span style="word-break:break-all;color:#38BDF8;font-size:11px;margin-top:8px;display:block;">${escapeHtml(resetLinkUrl)}</span>
    </div>

    ${renderEmailSecuritySealHtml('AUTH-PASSWORD-RESET')}
  </div>
  ${renderEmailCorporateFooterHtml()}
</body>
</html>`;
}

export function generateContactNotificationEmailHtml(options: ContactInquiryOptions): string {
  const { clientName, clientEmail, company, phone, serviceInterest, message, leadId, country } = options;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>New Lead Inquiry</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#0B0F17;color:#F8FAFC;margin:0;padding:32px 16px;">
  <div style="max-width:580px;margin:0 auto;background:#1E293B;border:1px solid #334155;border-radius:16px;padding:36px 32px;box-shadow:0 10px 30px rgba(0,0,0,0.4);">
    ${renderEmailHeaderHtml('New Lead Ingestion')}

    <h2 style="font-size:20px;font-weight:700;color:#FFFFFF;margin:0 0 16px;text-align:center;">New Contact Inquiry Received</h2>
    <p style="font-size:14px;color:#94A3B8;line-height:1.6;margin:0 0 24px;text-align:center;">
      A prospective client submitted a lead inquiry via BazionWeb. Below are the inquiry details:
    </p>
    <div style="background:#0F172A;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#E2E8F0;">
        <tr>
          <td style="padding:8px 0;color:#94A3B8;font-weight:600;width:35%;">Lead Reference:</td>
          <td style="padding:8px 0;font-weight:700;color:#38BDF8;">${escapeHtml(leadId || 'N/A')}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94A3B8;font-weight:600;">Client Name:</td>
          <td style="padding:8px 0;color:#FFFFFF;font-weight:600;">${escapeHtml(clientName)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94A3B8;font-weight:600;">Client Email:</td>
          <td style="padding:8px 0;"><a href="mailto:${escapeHtml(clientEmail)}" style="color:#38BDF8;text-decoration:none;">${escapeHtml(clientEmail)}</a></td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94A3B8;font-weight:600;">Company / Org:</td>
          <td style="padding:8px 0;color:#F1F5F9;">${escapeHtml(company || 'Not specified')}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94A3B8;font-weight:600;">Phone / WhatsApp:</td>
          <td style="padding:8px 0;color:#F1F5F9;">${escapeHtml(phone || 'Not specified')}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94A3B8;font-weight:600;">Market / Country:</td>
          <td style="padding:8px 0;color:#F1F5F9;">${escapeHtml(country || 'Not specified')}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94A3B8;font-weight:600;">Service Interest:</td>
          <td style="padding:8px 0;color:#34D399;font-weight:700;">${escapeHtml(serviceInterest || 'Website Development')}</td>
        </tr>
      </table>
    </div>
    <div style="background:#0F172A;border:1px solid #334155;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:12px;color:#94A3B8;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Client Message / Specifications:</div>
      <div style="font-size:14px;color:#E2E8F0;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message || 'No additional project notes provided.')}</div>
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="mailto:${escapeHtml(clientEmail)}?subject=Re:%20BazionWeb%20Inquiry%20-%20${encodeURIComponent(serviceInterest || 'Website Development')}" style="display:inline-block;background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);color:#FFFFFF;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;" target="_blank">Reply to Client Directly &rarr;</a>
    </div>

    ${renderEmailSecuritySealHtml(leadId || 'INQ-LEAD')}
  </div>
  ${renderEmailCorporateFooterHtml()}
</body>
</html>`;
}

export function generateContactConfirmationEmailHtml(options: ContactInquiryOptions): string {
  const { clientName, serviceInterest, leadId } = options;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Inquiry Confirmation</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#0B0F17;color:#F8FAFC;margin:0;padding:32px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#1E293B;border:1px solid #334155;border-radius:16px;padding:36px 32px;box-shadow:0 10px 30px rgba(0,0,0,0.4);">
    ${renderEmailHeaderHtml('Inquiry Received')}

    <h2 style="font-size:20px;font-weight:700;color:#FFFFFF;margin:0 0 12px;text-align:center;">We Received Your Inquiry</h2>
    <p style="font-size:14px;color:#94A3B8;line-height:1.6;margin:0 0 20px;text-align:center;">
      Hello <strong>${escapeHtml(clientName)}</strong>, thank you for reaching out to BazionWeb regarding <strong>${escapeHtml(serviceInterest || 'your upcoming project')}</strong>.
    </p>
    <div style="background:#0F172A;border:1px solid #334155;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:13px;color:#CBD5E1;line-height:1.6;">
        Our solutions team has logged your inquiry under reference <strong style="color:#38BDF8;">${escapeHtml(leadId || 'CONFIRMED')}</strong>. An engineer will review your specifications and contact you within 24 business hours with next steps or a tailored consultation.
      </div>
    </div>
    <div style="border-top:1px solid #334155;border-bottom:1px solid #334155;padding:16px 0;margin-bottom:24px;">
      <div style="font-size:12px;color:#94A3B8;margin-bottom:8px;font-weight:600;">Need immediate assistance?</div>
      <div style="font-size:13px;color:#E2E8F0;line-height:1.5;">
        &bull; <strong>WhatsApp Hotline:</strong> <a href="https://wa.me/254721287053" style="color:#34D399;text-decoration:none;">+254 721 287 053</a><br>
        &bull; <strong>Help Center:</strong> <a href="${HELP_CENTER_ABSOLUTE_URL}" style="color:#38BDF8;text-decoration:none;">${HELP_CENTER_ABSOLUTE_URL.replace(/^https?:\/\//, '')}</a><br>
        &bull; <strong>System Status:</strong> <a href="https://status.bazionweb.com" style="color:#38BDF8;text-decoration:none;">status.bazionweb.com</a>
      </div>
    </div>

    ${renderEmailSecuritySealHtml(leadId || 'CONF-LEAD')}
  </div>
  ${renderEmailCorporateFooterHtml()}
</body>
</html>`;
}

export function generateQuoteSummaryEmailHtml(options: QuoteSummaryOptions): string {
  const {
    clientName,
    proposalCode,
    proposalId,
    packageName,
    formattedTotalBuild,
    formattedMonthlyCare,
    formattedAnnualHosting,
    formattedTotalYearOne,
    proposalUrl,
  } = options;

  const directUrl = proposalUrl || `https://bazionweb.com/quote?proposal=${encodeURIComponent(proposalCode)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Your BazionWeb Project Quote</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#0B0F17;color:#F8FAFC;margin:0;padding:32px 16px;">
  <div style="max-width:580px;margin:0 auto;background:#1E293B;border:1px solid #334155;border-radius:16px;padding:36px 32px;box-shadow:0 10px 30px rgba(0,0,0,0.4);">
    ${renderEmailHeaderHtml('Official Project Proposal')}

    <h2 style="font-size:20px;font-weight:700;color:#FFFFFF;margin:0 0 12px;text-align:center;">Your Tailored Project Quotation</h2>
    <p style="font-size:14px;color:#94A3B8;line-height:1.6;margin:0 0 24px;text-align:center;">
      Hello <strong>${escapeHtml(clientName)}</strong>, thank you for configuring your project proposal on BazionWeb. Here is your itemized commercial summary:
    </p>
    <div style="background:#0F172A;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#E2E8F0;">
        <tr>
          <td style="padding:8px 0;color:#94A3B8;font-weight:600;">Proposal Reference:</td>
          <td style="padding:8px 0;font-weight:700;color:#38BDF8;">${escapeHtml(proposalCode)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94A3B8;font-weight:600;">Proposal Identifier:</td>
          <td style="padding:8px 0;color:#94A3B8;font-size:11px;">${escapeHtml(proposalId)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94A3B8;font-weight:600;">Selected Package:</td>
          <td style="padding:8px 0;color:#FFFFFF;font-weight:700;">${escapeHtml(packageName)}</td>
        </tr>
        <tr style="border-top:1px solid #1E293B;">
          <td style="padding:10px 0 6px;color:#94A3B8;font-weight:600;">Total Build Investment:</td>
          <td style="padding:10px 0 6px;font-weight:700;color:#FFFFFF;font-size:14px;">${escapeHtml(formattedTotalBuild)}</td>
        </tr>
        ${formattedMonthlyCare ? `
        <tr>
          <td style="padding:6px 0;color:#94A3B8;font-weight:600;">Monthly Website Care:</td>
          <td style="padding:6px 0;color:#A5B4FC;font-weight:600;">${escapeHtml(formattedMonthlyCare)}/month</td>
        </tr>` : ''}
        ${formattedAnnualHosting ? `
        <tr>
          <td style="padding:6px 0;color:#94A3B8;font-weight:600;">Managed Annual Hosting:</td>
          <td style="padding:6px 0;color:#A5B4FC;font-weight:600;">${escapeHtml(formattedAnnualHosting)}/year</td>
        </tr>` : ''}
        ${formattedTotalYearOne ? `
        <tr style="border-top:1px solid #334155;">
          <td style="padding:10px 0;color:#34D399;font-weight:700;font-size:14px;">Total Year 1 Commitment:</td>
          <td style="padding:10px 0;font-weight:800;color:#34D399;font-size:16px;">${escapeHtml(formattedTotalYearOne)}</td>
        </tr>` : ''}
      </table>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${escapeHtml(directUrl)}" style="display:inline-block;background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);color:#FFFFFF !important;font-weight:700;font-size:14px;padding:14px 32px;border-radius:12px;text-decoration:none;box-shadow:0 4px 14px rgba(37,99,235,0.4);" target="_blank">Review & Accept Proposal &rarr;</a>
    </div>
    <div style="font-size:12px;color:#64748B;text-align:center;line-height:1.5;border-top:1px solid #334155;padding-top:20px;">
      This quote is locked for <strong>30 calendar days</strong>. We support instant M-Pesa STK push, credit/debit cards, and corporate bank transfer.<br>
      <span style="word-break:break-all;color:#38BDF8;font-size:11px;margin-top:8px;display:block;">${escapeHtml(directUrl)}</span>
    </div>

    ${renderEmailSecuritySealHtml(proposalCode)}
  </div>
  ${renderEmailCorporateFooterHtml()}
</body>
</html>`;
}

function isUsableEmailSecret(val: string | undefined | null): boolean {
  const clean = (val || '').trim();
  return clean.length > 0 && !clean.includes('CHANGE_ME');
}

export function isEmailTransportConfigured(): boolean {
  if (isUsableEmailSecret(process.env.RESEND_API_KEY)) return true;
  return (
    isUsableEmailSecret(process.env.SMTP_HOST) &&
    isUsableEmailSecret(process.env.SMTP_USER) &&
    isUsableEmailSecret(process.env.SMTP_PASS)
  );
}

async function sendEmail(to: string, subject: string, html: string, fallbackUrl: string): Promise<SendEmailResult> {
  const rawFrom = (process.env.SMTP_FROM || '').trim();
  const fromEmail = rawFrom
    ? rawFrom.includes('<')
      ? rawFrom
      : `BazionWeb <${rawFrom}>`
    : 'BazionWeb <noreply@bazionweb.com>';

  const plainText = fallbackUrl
    ? `${subject}\n\nOpen this secure link:\n${fallbackUrl}\n\nBazionWeb — support@bazionweb.com`
    : undefined;

  // 1. Check for Resend API Key
  const resendApiKey = isUsableEmailSecret(process.env.RESEND_API_KEY)
    ? process.env.RESEND_API_KEY!.trim()
    : '';
  let resendFallbackReason = '';
  if (resendApiKey) {
    const sendViaResend = async (sender: string) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: sender,
          to: [to],
          subject,
          html,
          ...(plainText ? { text: plainText } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { res, data };
    };

    try {
      let { res, data } = await sendViaResend(fromEmail);

      // If custom domain (e.g. bazionweb.com) is not verified in Resend yet,
      // automatically retry with Resend's default onboarding sender.
      if (!res.ok && res.status === 403 && !fromEmail.includes('onboarding@resend.dev')) {
        console.warn(`[Email] Custom sender (${fromEmail}) not verified in Resend yet; retrying via onboarding@resend.dev`);
        ({ res, data } = await sendViaResend('BazionWeb <onboarding@resend.dev>'));
      }

      if (res.ok) {
        console.log(`[Email] ✅ Delivered via Resend to ${to} (id: ${data.id})`);
        return { success: true, delivered: true, provider: 'resend' };
      }
      resendFallbackReason = typeof data?.message === 'string' ? data.message : '';
      console.warn(`[Email] Resend API error:`, data);
    } catch (err) {
      console.error(`[Email] Resend dispatch error:`, err);
    }
  }

  // 2. Check for SMTP credentials
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        html,
        ...(plainText ? { text: plainText } : {}),
      });

      console.log(`[Email] ✅ Delivered via SMTP (${smtpHost}) to ${to}`);
      return { success: true, delivered: true, provider: 'smtp' };
    } catch (err: unknown) {
      console.error(`[Email] SMTP dispatch error:`, err);
    }
  }

  // 3. Fallback when SMTP is not yet configured on this environment
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Email] ⚠️ No live SMTP or Resend credentials detected. ${subject} for ${to}:`);
    console.log(`[Email] 🔗 ${fallbackUrl}`);
  }

  return {
    success: true,
    delivered: false,
    provider: 'local-development',
    previewUrl: fallbackUrl,
    message: resendFallbackReason
      ? `Resend rejected live delivery (${resendFallbackReason}). Verify bazionweb.com in Resend Domains to send to any address.`
      : 'Live SMTP/Resend credentials not yet added to .env.local. Link generated for development.',
  };
}

export async function sendMagicLinkEmail(options: SendMagicLinkOptions): Promise<SendEmailResult> {
  const { to, magicLinkUrl } = options;
  return sendEmail(
    to,
    'Your BazionWeb Sign-In Link',
    generateMagicLinkEmailHtml(magicLinkUrl, to),
    magicLinkUrl,
  );
}

export async function sendClaimLinkEmail(options: SendClaimLinkOptions): Promise<SendEmailResult> {
  const { to, claimLinkUrl } = options;
  return sendEmail(
    to,
    'Claim your BazionWeb account',
    generateClaimLinkEmailHtml(claimLinkUrl, to),
    claimLinkUrl,
  );
}

export async function sendPasswordResetEmail(options: SendPasswordResetOptions): Promise<SendEmailResult> {
  const { to, resetLinkUrl } = options;
  return sendEmail(
    to,
    'Reset your BazionWeb password',
    generatePasswordResetEmailHtml(resetLinkUrl, to),
    resetLinkUrl,
  );
}

export async function sendContactInquiryEmail(options: ContactInquiryOptions): Promise<{
  teamNotification: SendEmailResult;
  clientConfirmation: SendEmailResult;
}> {
  const teamRecipient =
    process.env.LEADS_NOTIFICATION_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    'hello@bazionweb.com';
  const teamHtml = generateContactNotificationEmailHtml(options);
  const clientHtml = generateContactConfirmationEmailHtml(options);

  const [teamNotification, clientConfirmation] = await Promise.all([
    sendEmail(
      teamRecipient,
      `[New Lead Inquiry] ${options.clientName} - ${options.serviceInterest || 'General Inquiry'} (${options.leadId || 'Inquiry'})`,
      teamHtml,
      'https://bazionweb.com/contact',
    ),
    sendEmail(
      options.clientEmail,
      'Thank you for contacting BazionWeb — We received your inquiry',
      clientHtml,
      'https://bazionweb.com/contact',
    ),
  ]);

  return { teamNotification, clientConfirmation };
}

export async function sendQuoteSummaryEmail(options: QuoteSummaryOptions): Promise<SendEmailResult> {
  const html = generateQuoteSummaryEmailHtml(options);
  const proposalUrl =
    options.proposalUrl ||
    `https://bazionweb.com/quote?proposal=${encodeURIComponent(options.proposalCode)}`;
  return sendEmail(
    options.clientEmail,
    `Your BazionWeb Project Quote & Proposal (${options.proposalCode})`,
    html,
    proposalUrl,
  );
}

