import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"
import { buildInvoicePrintPdf } from "@/lib/invoice-print-pdf"
import { buildInvoiceFooterHtml } from "@/lib/invoice-pdf-footer"

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await auth()
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (session.user.role !== "CONTRACTOR" && session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { isAdmin, workspaceId } = getTenantContext(session.user)
    const { id } = await params

    // Sowohl Datenbank-ID als auch Rechnungsnummer unterstützen
    let invoice = await prisma.invoice.findUnique({
      where: { id },
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
      invoice = await prisma.invoice.findUnique({
        where: { invoiceNumber: id },
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
    }

    if (!invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (!isAdmin) {
      if (session.user.role === "CONTRACTOR") {
        if (invoice.contractorId !== session.user.id) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          })
        }

        if (!invoice.sentAt) {
          return new Response(JSON.stringify({ error: "Draft invoices are not downloadable for contractors" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          })
        }
      } else if (invoice.workspaceId !== workspaceId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        })
      }
    }

    // const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL
    // if (!appUrl) {
    //   return new Response(JSON.stringify({ error: "App URL is missing. Please set NEXT_PUBLIC_APP_URL or NEXTAUTH_URL." }), {
    //     status: 500,
    //     headers: { "Content-Type": "application/json" },
    //   })
    // }

    try {
      console.log("[PDF] Invoice found:", invoice.id)
      console.log("[PDF] Invoice number:", invoice.invoiceNumber)

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL

      console.log("[PDF] appUrl:", appUrl)

      if (!appUrl) {
        throw new Error(
          "App URL is missing. Please set NEXT_PUBLIC_APP_URL or NEXTAUTH_URL."
        )
      }

      console.log("[PDF] Building footer...")
      const footerHtml = await buildInvoiceFooterHtml(invoice)
      console.log("[PDF] Footer built")

      console.log("[PDF] Starting PDF generation...")

      const pdfBuffer = await buildInvoicePrintPdf({
        invoiceId: invoice.id,
        appUrl,
        cookieHeader: req.headers.get("cookie") || undefined,
        footerHtml,
      })

      console.log("[PDF] PDF generated:", pdfBuffer.length, "bytes")

      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="Rechnung-${invoice.invoiceNumber}.pdf"`,
          "Cache-Control": "no-store",
        },
      })
    } catch (error) {
      console.error("[PDF] GENERATION FAILED:", error)

      if (error instanceof Error) {
        console.error("[PDF] message:", error.message)
        console.error("[PDF] stack:", error.stack)
      }

      return new Response(
        JSON.stringify({
          error: "PDF generation failed",
          message: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    };
  } catch (error) {
    console.error("INVOICE PDF GENERATION ERROR:", error);

    return new Response(
      JSON.stringify({
        error: "PDF generation failed",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
