import { google } from "googleapis";

function getGmailClient() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
    throw new Error("GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN must be set");
  }
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

function buildRawEmail(to: string, subject: string, html: string): string {
  const from = `"Movie Party" <${process.env.GMAIL_FROM || process.env.GMAIL_USER}>`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    html,
  ];
  const raw = lines.join("\r\n");
  return Buffer.from(raw).toString("base64url");
}

async function sendEmail(to: string, subject: string, html: string) {
  const gmail = getGmailClient();
  const raw = buildRawEmail(to, subject, html);
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function otpHtml(firstName: string, code: string, bodyText: string) {
  const digits = code.split("");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:#1a73e8; padding: 32px 40px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffffff"><path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v12h16V6H4zm2 2l5 3.5L6 15V8z" /></svg>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Movie Party</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 20px;">
              ${bodyText}
            </td>
          </tr>

          <!-- OTP Code -->
          <tr>
            <td style="padding:8px 40px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  ${digits.map((d) => `
                  <td style="padding:0 4px;">
                    <div style="width:48px;height:56px;background:#e8f0fe;border:2px solid #1a73e8;border-radius:10px;text-align:center;line-height:56px;font-size:28px;font-weight:700;color:#1a73e8;font-family:'SF Mono',Monaco,Consolas,monospace;">
                      ${d}
                    </div>
                  </td>`).join("")}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Expiry notice -->
          <tr>
            <td style="padding:16px 40px 32px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#a1a1aa;">
                &#9200; This code expires in <strong style="color:#1a73e8;">10 minutes</strong>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:#e4e4e7;"></div>
            </td>
          </tr>

          <!-- Security note -->
          <tr>
            <td style="padding:24px 40px;">
              <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.5;">
                &#128274; If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fafafa;padding:20px 40px;border-top:1px solid #f4f4f5;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                Movie Party Team &mdash; Watch movies together
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#d4d4d8;">
                This is an automated email. Please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOtpEmail(to: string, code: string, firstName: string) {
  const bodyText = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">
                Hey ${firstName}! &#128075;
              </h1>
              <p style="margin:0;font-size:15px;color:#52525b;line-height:1.6;">
                Thanks for signing up. Enter this code to verify your email and start watching together.
              </p>`;
  await sendEmail(to, `${code} is your Movie Party verification code`, otpHtml(firstName, code, bodyText));
}

export async function sendPasswordResetEmail(to: string, code: string, firstName: string) {
  const bodyText = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">
                Password Reset &#128272;
              </h1>
              <p style="margin:0;font-size:15px;color:#52525b;line-height:1.6;">
                Hey ${firstName}, we received a request to reset your password. Use the code below to set a new one.
              </p>`;
  await sendEmail(to, `${code} — Reset your Movie Party password`, otpHtml(firstName, code, bodyText));
}
