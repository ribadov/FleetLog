import { Resend } from "resend"

type PasswordResetMailParams = {
  to: string
  resetUrl: string
}

type InvoiceMailParams = {
  to: string
  invoiceNumber: string
  invoiceUrl: string
  subject?: string
  bodyText?: string
  pdfBuffer?: Buffer
  pdfFileName?: string
}

function getResend() {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is missing.")
  }

  return new Resend(apiKey)
}

function getFromAddress() {
  const from = process.env.RESEND_FROM

  if (!from) {
    throw new Error("RESEND_FROM is missing.")
  }

  return from
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: PasswordResetMailParams) {
  const resend = getResend()
  const from = getFromAddress()

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: "FleetLog Passwort zurücksetzen",
    text: `Du hast ein Zurücksetzen deines Passworts angefordert. Öffne diesen Link: ${resetUrl}\n\nDer Link ist 1 Stunde gültig.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Passwort zurücksetzen</h2>
        <p>Du hast ein Zurücksetzen deines FleetLog-Passworts angefordert.</p>
        <p>
          <a
            href="${escapeHtml(resetUrl)}"
            style="display:inline-block;background:#2563eb;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;"
          >
            Passwort zurücksetzen
          </a>
        </p>
        <p>Der Link ist 1 Stunde gültig.</p>
      </div>
    `,
  })

  if (error) {
    throw new Error(
      `Resend password reset email failed: ${error.message}`
    )
  }

  return data
}

export async function sendInvoiceEmail({
  to,
  invoiceNumber,
  invoiceUrl,
  subject,
  bodyText,
  pdfBuffer,
  pdfFileName,
}: InvoiceMailParams) {
  const resend = getResend()
  const from = getFromAddress()

  const finalSubject =
    subject?.trim() || `FleetLog Rechnung ${invoiceNumber}`

  const finalBody =
    bodyText?.trim() ||
    `Eine neue Rechnung (${invoiceNumber}) wurde für dich erstellt.`

  const htmlBody = finalBody
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("")

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: finalSubject,
    text: `${finalBody}\n\nÖffne sie hier: ${invoiceUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>${escapeHtml(finalSubject)}</h2>

        ${htmlBody}

        <p>
          <a
            href="${escapeHtml(invoiceUrl)}"
            style="display:inline-block;background:#2563eb;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;"
          >
            Rechnung öffnen
          </a>
        </p>

        <p>Die Rechnung ist als PDF im Anhang enthalten.</p>
      </div>
    `,
    attachments: pdfBuffer
      ? [
          {
            filename: pdfFileName || `Rechnung-${invoiceNumber}.pdf`,
            content: pdfBuffer,
          },
        ]
      : [],
  })

  if (error) {
    throw new Error(`Resend invoice email failed: ${error.message}`)
  }

  return data
}