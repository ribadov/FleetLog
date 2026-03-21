import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";
import { getLocaleFromRequest } from "@/lib/i18n-server";
import { getTranslator } from "@/lib/i18n";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user;
  const { isAdmin, workspaceId } = getTenantContext(user);
  const locale = await getLocaleFromRequest();
  const t = getTranslator(locale);

  let totalTransports = 0;
  let totalRevenue = 0;
  let totalWorkspaces = 0;
  let totalUsers = 0;
  let workspaceCode: string | null = null;

  if (!isAdmin && user.role !== "CONTRACTOR" && !workspaceId) {
    redirect("/login");
  }

  if (user.role === "ADMIN") {
    totalWorkspaces = await prisma.workspace.count();
    totalUsers = await prisma.user.count();
    totalTransports = await prisma.transport.count();
    const result = await prisma.transport.aggregate({ _sum: { price: true } });
    totalRevenue = result._sum.price ?? 0;
  } else if (user.role === "DRIVER") {
    totalTransports = await prisma.transport.count({
      where: { driverId: user.id, workspaceId },
    });
  } else if (user.role === "MANAGER") {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId ?? "" },
      select: { code: true },
    });
    workspaceCode = workspace?.code ?? null;

    totalTransports = await prisma.transport.count({ where: { workspaceId } });
    const result = await prisma.transport.aggregate({
      where: { workspaceId },
      _sum: { price: true },
    });
    totalRevenue = result._sum.price ?? 0;
  } else {
    totalTransports = await prisma.transport.count({ where: { contractorId: user.id } });
  }

  const recentTransports = await prisma.transport.findMany({
    where:
      user.role === "ADMIN"
        ? {}
        : user.role === "DRIVER"
          ? { driverId: user.id, workspaceId }
          : user.role === "CONTRACTOR"
            ? { contractorId: user.id }
            : { workspaceId },
    include: { driver: true },
    orderBy: { date: "desc" },
    take: 5,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Welcome back, {user.name}
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          {t("role")}: <span className="font-medium text-blue-600 dark:text-blue-400">{user.role}</span>
        </p>
        {user.role === "MANAGER" && workspaceCode && (
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Workspace Code: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{workspaceCode}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t("totalTransports")}</p>
          <p className="mt-2 text-4xl font-bold text-slate-900 dark:text-white">{totalTransports}</p>
        </div>

        {user.role === "ADMIN" && (
          <>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t("totalWorkspaces")}</p>
              <p className="mt-2 text-4xl font-bold text-slate-900 dark:text-white">{totalWorkspaces}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t("totalUsers")}</p>
              <p className="mt-2 text-4xl font-bold text-slate-900 dark:text-white">{totalUsers}</p>
            </div>
          </>
        )}

        {user.role === "MANAGER" && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t("totalRevenue")}</p>
            <p className="mt-2 text-4xl font-bold text-green-600 dark:text-green-400">
              €{totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6 flex flex-col gap-3">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Quick Actions</p>
          {user.role === "ADMIN" ? (
            <Link
              href="/admin"
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Open Admin Overview
            </Link>
          ) : (
            <>
              <Link
                href="/transports/new"
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {t("newTransport")}
              </Link>
              <Link
                href="/transports"
                className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                View All Transports
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Transports</h2>
        </div>
        {recentTransports.length === 0 ? (
          <div className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
            No transports found. <Link href="/transports/new" className="text-blue-600 hover:underline">Create your first one.</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">From</th>
                  <th className="px-6 py-3 font-medium">To</th>
                  <th className="px-6 py-3 font-medium">Size</th>
                  <th className="px-6 py-3 font-medium">Driver</th>
                </tr>
              </thead>
              <tbody>
                {recentTransports.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{t.fromPlace}</td>
                    <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{t.toPlace}</td>
                    <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{t.containerSize.replace("SIZE_", "")} ft</td>
                    <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{t.driver.name}</td>
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
