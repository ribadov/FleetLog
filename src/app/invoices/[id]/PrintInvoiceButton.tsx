"use client";

import { getTranslator, type Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  invoiceId: string;
};

export default function PrintInvoiceButton({ locale, invoiceId }: Props) {
  const t = getTranslator(locale);

  return (
    <a
      href={`/api/invoices/${invoiceId}/pdf`}
      download
      className="no-print inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
    >
      {t("downloadPdf")}
    </a>
  );
}
