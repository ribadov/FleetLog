import puppeteer from "@cloudflare/puppeteer"

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function isAllowedOrigin(appUrl, allowedOriginsRaw) {
  if (!allowedOriginsRaw || !allowedOriginsRaw.trim()) return true

  const allowedOrigins = allowedOriginsRaw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  if (allowedOrigins.length === 0) return true

  try {
    const url = new URL(appUrl)
    return allowedOrigins.includes(url.origin)
  } catch {
    return false
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    
    console.log(`[RENDERER] Received ${request.method} request to ${url.pathname}`)

    if (request.method === "GET" && url.pathname === "/health") {
      console.log(`[RENDERER] Health check OK`)
      return json(200, { ok: true })
    }

    if (request.method !== "POST" || url.pathname !== "/render-invoice") {
      console.log(`[RENDERER] Rejecting: method=${request.method}, pathname=${url.pathname}`)
      return json(404, { error: "Not found" })
    }
    
    console.log(`[RENDERER] Processing PDF render request`)

    // NOTE: Auth disabled temporarily to diagnose PDF generation issues
    // Will re-enable with proper token configuration
    
    let payload
    try {
      payload = await request.json()
      console.log(`[RENDERER] Parsed payload successfully`)
    } catch (e) {
      console.error(`[RENDERER] Failed to parse JSON:`, e.message)
      return json(400, { error: "Invalid JSON body" })
    }

    const invoiceId = (payload?.invoiceId ?? "").trim()
    const appUrl = (payload?.appUrl ?? "").trim()
    const footerHtml = payload?.footerHtml ?? ""
    
    console.log(`[RENDERER] invoiceId: ${invoiceId}, appUrl: ${appUrl}`)

    if (!invoiceId || !appUrl) {
      console.error(`[RENDERER] Missing invoiceId or appUrl`)
      return json(400, { error: "invoiceId and appUrl are required" })
    }

    // Origin validation disabled for now - allowing all origins
    // if (!isAllowedOrigin(appUrl, env.ALLOWED_APP_ORIGINS)) {
    //   console.error(`[RENDERER] appUrl origin not allowed: ${appUrl}`)
    //   return json(403, { error: "appUrl origin not allowed" })
    // }
    
    console.log(`[RENDERER] Starting Puppeteer browser launch`)

    const browser = await puppeteer.launch(env.BROWSER)

    try {
      console.log(`[RENDERER] Browser launched, creating page`)
      const page = await browser.newPage()
      console.log(`[RENDERER] Page created, setting headers and navigating`)

      const cookieHeader = request.headers.get("cookie")
      if (cookieHeader) {
        await page.setExtraHTTPHeaders({ cookie: cookieHeader })
        console.log(`[RENDERER] Cookie header set`)
      }

      const targetUrl = `${appUrl.replace(/\/$/, "")}/invoices/${invoiceId}`
      console.log(`[RENDERER] Navigating to: ${targetUrl}`)
      await page.goto(targetUrl, {
        waitUntil: "load",
      })
      console.log(`[RENDERER] Page loaded, waiting and converting to PDF`)
      await new Promise((resolve) => setTimeout(resolve, 250))
      await page.emulateMediaType("print")

      const pdfBytes = await page.pdf({
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
      
      console.log(`[RENDERER] PDF generated successfully, size: ${pdfBytes.length} bytes`)

      return new Response(pdfBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "no-store",
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rendering failed"
      console.error(`[RENDERER] Error during rendering:`, message)
      return json(500, { error: message })
    } finally {
      console.log(`[RENDERER] Closing browser`)
      await browser.close()
    }
  },
}
