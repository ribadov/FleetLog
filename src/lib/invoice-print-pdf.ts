import { chromium } from "playwright"

type BuildInvoicePrintPdfParams = {
  invoiceId: string
  appUrl: string
  cookieHeader?: string
  footerHtml?: string
}

export async function buildInvoicePrintPdf({
  invoiceId,
  appUrl,
  cookieHeader,
  footerHtml,
}: BuildInvoicePrintPdfParams) {
  const browser = await chromium.launch({
    headless: true,
  })

  try {
    const context = await browser.newContext({
      extraHTTPHeaders: cookieHeader
        ? { cookie: cookieHeader }
        : undefined,
    })

    const page = await context.newPage()

    await page.goto(
      `${appUrl.replace(/\/$/, "")}/invoices/${invoiceId}`,
      {
        waitUntil: "networkidle",
      }
    )

    await page.emulateMedia({ media: "print" })

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: Boolean(footerHtml),
      headerTemplate: "<span></span>",
      footerTemplate: footerHtml || "<span></span>",
      margin: {
        top: "12mm",
        right: "10mm",
        bottom: footerHtml ? "26mm" : "12mm",
        left: "10mm",
      },
    })

    await context.close()

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}