"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LanguageSelector from "@/components/LanguageSelector";
import { getTranslator, readClientLocale, type Locale } from "@/lib/i18n";

export default function RegisterPage() {
  const router = useRouter();
  const [locale] = useState<Locale>(() => readClientLocale());
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phoneNumber: "",
    preferredLanguage: "",
    role: "DRIVER",
    workspaceCode: "",
    companyName: "",
    companyStreet: "",
    companyHouseNumber: "",
    companyPostalCode: "",
    companyCity: "",
    companyCountry: "",
    billingEmail: "",
    vatId: "",
    taxNumber: "",
    bankName: "",
    bankAccountHolder: "",
    iban: "",
    bic: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [workspaceCodeInfo, setWorkspaceCodeInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const t = useMemo(() => getTranslator(locale), [locale]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setWorkspaceCodeInfo("");
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Registration failed");
    } else {
      if (form.role === "MANAGER") {
        setSuccess(t("managerCreated"));
        if (data.workspaceCode) {
          setWorkspaceCodeInfo(`${t("yourWorkspaceCode")} ${data.workspaceCode}`);
        }
      } else {
        setSuccess(t("accountCreated"));
      }
      setTimeout(() => router.push("/login"), 1500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">FleetLog</h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">{t("registerSubtitle")}</p>
            <div className="mt-3 flex justify-center">
              <LanguageSelector currentLocale={locale} label={t("language")} />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 text-sm">
              {success}
              {workspaceCodeInfo && <div className="mt-2 font-semibold">{workspaceCodeInfo}</div>}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={form.name}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="John Smith"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t("phoneNumber")}
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={form.phoneNumber}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="+49 176 12345678"
              />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t("role")}
              </label>
              <select
                id="role"
                name="role"
                value={form.role}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              >
                <option value="DRIVER">{t("driver")}</option>
                <option value="CONTRACTOR">{t("contractor")}</option>
                <option value="MANAGER">{t("manager")}</option>
              </select>
            </div>

            <div>
              <label htmlFor="preferredLanguage" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t("language")}
              </label>
              <select
                id="preferredLanguage"
                name="preferredLanguage"
                value={form.preferredLanguage}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              >
                <option value="">{t("language")}</option>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
                <option value="ru">Русский</option>
                <option value="tr">Türkçe</option>
              </select>
            </div>

            {(form.role === "DRIVER" || form.role === "CONTRACTOR") && (
              <div>
                <label htmlFor="workspaceCode" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Workspace Code
                </label>
                <input
                  id="workspaceCode"
                  name="workspaceCode"
                  type="text"
                  required
                  value={form.workspaceCode}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="WS-XXXXXX"
                />
              </div>
            )}

            {form.role === "CONTRACTOR" && (
              <>
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Company Name
                  </label>
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    required
                    value={form.companyName}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="companyStreet" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Street
                    </label>
                    <input
                      id="companyStreet"
                      name="companyStreet"
                      type="text"
                      required
                      value={form.companyStreet}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="companyHouseNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      House Number
                    </label>
                    <input
                      id="companyHouseNumber"
                      name="companyHouseNumber"
                      type="text"
                      required
                      value={form.companyHouseNumber}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="companyPostalCode" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Postal Code
                    </label>
                    <input
                      id="companyPostalCode"
                      name="companyPostalCode"
                      type="text"
                      required
                      value={form.companyPostalCode}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="companyCity" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      City
                    </label>
                    <input
                      id="companyCity"
                      name="companyCity"
                      type="text"
                      required
                      value={form.companyCity}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="companyCountry" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Country
                  </label>
                  <input
                    id="companyCountry"
                    name="companyCountry"
                    type="text"
                    required
                    value={form.companyCountry}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <div>
                  <label htmlFor="billingEmail" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Rechnungs-E-Mail (optional)
                  </label>
                  <input
                    id="billingEmail"
                    name="billingEmail"
                    type="email"
                    value={form.billingEmail}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="rechnung@firma.de"
                  />
                </div>

                <div>
                  <label htmlFor="vatId" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Umsatzsteuer-Identifikationsnummer
                  </label>
                  <input
                    id="vatId"
                    name="vatId"
                    type="text"
                    required
                    value={form.vatId}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <div>
                  <label htmlFor="taxNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Steuernummer
                  </label>
                  <input
                    id="taxNumber"
                    name="taxNumber"
                    type="text"
                    required
                    value={form.taxNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>
              </>
            )}

            {form.role === "MANAGER" && (
              <>
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Firmenname
                  </label>
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    required
                    value={form.companyName}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="companyStreet" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Straße
                    </label>
                    <input
                      id="companyStreet"
                      name="companyStreet"
                      type="text"
                      required
                      value={form.companyStreet}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="companyHouseNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Hausnummer
                    </label>
                    <input
                      id="companyHouseNumber"
                      name="companyHouseNumber"
                      type="text"
                      required
                      value={form.companyHouseNumber}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="companyPostalCode" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      PLZ
                    </label>
                    <input
                      id="companyPostalCode"
                      name="companyPostalCode"
                      type="text"
                      required
                      value={form.companyPostalCode}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="companyCity" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Ort
                    </label>
                    <input
                      id="companyCity"
                      name="companyCity"
                      type="text"
                      required
                      value={form.companyCity}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="companyCountry" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Land
                  </label>
                  <input
                    id="companyCountry"
                    name="companyCountry"
                    type="text"
                    required
                    value={form.companyCountry}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <div>
                  <label htmlFor="vatId" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Umsatzsteuer-Identifikationsnummer
                  </label>
                  <input
                    id="vatId"
                    name="vatId"
                    type="text"
                    required
                    value={form.vatId}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <div>
                  <label htmlFor="taxNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Steuernummer
                  </label>
                  <input
                    id="taxNumber"
                    name="taxNumber"
                    type="text"
                    required
                    value={form.taxNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <div>
                  <label htmlFor="bankName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Bankname
                  </label>
                  <input
                    id="bankName"
                    name="bankName"
                    type="text"
                    required
                    value={form.bankName}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <div>
                  <label htmlFor="bankAccountHolder" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Zahlungsempfänger
                  </label>
                  <input
                    id="bankAccountHolder"
                    name="bankAccountHolder"
                    type="text"
                    required
                    value={form.bankAccountHolder}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <div>
                  <label htmlFor="iban" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    IBAN
                  </label>
                  <input
                    id="iban"
                    name="iban"
                    type="text"
                    required
                    value={form.iban}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <div>
                  <label htmlFor="bic" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    BIC
                  </label>
                  <input
                    id="bic"
                    name="bic"
                    type="text"
                    required
                    value={form.bic}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>
              </>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {t("alreadyHaveAccount")}{" "}
            <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              {t("signIn")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
