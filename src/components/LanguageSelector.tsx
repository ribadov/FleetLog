"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { localeLabel, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";

type Props = {
  currentLocale: Locale;
  label: string;
  onLocaleChange?: (locale: Locale) => void;
};

export default function LanguageSelector({ currentLocale, label, onLocaleChange }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<Locale>(currentLocale);
  const [loading, setLoading] = useState(false);

  const onChange = async (nextLocale: Locale) => {
    setValue(nextLocale);
    onLocaleChange?.(nextLocale);
    setLoading(true);

    await fetch("/api/language", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: nextLocale }),
    });

    setLoading(false);
    router.refresh();
  };

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => void onChange(event.target.value as Locale)}
        disabled={loading}
        className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {localeLabel(locale)}
          </option>
        ))}
      </select>
    </label>
  );
}
