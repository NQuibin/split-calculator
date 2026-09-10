import { Email } from "@convex-dev/auth/providers/Email";

/** Email verification factor, used only through PasswordOTP. */

/** Codes are short-lived - long enough to switch to an email client and back, not long enough to sit in an inbox. */
const CODE_LIFETIME_SECONDS = 15 * 60;

const CODE_LENGTH = 6;

/**
 * A uniformly random numeric code.
 *
 * Rejection sampling rather than `% 10`: 2^32 isn't a multiple of 10, so the
 * modulo would bias the low digits. The bias is far too small to be
 * exploitable at this length, but the loop is cheap and avoids the question.
 */
function generateCode(): string {
  const digits = new Uint32Array(CODE_LENGTH);
  const limit = Math.floor(0xffffffff / 10) * 10;
  let code = "";
  while (code.length < CODE_LENGTH) {
    crypto.getRandomValues(digits);
    for (const value of digits) {
      if (code.length === CODE_LENGTH) break;
      if (value < limit) code += (value % 10).toString();
    }
  }
  return code;
}

/**
 * The from-address. Resend's `onboarding@resend.dev` sandbox only delivers to
 * the address that owns the Resend account, which is enough to exercise the
 * flow end to end but will silently fail for anyone else - set AUTH_EMAIL to a
 * verified-domain sender before this reaches real users.
 */
function senderAddress(): string {
  return process.env.AUTH_EMAIL ?? "SumShare <onboarding@resend.dev>";
}

function renderEmail(code: string) {
  // Inline styles and a table shell: email clients strip <style> blocks and
  // have patchy flexbox support. Colours mirror src/globals.css.
  const text = `Your SumShare sign-in code is ${code}\n\nIt expires in 15 minutes. If you didn't ask for it, you can ignore this email.`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#edf1e4;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#edf1e4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:420px;background-color:#f7f5ec;border:1px solid #ccd5bd;border-radius:12px;padding:32px;">
            <tr>
              <td style="font-family:'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e2a22;">
                <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#2f4a3c;">SumShare</p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#4b5a4f;">Enter this code to finish signing in.</p>
                <p style="margin:0 0 24px;font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:600;letter-spacing:0.32em;color:#1e2a22;background-color:#edf1e4;border:1px solid #ccd5bd;border-radius:8px;padding:16px;text-align:center;">${code}</p>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#4b5a4f;">It expires in 15 minutes. If you didn't ask for it, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, text };
}

export const ResendOTP = Email({
  id: "resend-otp",
  maxAge: CODE_LIFETIME_SECONDS,
  generateVerificationToken: async () => generateCode(),
  async sendVerificationRequest({ identifier: email, token }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey === undefined) {
      throw new Error("RESEND_API_KEY is not set on this deployment - run `npx convex env set RESEND_API_KEY <key>`");
    }

    const { html, text } = renderEmail(token);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderAddress(),
        to: [email],
        subject: `${token} is your SumShare code`,
        html,
        text,
      }),
    });

    if (!response.ok) {
      // Surfaced in the Convex logs, not to the client - `signIn` reports a
      // generic failure so a bad key or an unverified domain doesn't leak out.
      throw new Error(`Resend rejected the email (${response.status}): ${await response.text()}`);
    }
  },
});
