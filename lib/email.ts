import { headers } from "next/headers";

// Transactional email through Resend's REST API. Called with fetch rather
// than the SDK so there's no extra dependency in the serverless bundle.
//
// Two rules this module keeps:
//  1. Sending must NEVER block the action that triggered it — an account
//     is still created if the mail fails; the caller shows the password on
//     screen instead.
//  2. A password is never written to a log. Only the outcome is returned.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface MailResult {
  sent: boolean;
  error?: string;
}

/** True when the environment is configured to actually send mail. */
export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

/**
 * The public origin of this deployment, taken from the request headers so
 * no extra environment variable is needed. APP_URL overrides it if set.
 */
export async function appOrigin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function credentialsHtml(p: {
  fullName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
  isReset: boolean;
}): string {
  const name = escapeHtml(p.fullName);
  const email = escapeHtml(p.email);
  const pass = escapeHtml(p.tempPassword);
  const url = escapeHtml(p.loginUrl);
  const heading = p.isReset ? "Your password has been reset" : "Your BMTC account is ready";
  const intro = p.isReset
    ? "An administrator has reset your password. Your previous password no longer works."
    : "An account has been created for you on the BMTC Quotation &amp; LPO Control system.";

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a2233;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e7f0;border-radius:10px;padding:28px;">
    <div style="font-weight:800;font-size:20px;letter-spacing:.5px;">BMTC</div>
    <div style="font-size:12px;color:#8a95a8;margin-bottom:22px;">Quotation &amp; LPO Control</div>

    <h1 style="font-size:19px;margin:0 0 10px;">${heading}</h1>
    <p style="font-size:14px;line-height:1.6;color:#4a566b;margin:0 0 20px;">
      Hello ${name},<br />${intro}
    </p>

    <div style="background:#f0f3f8;border:1px solid #e2e7f0;border-radius:8px;padding:16px;margin-bottom:20px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a95a8;margin-bottom:4px;">Email</div>
      <div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:15px;margin-bottom:14px;">${email}</div>
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a95a8;margin-bottom:4px;">One-time password</div>
      <div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:19px;font-weight:700;letter-spacing:1px;">${pass}</div>
    </div>

    <a href="${url}" style="display:inline-block;background:#1f5fd6;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:8px;">Sign in</a>

    <p style="font-size:13px;line-height:1.6;color:#4a566b;margin:22px 0 0;">
      You will be asked to choose your own password the first time you sign in.
      This one-time password stops working at that point.
    </p>
    <p style="font-size:12px;line-height:1.6;color:#8a95a8;margin:14px 0 0;border-top:1px solid #e2e7f0;padding-top:14px;">
      Keep these details to yourself — never share your password with anyone,
      including IT. If you were not expecting this email, tell your administrator.
    </p>
  </div>
</body></html>`;
}

function credentialsText(p: {
  fullName: string; email: string; tempPassword: string; loginUrl: string; isReset: boolean;
}): string {
  return [
    `Hello ${p.fullName},`,
    "",
    p.isReset
      ? "An administrator has reset your password. Your previous password no longer works."
      : "An account has been created for you on the BMTC Quotation & LPO Control system.",
    "",
    `Sign in: ${p.loginUrl}`,
    `Email: ${p.email}`,
    `One-time password: ${p.tempPassword}`,
    "",
    "You will be asked to choose your own password the first time you sign in.",
    "Never share your password with anyone, including IT.",
  ].join("\n");
}

/**
 * Email a new or reset one-time password. Returns the outcome instead of
 * throwing, so the caller can carry on and show the password on screen if
 * delivery fails.
 */
export async function sendCredentialsEmail(p: {
  to: string;
  fullName: string;
  tempPassword: string;
  loginUrl: string;
  isReset: boolean;
}): Promise<MailResult> {
  if (!mailConfigured()) {
    return { sent: false, error: "Email is not configured." };
  }

  const body = {
    from: process.env.MAIL_FROM,
    to: [p.to],
    subject: p.isReset
      ? "BMTC — your password has been reset"
      : "BMTC — your account details",
    html: credentialsHtml({ ...p, email: p.to }),
    text: credentialsText({ ...p, email: p.to }),
  };

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      // Never let a slow provider hold an admin's request open.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // Log the failure reason only — never the password.
      console.error("Credential email failed:", res.status, detail.slice(0, 300));
      return { sent: false, error: `Mail provider returned ${res.status}.` };
    }
    return { sent: true };
  } catch (e) {
    console.error("Credential email error:", e instanceof Error ? e.message : e);
    return { sent: false, error: "Could not reach the mail provider." };
  }
}
