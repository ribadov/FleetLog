import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";
import { getLocaleFromRequest } from "@/lib/i18n-server";
import { getTranslator } from "@/lib/i18n";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PrintInvoiceButton from "./PrintInvoiceButton";
import SendInvoiceButton from "./SendInvoiceButton";

type Params = { params: Promise<{ id: string }> };

function containerLabel(size: string) {
  return size.replace("SIZE_", "") + " ft";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("de-DE").format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

export default async function InvoiceDetailPage({ params }: Params) {
  const session = await auth();
  if (!session) redirect("/login");
  const locale = await getLocaleFromRequest();
  const t = getTranslator(locale);

  if (session.user.role !== "CONTRACTOR" && session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { isAdmin, workspaceId } = getTenantContext(session.user);

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
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
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  if (!isAdmin && invoice.workspaceId !== workspaceId) {
    redirect("/invoices");
  }

  if (session.user.role === "CONTRACTOR" && invoice.contractorId !== session.user.id) {
    redirect("/invoices");
  }

  if (session.user.role === "CONTRACTOR" && !invoice.sentAt) {
    redirect("/invoices");
  }

  const taxRate = 0.19;
  const netTotal = invoice.transports.reduce((sum, transport) => sum + transport.price, 0);
  const taxTotal = netTotal * taxRate;
  const grossTotal = netTotal + taxTotal;
  const dueDate = invoice.sentAt
    ? new Date(invoice.sentAt.getTime() + 14 * 24 * 60 * 60 * 1000)
    : null;

  const contractorAddress = [
    invoice.contractor.companyStreet,
    invoice.contractor.companyHouseNumber,
  ]
    .filter(Boolean)
    .join(" ");

  const contractorPostalCity = [
    invoice.contractor.companyPostalCode,
    invoice.contractor.companyCity,
  ]
    .filter(Boolean)
    .join(" ");

  const senderProfile = invoice.workspace?.manager;
  const senderAddress = [
    senderProfile?.companyStreet,
    senderProfile?.companyHouseNumber,
  ]
    .filter(Boolean)
    .join(" ");

  const senderPostalCity = [
    senderProfile?.companyPostalCode,
    senderProfile?.companyCity,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="invoice-document max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="no-print mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invoice {invoice.invoiceNumber}</h1>
        <div className="flex items-center gap-3">
          {session.user.role === "MANAGER" && !invoice.sentAt && (
            <SendInvoiceButton invoiceId={invoice.id} locale={locale} />
          )}
          <PrintInvoiceButton locale={locale} />
          <Link
            href="/invoices"
            className="inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            {t("backToInvoices")}
          </Link>
        </div>
      </div>

      <div className="mb-6 hidden print:block">
        <h1 className="text-3xl font-bold text-slate-900">FleetLog</h1>
        <p className="text-sm text-slate-600">Container Transport Invoice</p>
      </div>

      <div className="print-card bg-white dark:bg-slate-800 rounded-xl shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm mb-6">
          <div>
            <p className="text-slate-500 dark:text-slate-400">Rechnungssteller</p>
            <p className="font-semibold text-slate-900 dark:text-white">{senderProfile?.companyName ?? invoice.sentBy?.name ?? "—"}</p>
            <p className="text-slate-700 dark:text-slate-300">{senderAddress || "—"}</p>
            <p className="text-slate-700 dark:text-slate-300">{senderPostalCity || "—"}</p>
            <p className="text-slate-700 dark:text-slate-300">{senderProfile?.companyCountry ?? "—"}</p>
            <p className="text-slate-700 dark:text-slate-300 mt-2">USt-IdNr.: {senderProfile?.vatId ?? "—"}</p>
            <p className="text-slate-700 dark:text-slate-300">Steuernummer: {senderProfile?.taxNumber ?? "—"}</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Rechnungsempfänger</p>
            <p className="font-semibold text-slate-900 dark:text-white">{invoice.contractor.companyName ?? invoice.contractor.name}</p>
            <p className="text-slate-700 dark:text-slate-300">{contractorAddress || "—"}</p>
            <p className="text-slate-700 dark:text-slate-300">{contractorPostalCity || "—"}</p>
            <p className="text-slate-700 dark:text-slate-300">{invoice.contractor.companyCountry ?? "—"}</p>
            <p className="text-slate-700 dark:text-slate-300 mt-2">USt-IdNr.: {invoice.contractor.vatId ?? "—"}</p>
            <p className="text-slate-700 dark:text-slate-300">Steuernummer: {invoice.contractor.taxNumber ?? "—"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500 dark:text-slate-400">Rechnung Nr.</p>
            <p className="font-semibold text-slate-900 dark:text-white">{invoice.invoiceNumber}</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Rechnungsdatum</p>
            <p className="font-semibold text-slate-900 dark:text-white">{formatDate(invoice.createdAt)}</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Status</p>
            <p className="font-semibold text-slate-900 dark:text-white">{invoice.sentAt ? "Versendet" : "Entwurf"}</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Versendet am</p>
            <p className="font-semibold text-slate-900 dark:text-white">{invoice.sentAt ? formatDate(invoice.sentAt) : "—"}</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Zahlungsfrist (14 Tage)</p>
            <p className="font-semibold text-slate-900 dark:text-white">{dueDate ? formatDate(dueDate) : "Wird bei Versand gesetzt"}</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Empfänger E-Mail</p>
            <p className="font-semibold text-slate-900 dark:text-white">{invoice.recipientEmail}</p>
          </div>
        </div>
      </div>

      <div className="print-card bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Auftragsnr.</th>
                <th className="px-4 py-3 font-medium">Container</th>
                <th className="px-4 py-3 font-medium">Von</th>
                <th className="px-4 py-3 font-medium">Nach</th>
                <th className="px-4 py-3 font-medium">Bemerkung</th>
                <th className="px-4 py-3 font-medium">Netto</th>
                <th className="px-4 py-3 font-medium">USt. 19%</th>
                <th className="px-4 py-3 font-medium">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {invoice.transports.map((transport) => (
                <tr
                  key={transport.id}
                  className="border-b border-slate-100 dark:border-slate-700/50"
                >
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {formatDate(new Date(transport.date))}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {transport.orderNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {containerLabel(transport.containerSize)}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{transport.fromPlace}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{transport.toPlace}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {transport.notes ?? (transport.isIMO ? "ADR / IMO" : "—")}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatCurrency(transport.price)}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatCurrency(transport.price * taxRate)}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatCurrency(transport.price * (1 + taxRate))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 p-6">
          <div className="max-w-md ml-auto space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Summe Netto</span>
              <span className="text-slate-900 dark:text-white">{formatCurrency(netTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Umsatzsteuer 19 %</span>
              <span className="text-slate-900 dark:text-white">{formatCurrency(taxTotal)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
              <span className="font-semibold text-slate-900 dark:text-white">Rechnungsbetrag</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(grossTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="print-card bg-white dark:bg-slate-800 rounded-xl shadow p-6 mt-6 text-sm text-slate-700 dark:text-slate-300">
        <p>
          Zahlung spätestens zum {dueDate ? formatDate(dueDate) : "—"} ohne Abzüge.
        </p>
        <p className="mt-2">Mit freundlichen Grüßen</p>
        <p className="font-semibold mt-1">{senderProfile?.companyName ?? invoice.sentBy?.name ?? "—"}</p>
        <p className="mt-4 text-slate-500 dark:text-slate-400">
          Bankverbindung: {senderProfile?.bankName ?? "—"} · Zahlungsempfänger: {senderProfile?.bankAccountHolder ?? "—"} · IBAN: {senderProfile?.iban ?? "—"} · BIC: {senderProfile?.bic ?? "—"}
        </p>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Diese Rechnung wurde mit FleetLog erstellt – einer Logistik-Anwendung der KARR Logistik GmbH.
        </p>
      </div>
    </div>
  );
}
