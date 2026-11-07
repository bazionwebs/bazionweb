import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface AuthMailSendResult {
  success: boolean;
  delivered: boolean;
  provider?: string;
  message?: string;
}

function escapeHtml(raw: string): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isUsableSecret(val: string | undefined | null): boolean {
  const clean = (val || '').trim();
  return clean.length > 0 && !clean.includes('CHANGE_ME');
}

export function sanitizeRedirectPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return null;
  }
  try {
    const parsed = new URL(trimmed, 'https://bazionweb.local');
    if (parsed.origin !== 'https://bazionweb.local') return null;
    if (
      parsed.pathname.startsWith('/portal/login') ||
      parsed.pathname.startsWith('/admin/login')
    ) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

@Injectable()
export class AuthMailService {
  private readonly logger = new Logger(AuthMailService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const resendKey = this.config.get<string>('RESEND_API_KEY');
    if (isUsableSecret(resendKey)) return true;

    const smtpHost = this.config.get<string>('SMTP_HOST');
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPass = this.config.get<string>('SMTP_PASS');
    return isUsableSecret(smtpHost) && isUsableSecret(smtpUser) && isUsableSecret(smtpPass);
  }

  resolveFrontendOrigin(): string {
    const raw =
      this.config.get<string>('FRONTEND_URL') ||
      this.config.get<string>('NEXT_PUBLIC_APP_URL') ||
      'https://bazionweb.com';
    const match = String(raw).trim().match(/https?:\/\/[^\s"'<>]+/i);
    if (!match) return 'https://bazionweb.com';
    try {
      return new URL(match[0]).origin;
    } catch {
      return 'https://bazionweb.com';
    }
  }

  private renderAuthCardHtml(opts: {
    badge: string;
    heading: string;
    bodyHtml: string;
    ctaLabel: string;
    ctaUrl: string;
    footerNote: string;
    docRef: string;
  }): string {
    const year = new Date().getFullYear();
    const safeUrl = escapeHtml(opts.ctaUrl);
    const logoUrl = `${escapeHtml(this.resolveFrontendOrigin())}/brand/logo-with-background.png`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(opts.heading)}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#0B0F17;color:#F8FAFC;margin:0;padding:32px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#1E293B;border:1px solid #334155;border-radius:16px;padding:36px 32px;box-shadow:0 10px 30px rgba(0,0,0,0.4);">
    <div style="border-bottom:2px solid #334155;padding-bottom:20px;margin-bottom:24px;text-align:center;">
      <div style="height:3px;background:linear-gradient(90deg,#0F172A 0%,#2563EB 60%,#10B981 100%);border-radius:2px;margin-bottom:18px;"></div>
      <div style="margin-bottom:10px;">
        <img src="${logoUrl}" alt="BazionWeb – Build, Host n Grow" width="96" height="86" style="display:inline-block;height:76px;width:auto;border-radius:8px;border:1px solid #334155;background:#EBEBEB;" />
      </div>
      <div style="font-size:24px;font-weight:900;color:#FFFFFF;letter-spacing:-0.02em;">Bazion<span style="color:#38BDF8;">Web</span></div>
      <div style="margin-top:10px;">
        <span style="display:inline-block;padding:4px 14px;background:rgba(37,99,235,0.15);border:1px solid rgba(37,99,235,0.35);color:#60A5FA;border-radius:9999px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;">
          ${escapeHtml(opts.badge)}
        </span>
      </div>
    </div>
    <h2 style="font-size:20px;font-weight:700;color:#FFFFFF;margin:0 0 12px;text-align:center;">${escapeHtml(opts.heading)}</h2>
    <p style="font-size:14px;color:#94A3B8;line-height:1.6;margin:0 0 24px;text-align:center;">${opts.bodyHtml}</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);color:#FFFFFF;font-weight:700;font-size:14px;padding:14px 32px;border-radius:12px;text-decoration:none;box-shadow:0 4px 14px rgba(37,99,235,0.4);" target="_blank">${escapeHtml(opts.ctaLabel)} &rarr;</a>
    </div>
    <div style="font-size:12px;color:#64748B;text-align:center;line-height:1.5;border-top:1px solid #334155;padding-top:20px;margin-top:24px;">
      ${escapeHtml(opts.footerNote)}
      <span style="word-break:break-all;color:#38BDF8;font-size:11px;margin-top:8px;display:block;">${safeUrl}</span>
    </div>
    <div style="margin-top:24px;font-size:10px;color:#94A3B8;text-align:center;">
      Ref: ${escapeHtml(opts.docRef)}
    </div>
  </div>
  <div style="font-size:11px;color:#64748B;text-align:center;line-height:1.6;margin-top:24px;">
    &copy; ${year} BAZION WEB (BRS Reg: BN-DLSZOZ6O &bull; KRA PIN: A006926734I)<br>
    billing@bazionweb.com &bull; support@bazionweb.com &bull; www.bazionweb.com
  </div>
</body>
</html>`;
  }

  private async dispatchEmail(to: string, subject: string, html: string): Promise<AuthMailSendResult> {
    const rawFrom = (this.config.get<string>('SMTP_FROM') || '').trim();
    const fromEmail = rawFrom
      ? rawFrom.includes('<')
        ? rawFrom
        : `BazionWeb <${rawFrom}>`
      : 'BazionWeb <noreply@bazionweb.com>';

    const resendApiKey = (this.config.get<string>('RESEND_API_KEY') || '').trim();
    let lastError = '';

    if (isUsableSecret(resendApiKey)) {
      const sendViaResend = async (sender: string) => {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from: sender, to: [to], subject, html }),
          signal: AbortSignal.timeout(10000),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        return { res, data };
      };

      try {
        let { res, data } = await sendViaResend(fromEmail);
        if (!res.ok && res.status === 403 && !fromEmail.includes('onboarding@resend.dev')) {
          this.logger.warn(
            `Custom sender (${fromEmail}) not verified in Resend yet; retrying via onboarding@resend.dev`,
          );
          ({ res, data } = await sendViaResend('BazionWeb <onboarding@resend.dev>'));
        }

        if (res.ok) {
          this.logger.log(`Delivered "${subject}" via Resend to ${to} (id: ${String(data.id ?? '')})`);
          return { success: true, delivered: true, provider: 'resend' };
        }
        lastError =
          typeof data?.message === 'string'
            ? data.message
            : `Resend HTTP ${res.status}`;
        this.logger.warn(`Resend API rejected email to ${to}: ${lastError}`);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        this.logger.error(`Resend dispatch failed for ${to}: ${lastError}`);
      }
    }

    const smtpHost = (this.config.get<string>('SMTP_HOST') || '').trim();
    const smtpUser = (this.config.get<string>('SMTP_USER') || '').trim();
    const smtpPass = (this.config.get<string>('SMTP_PASS') || '').trim();

    if (isUsableSecret(smtpHost) && isUsableSecret(smtpUser) && isUsableSecret(smtpPass)) {
      try {
        const port = Number(this.config.get<string>('SMTP_PORT')) || 587;
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port,
          secure: port === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });
        await transporter.sendMail({ from: fromEmail, to, subject, html });
        this.logger.log(`Delivered "${subject}" via SMTP (${smtpHost}) to ${to}`);
        return { success: true, delivered: true, provider: 'smtp' };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        this.logger.error(`SMTP dispatch failed for ${to}: ${lastError}`);
      }
    }

    return {
      success: false,
      delivered: false,
      provider: 'unconfigured',
      message: lastError
        ? `Email provider rejected delivery (${lastError}).`
        : 'Outbound email credentials (RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS) are not configured.',
    };
  }

  async sendMagicLinkEmail(to: string, magicLinkUrl: string): Promise<AuthMailSendResult> {
    const html = this.renderAuthCardHtml({
      badge: 'Client Operating Space',
      heading: 'Sign in to your client hub',
      bodyHtml: `We received a request to sign in to BazionWeb for <strong>${escapeHtml(to)}</strong>. Click the secure button below to authenticate instantly.`,
      ctaLabel: 'Sign In to Client Hub',
      ctaUrl: magicLinkUrl,
      footerNote:
        'This link is valid for 15 minutes and can only be used once. If you did not request this login link, you can safely ignore this email.',
      docRef: 'AUTH-MAGIC-LINK',
    });
    return this.dispatchEmail(to, 'Your BazionWeb Sign-In Link', html);
  }

  async sendClaimLinkEmail(to: string, claimLinkUrl: string): Promise<AuthMailSendResult> {
    const html = this.renderAuthCardHtml({
      badge: 'Payment Confirmed · Activation',
      heading: 'Claim your client hub',
      bodyHtml: `Your payment is confirmed for <strong>${escapeHtml(to)}</strong>. Open the secure link below to set your password and activate your workspace.`,
      ctaLabel: 'Claim My Account',
      ctaUrl: claimLinkUrl,
      footerNote:
        'This link is valid for 15 minutes and can only be used once. If you did not make this payment, ignore this message or contact billing@bazionweb.com.',
      docRef: 'AUTH-ACCOUNT-CLAIM',
    });
    return this.dispatchEmail(to, 'Claim your BazionWeb account', html);
  }

  async sendPasswordResetEmail(to: string, resetLinkUrl: string): Promise<AuthMailSendResult> {
    const html = this.renderAuthCardHtml({
      badge: 'Secure Password Recovery',
      heading: 'Reset your password',
      bodyHtml: `We received a request to reset the password for <strong>${escapeHtml(to)}</strong>. Open the secure link below to choose a new password.`,
      ctaLabel: 'Choose a New Password',
      ctaUrl: resetLinkUrl,
      footerNote:
        'This link is valid for 15 minutes and can only be used once. If you did not request this, ignore this email — your password stays unchanged.',
      docRef: 'AUTH-PASSWORD-RESET',
    });
    return this.dispatchEmail(to, 'Reset your BazionWeb password', html);
  }
}

