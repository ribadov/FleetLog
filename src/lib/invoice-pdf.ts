import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"

type InvoiceTransport = {
  date: Date
  orderNumber: string | null
  jobNumber: string | null
  containerSize: string
  fromPlace: string
  toPlace: string
  notes: string | null
  isIMO: boolean
  price: number
}

type PartyInfo = {
  name: string
  companyName?: string | null
  companyStreet?: string | null
  companyHouseNumber?: string | null
  companyPostalCode?: string | null
  companyCity?: string | null
  companyCountry?: string | null
  vatId?: string | null
  taxNumber?: string | null
  bankName?: string | null
  bankAccountHolder?: string | null
  iban?: string | null
  bic?: string | null
}

type InvoicePdfParams = {
  invoiceNumber: string
  createdAt: Date
  sentAt?: Date | null
  recipientEmail: string
  sender: PartyInfo
  recipient: PartyInfo
  transports: InvoiceTransport[]
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("de-DE").format(value)
}

function formatCurrency(value: number) {
  const formatted = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

  return `${formatted} EUR`
}

function containerLabel(size: string) {
  return size.replace("SIZE_", "") + " ft"
}

function toPdfSafeText(value: string) {
  return value
    .replaceAll("→", "->")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("…", "...")
    .replaceAll("\u00A0", " ")
    .replaceAll(/[\u2018\u2019]/g, "'")
    .replaceAll(/[\u201C\u201D]/g, '"')
    .replaceAll(/[^\x20-\x7E\xA0-\xFF]/g, "?")
}

function compact(value: string | null | undefined) {
  return value && value.trim() ? value.trim() : "-"
}

function line(value: string, maxLength = 120) {
  return toPdfSafeText(value).slice(0, maxLength)
}

function drawText(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size = 10, bold = false) {
  page.drawText(line(text), {
    x,
    y,
    size,
    font,
    color: bold ? rgb(0.12, 0.12, 0.12) : rgb(0.2, 0.2, 0.2),
  })
}

function drawTableHeader(page: PDFPage, fontBold: PDFFont, y: number) {
  drawText(page, fontBold, "Datum", 30, y, 8)
  drawText(page, fontBold, "Containernr.", 80, y, 8)
  drawText(page, fontBold, "Auftragsnr.", 145, y, 8)
  drawText(page, fontBold, "Container", 205, y, 8)
  drawText(page, fontBold, "Von", 250, y, 8)
  drawText(page, fontBold, "Nach", 330, y, 8)
  drawText(page, fontBold, "Bemerkung", 410, y, 8)
  drawText(page, fontBold, "Netto", 525, y, 8)
}

