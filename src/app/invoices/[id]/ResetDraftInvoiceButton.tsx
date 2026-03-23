"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  invoiceId: string;
};

export default function ResetDraftInvoiceButton({ invoiceId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async () => {
    const confirmed = confirm("Entwurfsrechnung wirklich zurücksetzen? Zugeordnete Transporte werden wieder offen.");
    if (!confirmed) return;

    setError("");
    setLoading(true);

    const response = await fetch(`/api/invoices/${invoiceId}/reset`, {
      method: "POST",
    });

    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Rechnung konnte nicht zurückgesetzt werden");
      return;
    }

    router.push("/invoices");
    router.refresh();
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleReset}
        disabled={loading}
        className="inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {loading ? "Zurücksetzen…" : "Entwurf zurücksetzen"}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
