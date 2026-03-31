type BuildInvoicePrintPdfParams = {
  invoiceId: string
  appUrl: string
  cookieHeader?: string
  footerHtml?: string
}

async function tryExternalPdfRenderer({ invoiceId, appUrl, cookieHeader, footerHtml }: BuildInvoicePrintPdfParams) {
  // Cloudflare Workers: hardcode renderer URL since process.env may not be available at runtime
  const rendererUrl = (process.env?.PDF_RENDERER_URL ?? "") || "https://fleetlog-pdf-renderer.ribadov.workers.dev"
  
  const rendererToken = process.env?.PDF_RENDERER_TOKEN

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (rendererToken) {
    headers.Authorization = `Bearer ${rendererToken}`
  }

  if (cookieHeader) {
    headers.Cookie = cookieHeader
  }

  const payload = JSON.stringify({
    invoiceId,
    appUrl,
    footerHtml,
  })

  const candidates = [rendererUrl]

  try {
    const parsed = new URL(rendererUrl)
    if (!parsed.pathname.endsWith("/render-invoice")) {
      const withPath = `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}/render-invoice`
      if (!candidates.includes(withPath)) {
        candidates.push(withPath)
      }
    }
  } catch {
    const normalized = rendererUrl.replace(/\/$/, "")
    const withPath = `${normalized}/render-invoice`
    if (!normalized.endsWith("/render-invoice") && !candidates.includes(withPath)) {
      candidates.push(withPath)
    }
  }

  try {
    const app = new URL(appUrl)
    if (app.hostname.startsWith("fleetlog.")) {
      const derivedRendererUrl = `https://${app.hostname.replace("fleetlog.", "fleetlog-pdf-renderer.")}/render-invoice`
      if (!candidates.includes(derivedRendererUrl)) {
        candidates.push(derivedRendererUrl)
      }
    }

    if (app.hostname.endsWith("workers.dev")) {
      const canonicalWorkersRenderer = "https://fleetlog-pdf-renderer.ribadov.workers.dev/render-invoice"
      if (!candidates.includes(canonicalWorkersRenderer)) {
        candidates.push(canonicalWorkersRenderer)
      }
    }
  } catch {
    // ignore invalid appUrl parsing for fallback candidate generation
  }

  let lastStatus: number | null = null
  let lastError: string | null = null

  for (const candidateUrl of candidates) {
    try {
      const response = await fetch(candidateUrl, {
        method: "POST",
        headers,
        body: payload,
      })

      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer())
        return buffer.length > 0 ? buffer : null
      }

      lastStatus = response.status

      if (response.status !== 404) {
        throw new Error(`External PDF renderer failed with status ${response.status}`)
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      // Log the error but continue trying other candidates
      console.error(`PDF renderer attempt failed for ${candidateUrl}:`, lastError)
    }
  }

  // All candidates failed - renderer service is not available
  // Log what happened for debugging
  console.error(`All PDF renderer candidates failed. Last status: ${lastStatus}, Last error: ${lastError}`)
  
  // Return null to trigger fallback to local Playwright rendering
  return null
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
    throw new Error(
      "No local Chromium executable found. External PDF renderer must be available via PDF_RENDERER_URL env variable. " +
      "Ensure the renderer worker (https://fleetlog-pdf-renderer.ribadov.workers.dev) is deployed and accessible."
    )
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
      waitUntil: "load",
      timeout: 30000,
    })
    await page.waitForTimeout(250)

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
