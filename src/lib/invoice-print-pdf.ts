import { prisma } from "@/lib/prisma"
import { buildInvoicePdfBuffer } from "@/lib/invoice-pdf"

type BuildInvoicePrintPdfParams = {
  invoiceId: string
  appUrl: string
  cookieHeader?: string
  footerHtml?: string
}

async function tryExternalPdfRenderer({ invoiceId, appUrl, cookieHeader }: BuildInvoicePrintPdfParams) {
  const rendererUrl = process.env.PDF_RENDERER_URL
  if (!rendererUrl) return null

  const rendererToken = process.env.PDF_RENDERER_TOKEN

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (rendererToken) {
    headers.Authorization = `Bearer ${rendererToken}`
  }

  if (cookieHeader) {
    headers.Cookie = cookieHeader
  }

  const response = await fetch(rendererUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      invoiceId,
      appUrl,
    }),
  })

  if (!response.ok) {
    throw new Error(`External PDF renderer failed with status ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  return buffer.length > 0 ? buffer : null
}

export async function buildInvoicePrintPdf({ invoiceId, appUrl, cookieHeader, footerHtml }: BuildInvoicePrintPdfParams) {
  void footerHtml

  try {
    const externalPdf = await tryExternalPdfRenderer({ invoiceId, appUrl, cookieHeader })
    if (externalPdf) {
      return externalPdf
    }
  } catch (error) {
    console.error("[PDF] External renderer failed, using fallback", error)
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      contractor: true,
      sentBy: true,
      workspace: {
        include: {
          manager: true,
        },
      },
      transports: {
        orderBy: { date: "asc" },
        select: {
          date: true,
          orderNumber: true,
          jobNumber: true,
          containerSize: true,
          fromPlace: true,
          toPlace: true,
          notes: true,
          isIMO: true,
          price: true,
        },
      },
    },
  })

  if (!invoice) {
    throw new Error("Invoice not found")
  }

  const sender = invoice.workspace?.manager ?? invoice.sentBy ?? invoice.contractor

  return buildInvoicePdfBuffer({
    invoiceNumber: invoice.invoiceNumber,
    createdAt: invoice.createdAt,
    sentAt: invoice.sentAt,
    recipientEmail: invoice.recipientEmail,
    sender: {
      name: sender.name,
      companyName: sender.companyName,
      companyStreet: sender.companyStreet,
      companyHouseNumber: sender.companyHouseNumber,
      companyPostalCode: sender.companyPostalCode,
      companyCity: sender.companyCity,
      companyCountry: sender.companyCountry,
      vatId: sender.vatId,
      taxNumber: sender.taxNumber,
      bankName: sender.bankName,
      bankAccountHolder: sender.bankAccountHolder,
      iban: sender.iban,
      bic: sender.bic,
    },
    recipient: {
      name: invoice.contractor.name,
      companyName: invoice.contractor.companyName,
      companyStreet: invoice.contractor.companyStreet,
      companyHouseNumber: invoice.contractor.companyHouseNumber,
      companyPostalCode: invoice.contractor.companyPostalCode,
      companyCity: invoice.contractor.companyCity,
      companyCountry: invoice.contractor.companyCountry,
      vatId: invoice.contractor.vatId,
      taxNumber: invoice.contractor.taxNumber,
    },
    transports: invoice.transports,
  })
}
