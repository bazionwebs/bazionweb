import nodemailer from 'nodemailer';

interface SendMagicLinkOptions {
  to: string;
  magicLinkUrl: string;
}

interface SendEmailResult {
  success: boolean;
  delivered: boolean;
  provider?: string;
  error?: string;
  previewUrl?: string;
  message?: string;
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
      max-width: 540px;
      margin: 0 auto;
      background: #1E293B;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 40px 32px;
    }
    .brand {
      text-align: center;
      margin-bottom: 28px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: -0.02em;
    }
    .brand-title span {
      color: #2563EB;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background: rgba(37, 99, 235, 0.15);
      border: 1px solid rgba(37, 99, 235, 0.3);
      color: #60A5FA;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 8px;
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
      margin: 32px 0;
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
      padding-top: 24px;
      margin-top: 24px;
    }
    .url-fallback {
      word-break: break-all;
      color: #38BDF8;
      font-size: 11px;
      margin-top: 8px;
      display: block;
    }
    .footer {
      text-align: center;
      margin-top: 24px;
      font-size: 11px;
      color: #64748B;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">
      <div class="brand-title">Bazion<span>Web</span></div>
      <div class="badge">Client Operating Space</div>
    </div>
    <h2>Sign in to your client hub</h2>
    <p>
      We received a request to sign in to BazionWeb for <strong>${recipientEmail}</strong>.
      Click the secure button below to authenticate instantly.
    </p>
    <div class="btn-container">
      <a href="${magicLinkUrl}" class="btn" target="_blank">Sign In to Client Hub &rarr;</a>
    </div>
    <div class="subtext">
      This link is valid for <strong>15 minutes</strong> and can only be used once. If you did not request this login link, you can safely ignore this email.
      <span class="url-fallback">${magicLinkUrl}</span>
    </div>
  </div>
  <div class="footer">
    &copy; ${new Date().getFullYear()} Bazion Technologies Limited. Riverside Square, Nairobi, Kenya.<br>
    billing@bazionweb.com &bull; www.bazionweb.com
  </div>
</body>
</html>`;
}

export async function sendMagicLinkEmail(options: SendMagicLinkOptions): Promise<SendEmailResult> {
  const { to, magicLinkUrl } = options;
  const html = generateMagicLinkEmailHtml(magicLinkUrl, to);
  const subject = 'Your BazionWeb Sign-In Link';
  const fromEmail = process.env.SMTP_FROM || 'BazionWeb <noreply@bazionweb.com>';

  // 1. Check for Resend API Key
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`[Email] ✅ Delivered via Resend to ${to} (id: ${data.id})`);
        return { success: true, delivered: true, provider: 'resend' };
      }
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
      });

      console.log(`[Email] ✅ Delivered via SMTP (${smtpHost}) to ${to}`);
      return { success: true, delivered: true, provider: 'smtp' };
    } catch (err: unknown) {
      console.error(`[Email] SMTP dispatch error:`, err);
    }
  }

  // 3. Fallback when SMTP is not yet configured on this environment
  console.log(`[Email] ⚠️ No live SMTP or Resend credentials detected. Magic link for ${to}:`);
  console.log(`[Email] 🔗 ${magicLinkUrl}`);

  return {
    success: true,
    delivered: false,
    provider: 'local-development',
    previewUrl: magicLinkUrl,
    message: 'Live SMTP/Resend credentials not yet added to .env.local. Magic link generated for development.',
  };
}
