import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";
import { getLocaleFromRequest } from "@/lib/i18n-server";
import { getTranslator } from "@/lib/i18n";
import Link from "next/link";
import TransportsTable from "./TransportsTable";

export default async function TransportsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role;
  const userId = session.user.id;
  const locale = await getLocaleFromRequest();
  const t = getTranslator(locale);
  const { isAdmin, workspaceId } = getTenantContext(session.user);

  const where = {
    ...(isAdmin ? {} : { workspaceId: workspaceId ?? undefined }),
    ...(role === "DRIVER" ? { driverId: userId } : {}),
  };

  const transports = await prisma.transport.findMany({
    where,
    include: { driver: true, contractor: true, seller: true },
    orderBy: { date: "desc" },
  });

  // Hide prices from drivers
  const sanitized = transports.map((t) => ({
    ...t,
    price: role === "DRIVER" ? null : t.price,
    date: t.date.toISOString(),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  const showPrice = role === "MANAGER" || role === "CONTRACTOR";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Transports</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/transports/new"
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {t("newTransport")}
          </Link>
        </div>
      </div>
      <TransportsTable
        transports={sanitized}
        role={role}
        userId={userId}
        showPrice={showPrice}
        locale={locale}
      />
    </div>
  );
}
