import fs from "node:fs"
import { getCloudflareContext } from "@opennextjs/cloudflare"

type BuildInvoicePrintPdfParams = {
  invoiceId: string
  appUrl: string
  cookieHeader?: string
  footerHtml?: string
}

type BrowserLike = {
  newContext?: (options?: Record<string, unknown>) => Promise<{
    newPage: () => Promise<{
      goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>
      emulateMedia?: (options?: Record<string, unknown>) => Promise<unknown>
      pdf: (options?: Record<string, unknown>) => Promise<Uint8Array | Buffer>
      close?: () => Promise<unknown>
    }>
    close: () => Promise<unknown>
  }>
  newPage?: () => Promise<{
    goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>
    emulateMediaType?: (type: string) => Promise<unknown>
    emulateMedia?: (options?: Record<string, unknown>) => Promise<unknown>
    pdf: (options?: Record<string, unknown>) => Promise<Uint8Array | Buffer>
    close?: () => Promise<unknown>
  }>
  close: () => Promise<unknown>
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

function getCloudflareBrowserBinding() {
  try {
    const context = getCloudflareContext()
    const env = context?.env as Record<string, unknown> | undefined
    const binding = env?.BROWSER
    return binding
  } catch {
    return undefined
  }
}

async function renderPdfWithBrowser(
  browser: BrowserLike,
  { invoiceId, appUrl, cookieHeader, footerHtml }: BuildInvoicePrintPdfParams
) {
  const url = `${appUrl.replace(/\/$/, "")}/invoices/${invoiceId}`

  if (browser.newContext) {
    const context = await browser.newContext({
      extraHTTPHeaders: cookieHeader ? { cookie: cookieHeader } : undefined,
    })

    try {
      const page = await context.newPage()
      await page.goto(url, { waitUntil: "networkidle" })

      if (page.emulateMedia) {
        await page.emulateMedia({ media: "print" })
      }

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

      return Buffer.from(pdf)
    } finally {
      await context.close()
    }
  }

  if (!browser.newPage) {
    throw new Error("Browser API unavailable")
  }

  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: "networkidle" })

    if (page.emulateMediaType) {
      await page.emulateMediaType("print")
    } else if (page.emulateMedia) {
      await page.emulateMedia({ media: "print" })
    }

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

    return Buffer.from(pdf)
  } finally {
    if (page.close) {
      await page.close()
    }
  }
}

export async function buildInvoicePrintPdf({ invoiceId, appUrl, cookieHeader, footerHtml }: BuildInvoicePrintPdfParams) {
  const cloudflareBrowserBinding = getCloudflareBrowserBinding()
  if (cloudflareBrowserBinding) {
    const puppeteerModule = await import("@cloudflare/puppeteer")
    const puppeteer = (puppeteerModule as { default: { launch: (binding: unknown, options?: Record<string, unknown>) => Promise<BrowserLike> } }).default
    const browser = await puppeteer.launch(cloudflareBrowserBinding)

    try {
      return await renderPdfWithBrowser(browser, { invoiceId, appUrl, cookieHeader, footerHtml })
    } finally {
      await browser.close()
    }
  }

  const executablePath = resolveBrowserExecutablePath()
  if (!executablePath) {
    throw new Error("No browser runtime found for PDF generation. Configure Cloudflare BROWSER binding in production or CHROMIUM_PATH locally.")
  }

  const playwrightModule = await import("playwright-core")
  const chromium = playwrightModule.chromium
  const browser = await chromium.launch({ executablePath, headless: true })

  try {
    return await renderPdfWithBrowser(browser as unknown as BrowserLike, { invoiceId, appUrl, cookieHeader, footerHtml })
  } finally {
    await browser.close()
  }
}
