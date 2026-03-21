import type { Metadata } from "next";
import "./globals.css";
import { auth } from "@/auth";
import { signOut } from "@/auth";
import Link from "next/link";
import Providers from "./providers";
import LanguageSelector from "@/components/LanguageSelector";
import { getLocaleFromRequest } from "@/lib/i18n-server";
import { getTranslator } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "FleetLog",
  description: "Fleet transport management system",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const user = session?.user;
  const locale = await getLocaleFromRequest();
  const t = getTranslator(locale);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans">
        {user && (
          <nav className="bg-blue-700 dark:bg-blue-900 text-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-6">
                  <Link href="/dashboard" className="text-xl font-bold tracking-tight hover:text-blue-200 transition-colors">
                    {t("appName")}
                  </Link>
                  <div className="hidden sm:flex items-center gap-4 text-sm font-medium">
                    <Link href="/dashboard" className="hover:text-blue-200 transition-colors">
                      {t("dashboard")}
                    </Link>
                    {user.role !== "ADMIN" && (
                      <Link href="/transports" className="hover:text-blue-200 transition-colors">
                        {t("transports")}
                      </Link>
                    )}
                    {(user.role === "CONTRACTOR" || user.role === "MANAGER") && (
                      <Link href="/invoices" className="hover:text-blue-200 transition-colors">
                        {t("invoices")}
                      </Link>
                    )}
                    {user.role === "ADMIN" && (
                      <Link href="/admin" className="hover:text-blue-200 transition-colors">
                        {t("admin")}
                      </Link>
                    )}
                    {user.role !== "ADMIN" && (
                      <Link href="/transports/new" className="hover:text-blue-200 transition-colors">
                        {t("newTransport")}
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <LanguageSelector currentLocale={locale} label={t("language")} />
                  <span className="hidden sm:block text-blue-200">
                    {user.name} &middot; <span className="text-blue-300">{user.role}</span>
                  </span>
                  <Link href="/profile" className="hidden sm:block bg-blue-600 dark:bg-blue-800 hover:bg-blue-500 dark:hover:bg-blue-700 px-3 py-1.5 rounded text-white text-sm font-medium transition-colors">
                    {t("profile")}
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/login" });
                    }}
                  >
                    <button
                      type="submit"
                      className="bg-blue-600 dark:bg-blue-800 hover:bg-blue-500 dark:hover:bg-blue-700 px-3 py-1.5 rounded text-white text-sm font-medium transition-colors"
                    >
                      {t("signOut")}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </nav>
        )}
        <Providers>
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
