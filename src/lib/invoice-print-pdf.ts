type BuildInvoicePrintPdfParams = {
  invoiceId: string
  appUrl: string
  cookieHeader?: string
  footerHtml?: string
}

async function tryExternalPdfRenderer({ invoiceId, appUrl, cookieHeader, footerHtml }: BuildInvoicePrintPdfParams) {
  // Cloudflare Workers: normalize and validate renderer URL to avoid malformed env values.
  const canonicalRendererBase = "https://fleetlog-pdf-renderer.ribadov.workers.dev"
  const configuredRendererUrl = (process.env?.PDF_RENDERER_URL ?? "").trim()

  let rendererBaseUrl = canonicalRendererBase
  if (configuredRendererUrl) {
    try {
      const parsed = new URL(configuredRendererUrl)
      rendererBaseUrl = `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`
    } catch {
      console.warn(`[PDF] Ignoring invalid PDF_RENDERER_URL: ${configuredRendererUrl}`)
    }
  }

  const primaryRenderUrl = rendererBaseUrl.endsWith("/render-invoice")
    ? rendererBaseUrl
    : `${rendererBaseUrl}/render-invoice`
  const primaryHealthUrl = rendererBaseUrl.endsWith("/render-invoice")
    ? rendererBaseUrl.replace(/\/render-invoice$/, "/health")
    : `${rendererBaseUrl}/health`
  
  // First, check if the renderer is alive
  try {
    console.log(`[PDF] Checking renderer health at: ${primaryHealthUrl}`)
    const healthResponse = await fetch(primaryHealthUrl, { method: "GET" })
    console.log(`[PDF] Health check status: ${healthResponse.status}`)
    if (!healthResponse.ok) {
      console.warn(`[PDF] Renderer health check failed with status ${healthResponse.status}`)
    }
  } catch (error) {
    console.error(`[PDF] Health check failed:`, error instanceof Error ? error.message : String(error))
  }
  
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

  const candidates = [primaryRenderUrl]

  try {
    const app = new URL(appUrl)
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

  console.log(`[PDF] Trying ${candidates.length} renderer candidates:`, candidates)

  for (const candidateUrl of candidates) {
    try {
      console.log(`[PDF] Attempting renderer at: ${candidateUrl}`)
      const response = await fetch(candidateUrl, {
        method: "POST",
        headers,
        body: payload,
      })

      console.log(`[PDF] Renderer responded with status: ${response.status}`)

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
      console.error(`[PDF] Renderer attempt failed for ${candidateUrl}:`, lastError)
    }
  }

  // All candidates failed - renderer service is not available
  // Log what happened for debugging
  console.error(`[PDF] All PDF renderer candidates failed. Last status: ${lastStatus}, Last error: ${lastError}`)
  
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
  try {
    console.log(`[PDF] Starting PDF generation for invoice: ${params.invoiceId}`)
    const externalPdf = await tryExternalPdfRenderer(params)
    if (externalPdf) {
      console.log(`[PDF] Successfully generated PDF using external renderer`)
      return externalPdf
    }

    console.log(`[PDF] External renderer failed or unavailable, attempting local rendering`)
    return buildWithLocalPlaywright(params)
  } catch (error) {
    console.error(`[PDF] Error generating PDF:`, error)
    throw error
  }
}
