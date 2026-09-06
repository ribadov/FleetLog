import { google } from "googleapis";
import MailComposer from "nodemailer/lib/mail-composer";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

function getGmailClient() {
  if (
    !GMAIL_USER ||
    !GMAIL_CLIENT_ID ||
    !GMAIL_CLIENT_SECRET ||
    !GMAIL_REFRESH_TOKEN
  ) {
    throw new Error(
      "Missing Gmail configuration. Required: GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN"
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: GMAIL_REFRESH_TOKEN,
  });

  return google.gmail({
    version: "v1",
    auth: oauth2Client,
  });
}

async function sendGmailMessage({
  to,
  subject,
  text,
  html,
  attachments,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}) {
  if (!GMAIL_USER) {
    throw new Error("GMAIL_USER is not configured");
  }

  const mail = new MailComposer({
    from: GMAIL_USER,
    to,
    subject,
    text,
    html,
    attachments: attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType || "application/octet-stream",
    })),
  });

  const message = await mail.compile().build();

  // Gmail API expects the complete RFC 2822 message
  // encoded using base64url.
  const raw = message.toString("base64url");

  const gmail = getGmailClient();

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
    },
  });

  return response.data;
}

export async function sendInvoiceEmail({
  to,
  invoiceNumber,
  invoiceUrl,
  subject,
  bodyText,
  pdfBuffer,
  pdfFileName,
}: {
  to: string;
  invoiceNumber: string;
  invoiceUrl: string;
  subject: string;
  bodyText: string;
  pdfBuffer?: Buffer;
  pdfFileName?: string;
}) {
  const html = `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.5;">
    ${bodyText
      .split("\n")
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("")}

    <p>
      <a
        href="${escapeHtml(invoiceUrl)}"
        style="
          display: inline-block;
          padding: 10px 16px;
          background: #111827;
          color: white;
          text-decoration: none;
          border-radius: 6px;
        "
      >
        Rechnung öffnen
      </a>
    </p>

    <p>
      Die Rechnung <strong>${escapeHtml(invoiceNumber)}</strong>
      ist dieser E-Mail als PDF beigefügt.
    </p>
  </body>
</html>
`;

  const attachments =
    pdfBuffer && pdfFileName
      ? [
          {
            filename: pdfFileName,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ]
      : undefined;

  try {
    const result = await sendGmailMessage({
      to,
      subject,
      text: bodyText,
      html,
      attachments,
    });

    console.log("[Gmail] Invoice email sent", {
      invoiceNumber,
      to,
      messageId: result.id,
      threadId: result.threadId,
    });

    return result;
  } catch (error) {
    console.error("[Gmail] Invoice email failed", {
      invoiceNumber,
      to,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : error,
    });

    throw error;
  }
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string;
  resetUrl: string;
}) {
  const subject = "FleetLog Passwort zurücksetzen";

  const bodyText = `Hallo,

bitte klicke auf den folgenden Link, um dein FleetLog-Passwort zurückzusetzen:

${resetUrl}

Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.

Viele Grüße
KARR Logistik GmbH`;

  const html = `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.5;">
    <p>Hallo,</p>

    <p>
      bitte klicke auf den folgenden Link, um dein FleetLog-Passwort
      zurückzusetzen:
    </p>

    <p>
      <a href="${escapeHtml(resetUrl)}">
        Passwort zurücksetzen
      </a>
    </p>

    <p>
      Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail
      ignorieren.
    </p>

    <p>
      Viele Grüße<br />
      KARR Logistik GmbH
    </p>
  </body>
</html>
`;

  return sendGmailMessage({
    to,
    subject,
    text: bodyText,
    html,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}