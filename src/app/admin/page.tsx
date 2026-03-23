import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLocaleFromRequest } from "@/lib/i18n-server";
import { getTranslator } from "@/lib/i18n";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await auth();
  if (!session) redirect("/login");

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const locale = await getLocaleFromRequest();
  const t = getTranslator(locale);

  const workspaces = await prisma.workspace.findMany({
    include: {
      manager: { select: { id: true, name: true, email: true } },
      _count: { select: { users: true, transports: true, invoices: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t("adminOverview")}</h1>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden">
        {workspaces.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">No workspaces found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 font-medium">Workspace</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Manager</th>
                  <th className="px-4 py-3 font-medium">Manager Email</th>
                  <th className="px-4 py-3 font-medium">{t("totalUsers")}</th>
                  <th className="px-4 py-3 font-medium">{t("transports")}</th>
                  <th className="px-4 py-3 font-medium">{t("invoices")}</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((workspace) => (
                  <tr key={workspace.id} className="border-b border-slate-100 dark:border-slate-700/50">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{workspace.name}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono">{workspace.code}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{workspace.manager.name}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{workspace.manager.email}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{workspace._count.users}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{workspace._count.transports}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{workspace._count.invoices}</td>
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
