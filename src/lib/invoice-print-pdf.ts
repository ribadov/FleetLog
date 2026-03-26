import fs from "node:fs"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { prisma } from "@/lib/prisma"
import { buildInvoicePdfBuffer } from "@/lib/invoice-pdf"

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

const globalForInvoicePdf = globalThis as unknown as {
  cfBrowserPromise?: Promise<BrowserLike>
  localBrowserPromise?: Promise<BrowserLike>
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
      await page.goto(url, { waitUntil: "load" })

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
    await page.goto(url, { waitUntil: "load" })

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

function isRateLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("Rate limit exceeded") || message.includes("code: 429")
}

async function buildFallbackPdf(invoiceId: string) {
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

export async function buildInvoicePrintPdf({ invoiceId, appUrl, cookieHeader, footerHtml }: BuildInvoicePrintPdfParams) {
  const cloudflareBrowserBinding = getCloudflareBrowserBinding()
  if (cloudflareBrowserBinding) {
    try {
      if (!globalForInvoicePdf.cfBrowserPromise) {
        globalForInvoicePdf.cfBrowserPromise = (async () => {
          const puppeteerModule = await import("@cloudflare/puppeteer")
          const puppeteer = (puppeteerModule as { default: { launch: (binding: unknown, options?: Record<string, unknown>) => Promise<BrowserLike> } }).default
          return puppeteer.launch(cloudflareBrowserBinding)
        })()
      }

      const browser = await globalForInvoicePdf.cfBrowserPromise
      return await renderPdfWithBrowser(browser, { invoiceId, appUrl, cookieHeader, footerHtml })
    } catch (error) {
      if (isRateLimitError(error)) {
        console.warn("[PDF] Browser rendering rate-limited, using fallback PDF", error)
        return buildFallbackPdf(invoiceId)
      }

      globalForInvoicePdf.cfBrowserPromise = undefined
      throw error
    }
  }

  const executablePath = resolveBrowserExecutablePath()
  if (!executablePath) {
    throw new Error("No browser runtime found for PDF generation. Configure Cloudflare BROWSER binding in production or CHROMIUM_PATH locally.")
  }

  const playwrightModule = await import("playwright-core")
  const chromium = playwrightModule.chromium
  if (!globalForInvoicePdf.localBrowserPromise) {
    globalForInvoicePdf.localBrowserPromise = chromium.launch({ executablePath, headless: true }) as unknown as Promise<BrowserLike>
  }

  const browser = await globalForInvoicePdf.localBrowserPromise

  try {
    return await renderPdfWithBrowser(browser as unknown as BrowserLike, { invoiceId, appUrl, cookieHeader, footerHtml })
  } catch (error) {
    globalForInvoicePdf.localBrowserPromise = undefined
    throw error
  }
}
