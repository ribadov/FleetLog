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

    if (request.method === "GET" && url.pathname === "/health") {
      return json(200, { ok: true })
    }

    if (request.method !== "POST" || url.pathname !== "/render-invoice") {
      return json(404, { error: "Not found" })
    }

    const expectedToken = (env.RENDERER_TOKEN ?? "").trim()
    if (expectedToken) {
      const authHeader = request.headers.get("authorization") ?? ""
      if (authHeader !== `Bearer ${expectedToken}`) {
        return json(401, { error: "Unauthorized" })
      }
    }

    let payload
    try {
      payload = await request.json()
    } catch {
      return json(400, { error: "Invalid JSON body" })
    }

    const invoiceId = (payload?.invoiceId ?? "").trim()
    const appUrl = (payload?.appUrl ?? "").trim()
    const footerHtml = payload?.footerHtml ?? ""

    if (!invoiceId || !appUrl) {
      return json(400, { error: "invoiceId and appUrl are required" })
    }

    if (!isAllowedOrigin(appUrl, env.ALLOWED_APP_ORIGINS)) {
      return json(403, { error: "appUrl origin not allowed" })
    }

    const browser = await puppeteer.launch(env.BROWSER)

    try {
      const page = await browser.newPage()

      const cookieHeader = request.headers.get("cookie")
      if (cookieHeader) {
        await page.setExtraHTTPHeaders({ cookie: cookieHeader })
      }

      await page.goto(`${appUrl.replace(/\/$/, "")}/invoices/${invoiceId}`, {
        waitUntil: "load",
      })
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

      return new Response(pdfBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "no-store",
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rendering failed"
      return json(500, { error: message })
    } finally {
      await browser.close()
    }
  },
}
