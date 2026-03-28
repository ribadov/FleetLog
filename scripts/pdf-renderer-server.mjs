import fs from "node:fs"
import http from "node:http"
import { chromium } from "playwright-core"

const PORT = Number(process.env.PDF_RENDERER_PORT || 8788)
const AUTH_TOKEN = process.env.PDF_RENDERER_TOKEN || ""
const ALLOWED_ORIGINS = (process.env.PDF_ALLOWED_APP_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)

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

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ""

    req.on("data", (chunk) => {
      raw += chunk.toString("utf8")
      if (raw.length > 2_000_000) {
        reject(new Error("Request body too large"))
      }
    })

    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error("Invalid JSON body"))
      }
    })

    req.on("error", reject)
  })
}

function isAllowedAppUrl(appUrl) {
  if (ALLOWED_ORIGINS.length === 0) return true

  try {
    const url = new URL(appUrl)
    return ALLOWED_ORIGINS.includes(url.origin)
  } catch {
    return false
  }
}

async function renderInvoicePdf({ invoiceId, appUrl, cookieHeader, footerHtml }) {
  const executablePath = resolveBrowserExecutablePath()
  if (!executablePath) {
    throw new Error("No Chromium executable found. Set CHROMIUM_PATH.")
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

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendJson(res, 400, { error: "Bad request" })
    return
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true })
    return
  }

  if (req.method !== "POST" || req.url !== "/render-invoice") {
    sendJson(res, 404, { error: "Not found" })
    return
  }

  if (AUTH_TOKEN) {
    const authHeader = req.headers.authorization || ""
    const expected = `Bearer ${AUTH_TOKEN}`
    if (authHeader !== expected) {
      sendJson(res, 401, { error: "Unauthorized" })
      return
    }
  }

  try {
    const body = await parseJsonBody(req)
    const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId.trim() : ""
    const appUrl = typeof body.appUrl === "string" ? body.appUrl.trim() : ""
    const footerHtml = typeof body.footerHtml === "string" ? body.footerHtml : ""

    if (!invoiceId || !appUrl) {
      sendJson(res, 400, { error: "invoiceId and appUrl are required" })
      return
    }

    if (!isAllowedAppUrl(appUrl)) {
      sendJson(res, 403, { error: "appUrl origin not allowed" })
      return
    }

    const cookieHeader = typeof req.headers.cookie === "string" ? req.headers.cookie : undefined
    const pdfBuffer = await renderInvoicePdf({ invoiceId, appUrl, cookieHeader, footerHtml })

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Length": String(pdfBuffer.length),
    })
    res.end(pdfBuffer)
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF rendering failed"
    sendJson(res, 500, { error: message })
  }
})

server.listen(PORT, () => {
  console.log(`[pdf-renderer] listening on http://0.0.0.0:${PORT}`)
  if (ALLOWED_ORIGINS.length > 0) {
    console.log(`[pdf-renderer] allowed origins: ${ALLOWED_ORIGINS.join(", ")}`)
  }
})
