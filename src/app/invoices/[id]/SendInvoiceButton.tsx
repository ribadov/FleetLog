"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getTranslator, type Locale } from "@/lib/i18n";

type Props = {
  invoiceId: string;
  locale: Locale;
};

export default function SendInvoiceButton({ invoiceId, locale }: Props) {
  const router = useRouter();
  const t = getTranslator(locale);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
      });

      let data: { error?: string } | null = null;
      try {
        data = await response.json() as { error?: string };
      } catch {
        data = null;
      }

      if (!response.ok) {
        setError(data?.error || "Rechnung konnte nicht gesendet werden");
        return;
      }

      router.refresh();
    } catch {
      setError("Rechnung konnte nicht gesendet werden");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSend}
        disabled={loading}
        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {loading ? t("sending") : t("sendInvoice")}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
