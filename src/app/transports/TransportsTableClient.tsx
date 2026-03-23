"use client";

import { useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";
import TransportsTable, { type TransportRow } from "./TransportsTable";

type Props = {
  transports: TransportRow[];
  role: string;
  userId: string;
  showPrice: boolean;
  locale: Locale;
};

export default function TransportsTableClient(props: Props) {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!isClient) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden">
        <div className="px-6 py-16 text-center text-slate-500 dark:text-slate-400">Lade Transporte…</div>
      </div>
    );
  }

  return <TransportsTable {...props} />;
}
