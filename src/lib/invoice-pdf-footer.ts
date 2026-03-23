import QRCode from "qrcode"

type SenderProfile = {
  name?: string | null
  companyName?: string | null
  bankName?: string | null
  bankAccountHolder?: string | null
  iban?: string | null
  bic?: string | null
}

type InvoicePdfFooterInput = {
  invoiceNumber: string
  createdAt: Date
  transports: Array<{ price: number }>
  workspace?: {
    manager?: SenderProfile | null
  } | null
  sentBy?: SenderProfile | null
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("de-DE").format(value)
}

function sanitizeEpcLine(value: string, maxLength: number) {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, maxLength)
}

function buildSepaEpcPayload(params: {
  bic?: string | null
  name: string
  iban: string
  amountEur: number
  remittanceText: string
}) {
  const bic = sanitizeEpcLine((params.bic ?? "").replace(/\s+/g, ""), 11)
  const name = sanitizeEpcLine(params.name, 70)
  const iban = sanitizeEpcLine(params.iban.replace(/\s+/g, ""), 34)
  const amount = `EUR${Math.max(params.amountEur, 0).toFixed(2)}`
  const remittanceText = sanitizeEpcLine(params.remittanceText, 140)

  return [
    "BCD",
    "002",
    "1",
    "SCT",
    bic,
    name,
    iban,
    amount,
    "",
    "",
    remittanceText,
    "",
  ].join("\n")
}

export async function buildInvoiceFooterHtml(invoice: InvoicePdfFooterInput) {
  const senderProfile = invoice.workspace?.manager || invoice.sentBy
  const bankName = senderProfile?.bankName || "—"
  const bankAccountHolder = senderProfile?.bankAccountHolder || "—"
  const iban = senderProfile?.iban || "—"
  const bic = senderProfile?.bic || "—"

  const taxRate = 0.19
  const netTotal = invoice.transports.reduce((sum, transport) => sum + transport.price, 0)
  const grossTotal = netTotal * (1 + taxRate)

  const paymentRecipient =
    senderProfile?.bankAccountHolder ??
    senderProfile?.companyName ??
    senderProfile?.name ??
    ""
  const paymentIban = senderProfile?.iban ?? ""
  const paymentBic = senderProfile?.bic ?? ""
  const remittance = `Rechnung ${invoice.invoiceNumber}, ${formatDate(invoice.createdAt)}, ${grossTotal.toFixed(2)} EUR`

  let qrCellHtml = ""

  if (paymentRecipient && paymentIban) {
    const sepaPayload = buildSepaEpcPayload({
      bic: paymentBic,
      name: paymentRecipient,
      iban: paymentIban,
      amountEur: grossTotal,
      remittanceText: remittance,
    })

    const sepaQrCodeDataUrl = await QRCode.toDataURL(sepaPayload, {
      margin: 1,
      width: 72,
      errorCorrectionLevel: "M",
    })

    qrCellHtml = `
      <td style="width: 66px; padding-left: 4px; vertical-align: top; text-align: center;">
        <img src="${sepaQrCodeDataUrl}" alt="SEPA QR-Code" style="width: 56px; height: 56px; border-radius: 4px; border: 1px solid #e5e7eb; background: #ffffff; padding: 2px; box-sizing: border-box;" />
        <div style="font-size: 9px; margin-top: 1px; color: #64748b; line-height: 1;">SEPA QR</div>
      </td>
    `
  }

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #64748b; width: calc(100% - 16mm); margin: 0 auto; box-sizing: border-box; padding: 2px 0 2px 3mm; line-height: 1.1;">
      <table role="presentation" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
        <tr>
          <td style="width: 61%; vertical-align: top; padding-right: 8px;">
            <div>Diese Rechnung wurde automatisiert mit FleetLog erstellt, einer Logistik-Anwendung der KARR Logistik GmbH. Für weitere Informationen, besuchen Sie: www.karr-logistik.com.</div>
          </td>
          <td style="width: 39%; vertical-align: top; border-left: 1px solid #e5e7eb; padding-left: 8px;">
            <table role="presentation" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
              <tr>
                <td style="vertical-align: top; white-space: nowrap; font-size: 10px; line-height: 1.1; color: #64748b;">
                  <div>Bank: ${escapeHtml(bankName)}</div>
                  <div>Kontoinhaber: ${escapeHtml(bankAccountHolder)}</div>
                  <div>IBAN: ${escapeHtml(iban)}</div>
                  <div>BIC: ${escapeHtml(bic)}</div>
                </td>
                ${qrCellHtml}
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `
}
