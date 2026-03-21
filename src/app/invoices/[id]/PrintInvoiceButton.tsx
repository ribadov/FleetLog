"use client";

import { getTranslator, type Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
};

export default function PrintInvoiceButton({ locale }: Props) {
  const t = getTranslator(locale);
  return (
    <button
      onClick={() => window.print()}
      className="no-print inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
    >
      {t("downloadPdf")}
    </button>
  );
}