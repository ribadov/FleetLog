"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTranslator, type Locale } from "@/lib/i18n";

type Driver = { id: string; name: string };
type Contractor = { id: string; name: string };

export type TransportRow = {
  id: string;
  date: string;
  orderNumber: string | null;
  fromPlace: string;
  toPlace: string;
  containerSize: string;
  isIMO: boolean;
  waitingFrom: string | null;
  waitingTo: string | null;
  freightLetterPath: string | null;
  price: number | null;
  notes: string | null;
  driver: Driver;
  contractor: Contractor | null;
};

interface Props {
  transports: TransportRow[];
  role: string;
  userId: string;
  showPrice: boolean;
  locale: Locale;
}

function containerLabel(size: string) {
  return size.replace("SIZE_", "") + "ft";
}

export default function TransportsTable({ transports: initial, role, userId, showPrice, locale }: Props) {
  const router = useRouter();
  const tr = getTranslator(locale);
  const [transports, setTransports] = useState(initial);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleDelete = async (id: string) => {
    if (!confirm("Diesen Transport löschen?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/transports/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTransports((prev) => prev.filter((t) => t.id !== id));
      router.refresh();
    } else {
      setError("Transport konnte nicht gelöscht werden.");
    }
    setDeletingId(null);
  };

  return (
    <>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      )}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden">
        {transports.length === 0 ? (
          <div className="px-6 py-16 text-center text-slate-500 dark:text-slate-400">
            No transports yet.{" "}
            <Link href="/transports/new" className="text-blue-600 hover:underline">
              {tr("createAccount")}
            </Link>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 font-medium">{tr("date")}</th>
                  <th className="px-4 py-3 font-medium">Order #</th>
                  <th className="px-4 py-3 font-medium">{tr("from")}</th>
                  <th className="px-4 py-3 font-medium">{tr("to")}</th>
                  <th className="px-4 py-3 font-medium">{tr("size")}</th>
                  <th className="px-4 py-3 font-medium">IMO</th>
                  <th className="px-4 py-3 font-medium">{tr("waiting")}</th>
                  <th className="px-4 py-3 font-medium">Driver</th>
                  <th className="px-4 py-3 font-medium">Contractor</th>
                  <th className="px-4 py-3 font-medium">Freight Letter</th>
                  {showPrice && <th className="px-4 py-3 font-medium">{tr("price")}</th>}
                  <th className="px-4 py-3 font-medium">{tr("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {transports.map((transport) => {
                  const canEdit =
                    role === "MANAGER" ||
                    (role === "DRIVER" && transport.driver.id === userId);

                  return (
                    <tr
                      key={transport.id}
                      className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {new Date(transport.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{transport.orderNumber ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{transport.fromPlace}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{transport.toPlace}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{containerLabel(transport.containerSize)}</td>
                      <td className="px-4 py-3">
                        {transport.isIMO ? (
                          <span className="inline-block px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded text-xs font-medium">IMO</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {transport.waitingFrom && transport.waitingTo ? `${transport.waitingFrom}–${transport.waitingTo}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{transport.driver.name}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{transport.contractor?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {transport.freightLetterPath ? (
                          <a
                            href={transport.freightLetterPath}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            PDF
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      {showPrice && (
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {transport.price != null ? `€${transport.price.toFixed(2)}` : "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <Link
                              href={`/transports/${transport.id}/edit`}
                              className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            >
                              {tr("open")}
                            </Link>
                          )}
                          {role === "MANAGER" && (
                            <button
                              onClick={() => handleDelete(transport.id)}
                              disabled={deletingId === transport.id}
                              className="px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-700 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                            >
                              {deletingId === transport.id ? "…" : "Löschen"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
