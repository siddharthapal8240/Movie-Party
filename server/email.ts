import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
      throw new Error("GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN must be set");
    }
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.GMAIL_USER,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      },
    });
  }
  return transporter;
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtpEmail(to: string, code: string, firstName: string) {
  const digits = code.split("");

  await getTransporter().sendMail({
    from: `"Movie Party Team" <${process.env.GMAIL_USER}>`,
    to,
    subject: `${code} is your Movie Party verification code`,
    html: `
<!DOCTYPE html>
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
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px 40px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:8px;display:inline-block;text-align:center;line-height:36px;">
                      <span style="font-size:18px;">&#127910;</span>
                    </div>
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
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">
                Hey ${firstName}! &#128075;
              </h1>
              <p style="margin:0;font-size:15px;color:#52525b;line-height:1.6;">
                Thanks for signing up. Enter this code to verify your email and start watching together.
              </p>
            </td>
          </tr>

          <!-- OTP Code -->
          <tr>
            <td style="padding:8px 40px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  ${digits.map((d) => `
                  <td style="padding:0 4px;">
                    <div style="width:48px;height:56px;background:#f4f4f5;border:2px solid #e4e4e7;border-radius:10px;text-align:center;line-height:56px;font-size:28px;font-weight:700;color:#18181b;font-family:'SF Mono',Monaco,Consolas,monospace;">
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
                &#9200; This code expires in <strong style="color:#71717a;">10 minutes</strong>
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
                &#128274; If you didn't create a Movie Party account, you can safely ignore this email.
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
</html>`,
  });
}

export async function sendPasswordResetEmail(to: string, code: string, firstName: string) {
  const digits = code.split("");

  await getTransporter().sendMail({
    from: `"Movie Party Team" <${process.env.GMAIL_USER}>`,
    to,
    subject: `${code} — Reset your Movie Party password`,
    html: `
<!DOCTYPE html>
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
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px 40px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:8px;display:inline-block;text-align:center;line-height:36px;">
                      <span style="font-size:18px;">&#127910;</span>
                    </div>
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
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">
                Password Reset &#128272;
              </h1>
              <p style="margin:0;font-size:15px;color:#52525b;line-height:1.6;">
                Hey ${firstName}, we received a request to reset your password. Use the code below to set a new one.
              </p>
            </td>
          </tr>

          <!-- OTP Code -->
          <tr>
            <td style="padding:8px 40px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  ${digits.map((d) => `
                  <td style="padding:0 4px;">
                    <div style="width:48px;height:56px;background:#f4f4f5;border:2px solid #e4e4e7;border-radius:10px;text-align:center;line-height:56px;font-size:28px;font-weight:700;color:#18181b;font-family:'SF Mono',Monaco,Consolas,monospace;">
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
                &#9200; This code expires in <strong style="color:#71717a;">10 minutes</strong>
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
                &#128274; If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
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
</html>`,
  });
}
