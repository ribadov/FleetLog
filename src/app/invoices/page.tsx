import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";
import { getLocaleFromRequest } from "@/lib/i18n-server";
import { getTranslator } from "@/lib/i18n";
import Link from "next/link";
import { redirect } from "next/navigation";
import CreateInvoiceForContractorButton from "./CreateInvoiceForContractorButton";

export default async function InvoicesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const locale = await getLocaleFromRequest();
  const t = getTranslator(locale);

  const { isAdmin, workspaceId } = getTenantContext(session.user);

  if (!isAdmin && !workspaceId) {
    redirect("/dashboard");
  }

  const where =
    isAdmin
        ? {}
        : { workspaceId };

  const invoices = await prisma.invoice.findMany({
    where,
    include: { contractor: true },
    orderBy: { createdAt: "desc" },
  });

  const openTransports =
    session.user.role === "MANAGER"
      ? await prisma.transport.findMany({
          where: {
            workspaceId,
            contractorId: { not: null },
            invoiceId: null,
          },
          select: {
            contractorId: true,
            price: true,
          },
        })
      : [];

  const openByContractor = Array.from(
    openTransports.reduce((map, item) => {
      if (!item.contractorId) return map;

      const current = map.get(item.contractorId) ?? {
        contractorId: item.contractorId,
        _count: { _all: 0 },
        _sum: { price: 0 },
      };

      current._count._all += 1;
      current._sum.price += item.price ?? 0;
      map.set(item.contractorId, current);
      return map;
    }, new Map<string, { contractorId: string; _count: { _all: number }; _sum: { price: number } }>() ).values()
  );

  const contractorIds = openByContractor
    .map((item) => item.contractorId)
    .filter((id): id is string => Boolean(id));

  const contractors =
    contractorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: contractorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

  const contractorMap = new Map(contractors.map((contractor) => [contractor.id, contractor]));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t("invoices")}</h1>

      {session.user.role === "MANAGER" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden mb-8">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("openContainersByContractor")}</h2>
          </div>
          {openByContractor.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-500 dark:text-slate-400 text-sm">
              {t("noOpenContainersWaitingForInvoice")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-3 font-medium">{t("contractor")}</th>
                    <th className="px-4 py-3 font-medium">{t("email")}</th>
                    <th className="px-4 py-3 font-medium">{t("transports")}</th>
                    <th className="px-4 py-3 font-medium">{t("openTotal")}</th>
                    <th className="px-4 py-3 font-medium">{t("action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {openByContractor.map((item) => {
                    if (!item.contractorId) return null;
                    const contractor = contractorMap.get(item.contractorId);
                    if (!contractor) return null;

                    return (
                      <tr
                        key={item.contractorId}
                        className="border-b border-slate-100 dark:border-slate-700/50"
                      >
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{contractor.name}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{contractor.email}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{item._count._all}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">€{(item._sum.price ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <CreateInvoiceForContractorButton contractorId={item.contractorId} locale={locale} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden">
        {invoices.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
            {t("noInvoicesYet")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 font-medium">{t("invoiceNumber")}</th>
                  <th className="px-4 py-3 font-medium">{t("date")}</th>
                  <th className="px-4 py-3 font-medium">{t("contractor")}</th>
                  <th className="px-4 py-3 font-medium">{t("items")}</th>
                  <th className="px-4 py-3 font-medium">{t("price")}</th>
                  <th className="px-4 py-3 font-medium">{t("status")}</th>
                  <th className="px-4 py-3 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {new Date(invoice.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{invoice.contractor.name}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{invoice.itemsCount}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">€{invoice.totalAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {invoice.sentAt ? (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded">
                          {t("sent")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded">
                          {t("draft")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        {t("open")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