export async function buildInvoicePdfBuffer(params: InvoicePdfParams) {
  const doc = await PDFDocument.create()
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageSize: [number, number] = [595.28, 841.89]
  let page = doc.addPage(pageSize)
  const { width } = page.getSize()

  const taxRate = 0.19
  const netTotal = params.transports.reduce((sum, transport) => sum + transport.price, 0)
  const taxTotal = netTotal * taxRate
  const grossTotal = netTotal + taxTotal
  const dueBase = params.sentAt ?? params.createdAt
  const dueDate = new Date(dueBase.getTime() + 14 * 24 * 60 * 60 * 1000)

  let y = 806

  drawText(page, fontBold, "RECHNUNG", 30, y, 20, true)
  y -= 30

  drawText(page, fontRegular, `Rechnung Nr.: ${params.invoiceNumber}`, 30, y, 10)
  drawText(page, fontRegular, `Rechnungsdatum: ${formatDate(params.createdAt)}`, 220, y, 10)
  drawText(page, fontRegular, `Versendet am: ${params.sentAt ? formatDate(params.sentAt) : "-"}`, 410, y, 10)

  y -= 22
  page.drawLine({
    start: { x: 30, y },
    end: { x: width - 30, y },
    thickness: 0.8,
    color: rgb(0.78, 0.78, 0.78),
  })

  y -= 18

  drawText(page, fontBold, "Rechnungssteller", 30, y, 10)
  drawText(page, fontBold, "Rechnungsempfaenger", 310, y, 10)
  y -= 14

  const senderName = compact(params.sender.companyName) === "-" ? params.sender.name : compact(params.sender.companyName)
  const senderStreet = `${compact(params.sender.companyStreet)} ${compact(params.sender.companyHouseNumber)}`.trim()
  const senderCity = `${compact(params.sender.companyPostalCode)} ${compact(params.sender.companyCity)}`.trim()

  const recipientName = compact(params.recipient.companyName) === "-" ? params.recipient.name : compact(params.recipient.companyName)
  const recipientStreet = `${compact(params.recipient.companyStreet)} ${compact(params.recipient.companyHouseNumber)}`.trim()
  const recipientCity = `${compact(params.recipient.companyPostalCode)} ${compact(params.recipient.companyCity)}`.trim()

  drawText(page, fontRegular, senderName, 30, y, 10)
  drawText(page, fontRegular, recipientName, 310, y, 10)
  y -= 12
  drawText(page, fontRegular, senderStreet, 30, y, 9)
  drawText(page, fontRegular, recipientStreet, 310, y, 9)
  y -= 12
  drawText(page, fontRegular, senderCity, 30, y, 9)
  drawText(page, fontRegular, recipientCity, 310, y, 9)
  y -= 12
  drawText(page, fontRegular, compact(params.sender.companyCountry), 30, y, 9)
  drawText(page, fontRegular, compact(params.recipient.companyCountry), 310, y, 9)
  y -= 12
  drawText(page, fontRegular, `USt-IdNr.: ${compact(params.sender.vatId)}`, 30, y, 9)
  drawText(page, fontRegular, `USt-IdNr.: ${compact(params.recipient.vatId)}`, 310, y, 9)
  y -= 12
  drawText(page, fontRegular, `Steuernr.: ${compact(params.sender.taxNumber)}`, 30, y, 9)
  drawText(page, fontRegular, `Steuernr.: ${compact(params.recipient.taxNumber)}`, 310, y, 9)

  y -= 16
  drawText(page, fontRegular, `Empfaenger E-Mail: ${compact(params.recipientEmail)}`, 30, y, 9)
  y -= 14

  page.drawLine({
    start: { x: 30, y },
    end: { x: width - 30, y },
    thickness: 0.8,
    color: rgb(0.78, 0.78, 0.78),
  })

  y -= 16
  drawTableHeader(page, fontBold, y)
  y -= 10
  page.drawLine({
    start: { x: 30, y },
    end: { x: width - 30, y },
    thickness: 0.6,
    color: rgb(0.85, 0.85, 0.85),
  })
  y -= 12

  for (const transport of params.transports) {
    if (y < 120) {
      page = doc.addPage(pageSize)
      y = 806
      drawTableHeader(page, fontBold, y)
      y -= 10
      page.drawLine({
        start: { x: 30, y },
        end: { x: width - 30, y },
        thickness: 0.6,
        color: rgb(0.85, 0.85, 0.85),
      })
      y -= 12
    }

    const note = transport.notes ? transport.notes : transport.isIMO ? "ADR / IMO" : "-"

    drawText(page, fontRegular, formatDate(new Date(transport.date)), 30, y, 7)
    drawText(page, fontRegular, compact(transport.orderNumber), 80, y, 7)
    drawText(page, fontRegular, compact(transport.jobNumber), 145, y, 7)
    drawText(page, fontRegular, containerLabel(transport.containerSize), 205, y, 7)
    drawText(page, fontRegular, compact(transport.fromPlace), 250, y, 7)
    drawText(page, fontRegular, compact(transport.toPlace), 330, y, 7)
    drawText(page, fontRegular, compact(note), 410, y, 7)
    drawText(page, fontRegular, formatCurrency(transport.price), 525, y, 7)

    y -= 10
  }

  y -= 8
  page.drawLine({
    start: { x: 30, y },
    end: { x: width - 30, y },
    thickness: 0.8,
    color: rgb(0.78, 0.78, 0.78),
  })

  y -= 18
  drawText(page, fontRegular, `Summe Netto: ${formatCurrency(netTotal)}`, 360, y, 10)
  y -= 14
  drawText(page, fontRegular, `Umsatzsteuer 19%: ${formatCurrency(taxTotal)}`, 360, y, 10)
  y -= 14
  drawText(page, fontBold, `Rechnungsbetrag: ${formatCurrency(grossTotal)}`, 360, y, 11, true)

  y -= 26
  drawText(page, fontRegular, `Zahlung spaetestens bis: ${formatDate(dueDate)} ohne Abzuege.`, 30, y, 9)
  y -= 12
  drawText(page, fontRegular, "Mit freundlichen Gruessen", 30, y, 9)
  y -= 12
  drawText(page, fontBold, senderName, 30, y, 9, true)

  y -= 20
  const bankDetails = [
    params.sender.bankName ? `Bank: ${params.sender.bankName}` : null,
    params.sender.bankAccountHolder ? `Kontoinhaber: ${params.sender.bankAccountHolder}` : null,
    params.sender.iban ? `IBAN: ${params.sender.iban}` : null,
    params.sender.bic ? `BIC: ${params.sender.bic}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  drawText(page, fontRegular, `Bankverbindung: ${bankDetails || "-"}`, 30, y, 8)
  y -= 11
  drawText(page, fontRegular, "Diese Rechnung wurde mit FleetLog erstellt - KARR Logistik GmbH - www.karr-logistik.com", 30, y, 8)

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
