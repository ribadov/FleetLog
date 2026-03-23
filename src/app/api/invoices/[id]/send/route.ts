import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";
import { sendInvoiceEmail } from "@/lib/mailer";
import { buildInvoicePrintPdf } from "@/lib/invoice-print-pdf";
import { buildInvoiceFooterHtml } from "@/lib/invoice-pdf-footer";

type Params = { params: Promise<{ id: string }> };

function applyTemplate(template: string, values: Record<string, string>) {
  return template
    .replaceAll("{{companyName}}", values.companyName)
    .replaceAll("{{invoiceNumber}}", values.invoiceNumber)
    .replaceAll("{{recipientName}}", values.recipientName);
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only managers can send invoices" },
      { status: 403 }
    );
  }

  const { isAdmin, workspaceId } = getTenantContext(session.user);

  const { id } = await params;

  // Sowohl Datenbank-ID als auch Rechnungsnummer unterstützen
  let invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      contractor: {
        select: {
          email: true,
          billingEmail: true,
          name: true,
          companyName: true,
          invoiceEmailSubject: true,
          invoiceEmailBody: true,
        },
      },
      sentBy: {
        select: {
          name: true,
          companyName: true,
          bankName: true,
          bankAccountHolder: true,
          iban: true,
          bic: true,
        },
      },
      workspace: {
        include: {
          manager: {
            select: {
              name: true,
              companyName: true,
              bankName: true,
              bankAccountHolder: true,
              iban: true,
              bic: true,
            },
          },
        },
      },
      transports: {
        select: {
          price: true,
        },
      },
    },
  });

  if (!invoice) {
    invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: id },
      include: {
        contractor: {
          select: {
            email: true,
            billingEmail: true,
            name: true,
            companyName: true,
            invoiceEmailSubject: true,
            invoiceEmailBody: true,
          },
        },
        sentBy: {
          select: {
            name: true,
            companyName: true,
            bankName: true,
            bankAccountHolder: true,
            iban: true,
            bic: true,
          },
        },
        workspace: {
          include: {
            manager: {
              select: {
                name: true,
                companyName: true,
                bankName: true,
                bankAccountHolder: true,
                iban: true,
                bic: true,
              },
            },
          },
        },
        transports: {
          select: {
            price: true,
          },
        },
      },
    });
  }
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!isAdmin && invoice.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (invoice.sentAt) {
    return NextResponse.json(
      { error: "Invoice is already sent" },
      { status: 400 }
    );
  }

  const recipientEmail = invoice.contractor.billingEmail ?? invoice.contractor.email;
  if (!recipientEmail) {
    return NextResponse.json(
      { error: "Recipient email is missing" },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (!appUrl) {
    return NextResponse.json(
      { error: "App URL is missing. Please set NEXT_PUBLIC_APP_URL or NEXTAUTH_URL." },
      { status: 500 }
    );
  }

  const invoiceUrl = `${appUrl.replace(/\/$/, "")}/invoices/${invoice.id}`;

  const sender = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      companyName: true,
      invoiceEmailSubject: true,
      invoiceEmailBody: true,
    },
  });

  const templateValues = {
    companyName: sender?.companyName?.trim() || sender?.name || "FleetLog",
    invoiceNumber: invoice.invoiceNumber,
    recipientName: invoice.contractor.companyName?.trim() || invoice.contractor.name,
  };

  const subjectTemplate =
    sender?.invoiceEmailSubject?.trim() || "{{companyName}} Rechnung Nr. {{invoiceNumber}}";
  const bodyTemplate =
    sender?.invoiceEmailBody?.trim() ||
    "Guten Tag {{recipientName}},\n\nanbei erhalten Sie die Rechnung Nr. {{invoiceNumber}} als PDF im Anhang.\n\nMit freundlichen Grüßen\n{{companyName}}";

  const finalSubject = applyTemplate(subjectTemplate, templateValues);
  const finalBody = applyTemplate(bodyTemplate, templateValues);

  const sentTimestamp = new Date();

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      sentAt: sentTimestamp,
      sentById: session.user.id,
      recipientEmail,
    },
  });

  try {
    const footerHtml = await buildInvoiceFooterHtml(invoice)

    const invoicePdfBuffer = await buildInvoicePrintPdf({
      invoiceId: invoice.id,
      appUrl,
      cookieHeader: req.headers.get("cookie") || undefined,
      footerHtml,
    })

    await sendInvoiceEmail({
      to: recipientEmail,
      invoiceNumber: invoice.invoiceNumber,
      invoiceUrl,
      subject: finalSubject,
      bodyText: finalBody,
      pdfBuffer: invoicePdfBuffer,
      pdfFileName: `Rechnung-${invoice.invoiceNumber}.pdf`,
    });
  } catch (sendError) {
    await prisma.invoice.updateMany({
      where: {
        id,
        sentAt: sentTimestamp,
      },
      data: {
        sentAt: null,
        sentById: null,
        recipientEmail: invoice.recipientEmail,
      },
    });

    console.error("[Invoice Send Error]", {
      invoiceId: invoice.id,
      recipientEmail,
      reason: sendError instanceof Error ? sendError.message : String(sendError),
    });

    return NextResponse.json(
      { error: "Invoice could not be generated/sent" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: updated.id,
    sentAt: updated.sentAt,
    recipientEmail: updated.recipientEmail,
  });
}
