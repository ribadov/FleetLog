"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Driver = { id: string; name: string };
type Contractor = { id: string; name: string };

export type TransportRow = {
  id: string;
  date: string;
  fromPlace: string;
  toPlace: string;
  containerSize: string;
  isIMO: boolean;
  waitingFrom: string | null;
  waitingTo: string | null;
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
}

function containerLabel(size: string) {
  return size.replace("SIZE_", "") + "ft";
}

export default function TransportsTable({ transports: initial, role, userId, showPrice }: Props) {
  const router = useRouter();
  const [transports, setTransports] = useState(initial);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transport?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/transports/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTransports((prev) => prev.filter((t) => t.id !== id));
      router.refresh();
    } else {
      setError("Failed to delete transport.");
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
              Create one
            </Link>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">From</th>
                  <th className="px-4 py-3 font-medium">To</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="px-4 py-3 font-medium">IMO</th>
                  <th className="px-4 py-3 font-medium">Waiting</th>
                  <th className="px-4 py-3 font-medium">Driver</th>
                  <th className="px-4 py-3 font-medium">Contractor</th>
                  {showPrice && <th className="px-4 py-3 font-medium">Price</th>}
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transports.map((t) => {
                  const canEdit =
                    role === "MANAGER" ||
                    (role === "DRIVER" && t.driver.id === userId);

                  return (
                    <tr
                      key={t.id}
                      className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{t.fromPlace}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{t.toPlace}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{containerLabel(t.containerSize)}</td>
                      <td className="px-4 py-3">
                        {t.isIMO ? (
                          <span className="inline-block px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded text-xs font-medium">IMO</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {t.waitingFrom && t.waitingTo ? `${t.waitingFrom}–${t.waitingTo}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{t.driver.name}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{t.contractor?.name ?? "—"}</td>
                      {showPrice && (
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {t.price != null ? `€${t.price.toFixed(2)}` : "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <Link
                              href={`/transports/${t.id}/edit`}
                              className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            >
                              Edit
                            </Link>
                          )}
                          {role === "MANAGER" && (
                            <button
                              onClick={() => handleDelete(t.id)}
                              disabled={deletingId === t.id}
                              className="px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-700 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                            >
                              {deletingId === t.id ? "…" : "Delete"}
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
