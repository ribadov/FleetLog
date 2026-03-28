import fs from "node:fs"
import { chromium } from "playwright-core"

type BuildInvoicePrintPdfParams = {
  invoiceId: string
  appUrl: string
  cookieHeader?: string
  footerHtml?: string
}

function resolveBrowserExecutablePath() {
  const fromEnv = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM_PATH
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv
  }

  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ]

  return candidates.find((path) => fs.existsSync(path))
}

export async function buildInvoicePrintPdf({ invoiceId, appUrl, cookieHeader, footerHtml }: BuildInvoicePrintPdfParams) {
  const executablePath = resolveBrowserExecutablePath()
  if (!executablePath) {
    throw new Error("No Chromium executable found. Please set CHROMIUM_PATH.")
  }

  const browser = await chromium.launch({
    executablePath,
    headless: true,
  })

  try {
    const context = await browser.newContext({
      extraHTTPHeaders: cookieHeader ? { cookie: cookieHeader } : undefined,
    })

    const page = await context.newPage()
    await page.goto(`${appUrl.replace(/\/$/, "")}/invoices/${invoiceId}`, {
      waitUntil: "networkidle",
    })

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
