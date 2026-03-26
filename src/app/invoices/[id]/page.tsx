import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";
import { getLocaleFromRequest } from "@/lib/i18n-server";
import { getTranslator } from "@/lib/i18n";
import { calculateImoSurcharge } from "@/lib/pricing";
import Link from "next/link";
import Image from "next/image";
import { Fragment } from "react";
import { notFound, redirect } from "next/navigation";
import PrintInvoiceButton from "./PrintInvoiceButton";
import SendInvoiceButton from "./SendInvoiceButton";
import ResetDraftInvoiceButton from "./ResetDraftInvoiceButton";
import { PrintPageNumbers } from "./PrintPageNumbers";

type Params = { params: Promise<{ id: string }> };

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

  // Unterstützung sowohl für Datenbank-ID als auch für sichtbare Rechnungsnummer
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
    },
  });

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
      },
    });
  }

  if (!invoice) {
    notFound();
  }

  if (!isAdmin) {
    if (session.user.role === "CONTRACTOR") {
      if (invoice.contractorId !== session.user.id) {
        redirect("/invoices");
      }
    } else if (invoice.workspaceId !== workspaceId) {
      redirect("/invoices");
    }
  }

  if (session.user.role === "CONTRACTOR" && !invoice.sentAt) {
    redirect("/invoices");
  }

  const transports = await prisma.transport.findMany({
    where: { invoiceId: invoice.id },
    orderBy: { date: "asc" },
    include: {
      legs: {
        orderBy: { sequence: "asc" },
      },
    },
  });

  const taxRate = 0.19;
  const netTotal = transports.reduce((sum, transport) => sum + transport.price, 0);
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

  const contractorLogoPath = (invoice.contractor as { logoPath?: string | null }).logoPath ?? null;

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
    <>
      <PrintPageNumbers />
      <div className="invoice-document max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="no-print mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invoice {invoice.invoiceNumber}</h1>
          <div className="flex items-center gap-3">
            {session.user.role === "MANAGER" && !invoice.sentAt && (
              <SendInvoiceButton invoiceId={invoice.id} locale={locale} />
            )}
            {session.user.role === "MANAGER" && !invoice.sentAt && (
              <ResetDraftInvoiceButton invoiceId={invoice.id} />
            )}
            <PrintInvoiceButton locale={locale} invoiceId={invoice.id} />
            <Link
              href="/invoices"
              className="inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
            >
              {t("backToInvoices")}
            </Link>
          </div>
        </div>

      <div className="mb-2 hidden print:block">
        {contractorLogoPath && (
          <div>
            <div className="relative h-16 w-auto max-w-xs">
              <Image
                src={contractorLogoPath}
                alt={invoice.contractor.companyName || invoice.contractor.name}
                height={64}
                width={200}
                style={{ objectFit: "contain", objectPosition: "left" }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="invoice-addresses-card print-card bg-white dark:bg-slate-800 rounded-xl shadow p-6 mb-6">
        <div className="grid grid-cols-2 gap-6 text-sm mb-6 items-start">
          <div>
            <p className="text-slate-500 dark:text-slate-400 font-semibold mb-3">Rechnungssteller</p>
            <p className="font-semibold text-slate-900 dark:text-white">{senderProfile?.companyName ?? invoice.sentBy?.name ?? "—"}</p>
            <p className="text-slate-700 dark:text-slate-300">{senderAddress || "—"}</p>
            <p className="text-slate-700 dark:text-slate-300">{senderPostalCity || "—"}</p>
            <p className="text-slate-700 dark:text-slate-300">{senderProfile?.companyCountry ?? "—"}</p>
            <p className="text-slate-700 dark:text-slate-300 mt-2">USt-IdNr.: {senderProfile?.vatId ?? "—"}</p>
            <p className="text-slate-700 dark:text-slate-300">Steuernummer: {senderProfile?.taxNumber ?? "—"}</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 font-semibold mb-3">Rechnungsempfänger</p>
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
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full table-fixed text-sm print:text-[8.7px]">
            <colgroup><col className="w-[9%]" /><col className="w-[11%]" /><col className="w-[9%]" /><col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[11%]" /><col className="w-[9%]" /><col className="w-[7%]" /><col className="w-[7%]" /><col className="w-[8%]" /><col className="w-[9%]" /></colgroup>
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2 print:px-1 print:py-1 font-medium leading-tight">Date</th>
                <th className="px-3 py-2 print:px-1 print:py-1 font-medium leading-tight">Containernr.</th>
                <th className="px-3 py-2 print:px-1 print:py-1 font-medium leading-tight">Auftragsnr.</th>
                <th className="px-3 py-2 print:px-1 print:py-1 font-medium leading-tight">Von</th>
                <th className="px-3 py-2 print:px-1 print:py-1 font-medium leading-tight">Nach</th>
                <th className="px-3 py-2 print:px-1 print:py-1 font-medium leading-tight">Wartezeit</th>
                <th className="pl-6 pr-3 py-2 print:px-1 print:py-1 font-medium leading-tight">Bemerkung</th>
                <th className="px-3 py-2 print:px-1 print:py-1 font-medium leading-tight text-right">
                  WZ-Zuschlag
                </th>
                <th className="px-3 py-2 print:px-1 print:py-1 font-medium leading-tight text-right">
                  ADR/IMO-
                  <br />
                  Zuschlag
                </th>
                <th className="px-3 py-2 print:px-1 print:py-1 font-medium leading-tight text-right">
                  Einzelpreis
                  <br />
                  netto
                </th>
                <th className="px-3 py-2 print:px-1 print:py-1 font-medium leading-tight text-right">
                  Gesamtpreis
                  <br />
                  netto
                </th>
              </tr>
            </thead>
            <tbody>
              {transports.map((transport) => {
                const hasMultiStops = (transport.legs ?? []).length > 1;

                // Render legs if multistop, otherwise just the main transport row
                const rowsToRender = hasMultiStops
                  ? (transport.legs ?? [])
                  : [{
                      sequence: 1,
                      fromPlace: transport.fromPlace,
                      toPlace: transport.toPlace,
                      isIMO: transport.isIMO,
                      waitingFrom: transport.waitingFrom,
                      waitingTo: transport.waitingTo,
                      waitingSurcharge: transport.waitingSurcharge,
                      basePrice: transport.basePrice,
                      totalPrice: transport.price,
                    }];

                const remarkText = transport.notes && transport.notes.trim().length > 0
                  ? transport.notes
                  : "";

                return (
                  <Fragment key={transport.id}>
                    {rowsToRender.map((row, rowIndex) => {
                      const isFirstRow = rowIndex === 0;
                      const rowBase = (row as { basePrice?: number }).basePrice ?? 0;
                      const rowWaiting = (row as { waitingSurcharge?: number }).waitingSurcharge ?? 0;
                      const rowWaitingFrom = (row as { waitingFrom?: string | null }).waitingFrom ?? null;
                      const rowWaitingTo = (row as { waitingTo?: string | null }).waitingTo ?? null;
                      const waitingLabel = rowWaitingFrom && rowWaitingTo
                        ? `${rowWaitingFrom} bis ${rowWaitingTo}`
                        : "";

                      const rowIsIMO = Boolean((row as { isIMO?: boolean }).isIMO);
                      const imoExtra = calculateImoSurcharge(rowIsIMO);
                      const singleNet = rowBase;
                      const rowTotalNet = rowBase + rowWaiting + imoExtra;

                      return (
                        <Fragment key={`${transport.id}-row-${rowIndex}`}>
                          <tr className="border-b border-slate-100 dark:border-slate-700/50 align-top">
                            {isFirstRow && (
                              <>
                                <td className="px-3 py-2 print:px-1 print:py-1 text-slate-700 dark:text-slate-300 leading-tight whitespace-normal break-words">
                                  {formatDate(new Date(transport.date))}
                                </td>
                                <td className="px-3 py-2 print:px-1 print:py-1 text-slate-700 dark:text-slate-300 leading-tight whitespace-normal break-words">
                                  {transport.orderNumber ?? "—"}
                                </td>
                                <td className="px-3 py-2 print:px-1 print:py-1 text-slate-700 dark:text-slate-300 leading-tight whitespace-normal break-words">
                                  {transport.jobNumber ?? "—"}
                                </td>
                              </>
                            )}
                            {!isFirstRow && (
                              <>
                                <td className="px-3 py-2 print:px-1 print:py-1"></td>
                                <td className="px-3 py-2 print:px-1 print:py-1"></td>
                                <td className="px-3 py-2 print:px-1 print:py-1"></td>
                              </>
                            )}

                            <td
                              className={`px-3 py-2 print:px-1 print:py-1 text-slate-700 dark:text-slate-300 leading-tight whitespace-normal break-words${
                                !isFirstRow ? " pl-8" : ""
                              }`}
                            >
                              {row.fromPlace}
                            </td>
                            <td className="px-3 py-2 print:px-1 print:py-1 text-slate-700 dark:text-slate-300 leading-tight whitespace-normal break-words">{row.toPlace}</td>

                            {/* Wartezeit-Spalte */}
                            <td className="px-3 py-2 print:px-1 print:py-1 text-slate-700 dark:text-slate-300 leading-tight whitespace-nowrap">
                              {waitingLabel}
                            </td>

                            <td className="pl-6 pr-3 py-2 print:px-1 print:py-1 text-slate-700 dark:text-slate-300 leading-tight whitespace-normal break-words">
                              {isFirstRow ? remarkText : ""}
                            </td>

                            {/* Wartezeiten-Zuschlag (Netto) */}
                            <td className="px-3 py-2 print:px-1 print:py-1 text-slate-700 dark:text-slate-300 leading-tight whitespace-nowrap text-right">
                              {rowWaiting > 0 ? formatCurrency(rowWaiting) : ""}
                            </td>

                            {/* ADR/IMO-Zuschlag (Netto) – nur einmal pro Container auf der ersten Zeile */}
                            <td className="px-3 py-2 print:px-1 print:py-1 text-slate-700 dark:text-slate-300 leading-tight whitespace-nowrap text-right">
                              {imoExtra > 0 ? formatCurrency(imoExtra) : ""}
                            </td>
                            {/* Einzelpreis netto (ohne Zuschläge) */}
                            <td className="px-3 py-2 print:px-1 print:py-1 text-slate-700 dark:text-slate-300 leading-tight whitespace-nowrap text-right">
                              {singleNet > 0 ? formatCurrency(singleNet) : ""}
                            </td>
                            {/* Gesamt netto (Einzelpreis + Wartezeit + ADR/IMO) */}
                            <td className="px-3 py-2 print:px-1 print:py-1 text-slate-700 dark:text-slate-300 leading-tight whitespace-nowrap text-right">
                              {rowTotalNet > 0 ? formatCurrency(rowTotalNet) : ""}
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
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
      </div>

      </div>
    </>
  );
}
