type BuildInvoicePrintPdfParams = {
  invoiceId: string
  appUrl: string
  cookieHeader?: string
  footerHtml?: string
}

async function tryExternalPdfRenderer({ invoiceId, appUrl, cookieHeader, footerHtml }: BuildInvoicePrintPdfParams) {
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
      footerHtml,
    }),
  })

  if (!response.ok) {
    throw new Error(`External PDF renderer failed with status ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  return buffer.length > 0 ? buffer : null
}

async function resolveBrowserExecutablePath() {
  const fs = await import("node:fs")
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

async function buildWithLocalPlaywright({ invoiceId, appUrl, cookieHeader, footerHtml }: BuildInvoicePrintPdfParams) {
  const executablePath = await resolveBrowserExecutablePath()

  if (!executablePath) {
    throw new Error("No Chromium executable found and no external renderer configured. Set CHROMIUM_PATH or PDF_RENDERER_URL.")
  }

  const { chromium } = await import("playwright-core")

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

export async function buildInvoicePrintPdf(params: BuildInvoicePrintPdfParams) {
  const externalPdf = await tryExternalPdfRenderer(params)
  if (externalPdf) {
    return externalPdf
  }

  return buildWithLocalPlaywright(params)
}
