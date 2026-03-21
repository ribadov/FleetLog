"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Driver = { id: string; name: string }
type Contractor = { id: string; name: string }

type Transport = {
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

function containerLabel(size: string) {
  return size.replace("SIZE_", "") + "ft";
}

export default function TransportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [transports, setTransports] = useState<Transport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const role = session?.user?.role;

  const fetchTransports = async () => {
    setLoading(true);
    const res = await fetch("/api/transports");
    if (res.ok) {
      setTransports(await res.json());
    } else {
      setError("Failed to load transports");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated") fetchTransports();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transport?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/transports/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTransports((prev) => prev.filter((t) => t.id !== id));
    } else {
      setError("Failed to delete transport");
    }
    setDeletingId(null);
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Loading…
      </div>
    );
  }

  const showPrice = role === "MANAGER" || role === "CONTRACTOR";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Transports</h1>
        <Link
          href="/transports/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + New Transport
        </Link>
      </div>

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
                    (role === "DRIVER" && t.driver.id === session?.user?.id);

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
    </div>
  );
}
