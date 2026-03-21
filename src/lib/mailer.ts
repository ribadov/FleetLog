import nodemailer from "nodemailer"

type PasswordResetMailParams = {
  to: string
  resetUrl: string
}

function getSmtpPort() {
  const rawPort = process.env.SMTP_PORT
  if (!rawPort) return 587
  const parsed = Number(rawPort)
  return Number.isNaN(parsed) ? 587 : parsed
}

function createTransporter() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error("SMTP configuration is missing. Please set SMTP_HOST, SMTP_USER and SMTP_PASS.")
  }

  return nodemailer.createTransport({
    host,
    port: getSmtpPort(),
    secure: getSmtpPort() === 465,
    auth: {
      user,
      pass,
    },
  })
}

export async function sendPasswordResetEmail({ to, resetUrl }: PasswordResetMailParams) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER

  if (!from) {
    throw new Error("SMTP_FROM or SMTP_USER must be configured.")
  }

  const transporter = createTransporter()

  await transporter.sendMail({
    from,
    to,
    subject: "FleetLog Passwort zurücksetzen",
    text: `Du hast ein Zurücksetzen deines Passworts angefordert. Öffne diesen Link: ${resetUrl}\n\nDer Link ist 1 Stunde gültig.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Passwort zurücksetzen</h2>
        <p>Du hast ein Zurücksetzen deines FleetLog-Passworts angefordert.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;">
            Passwort zurücksetzen
          </a>
        </p>
        <p>Oder öffne diesen Link direkt:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Der Link ist 1 Stunde gültig.</p>
      </div>
    `,
  })
}
