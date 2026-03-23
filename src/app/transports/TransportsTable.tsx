"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTranslator, type Locale } from "@/lib/i18n";

type Driver = { id: string; name: string };
type Contractor = { id: string; name: string };
type Seller = { id: string; name: string };

export type TransportRow = {
  id: string;
  date: string;
  orderNumber: string | null;
  jobNumber?: string | null;
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
  seller?: Seller | null;
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

function dayKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function TransportsTable({ transports: initial, role, userId, showPrice, locale }: Props) {
  const router = useRouter();
  const tr = getTranslator(locale);
  const [transports, setTransports] = useState(initial);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [partyId, setPartyId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [containerSize, setContainerSize] = useState("");
  const [imoFilter, setImoFilter] = useState<"all" | "yes" | "no">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState<
    "date_desc" | "date_asc" | "price_desc" | "price_asc" | "driver_asc" | "party_asc" | "size_asc"
  >("date_desc");

  const partyLabel = "Auftraggeber";

  const partyNameOf = useCallback((transport: TransportRow) => {
    if (role === "CONTRACTOR") return transport.seller?.name ?? "—";
    if (role === "MANAGER") return transport.contractor?.name ?? "—";
    return transport.contractor?.name ?? transport.seller?.name ?? "—";
  }, [role]);

  const partyIdOf = useCallback((transport: TransportRow) => {
    if (role === "CONTRACTOR") return transport.seller?.id ?? "";
    if (role === "MANAGER") return transport.contractor?.id ?? "";
    return transport.contractor?.id ?? transport.seller?.id ?? "";
  }, [role]);

  const partyOptions = useMemo(() => {
    const items = new Map<string, string>();
    for (const transport of transports) {
      const id = partyIdOf(transport);
      const name = partyNameOf(transport);
      if (id) items.set(id, name);
    }
    return [...items.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [transports, partyIdOf, partyNameOf]);

  const driverOptions = useMemo(() => {
    const items = new Map<string, string>();
    for (const transport of transports) {
      if (transport.driver?.id) items.set(transport.driver.id, transport.driver.name);
    }
    return [...items.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [transports]);

  const filteredSorted = useMemo(() => {
    const min = minPrice.trim() ? Number(minPrice) : null;
    const max = maxPrice.trim() ? Number(maxPrice) : null;
    const fromBoundary = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const toBoundary = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
    const query = search.trim().toLowerCase();

    const filtered = transports.filter((transport) => {
      if (partyId && partyIdOf(transport) !== partyId) return false;
      if (driverId && transport.driver.id !== driverId) return false;
      if (containerSize && transport.containerSize !== containerSize) return false;
      if (imoFilter === "yes" && !transport.isIMO) return false;
      if (imoFilter === "no" && transport.isIMO) return false;

      if (fromBoundary || toBoundary) {
        const currentDate = new Date(transport.date);
        if (fromBoundary && currentDate < fromBoundary) return false;
        if (toBoundary && currentDate > toBoundary) return false;
      }

      if (showPrice && transport.price != null) {
        if (min != null && !Number.isNaN(min) && transport.price < min) return false;
        if (max != null && !Number.isNaN(max) && transport.price > max) return false;
      }

      if (query) {
        const haystack = [
          transport.orderNumber ?? "",
          transport.jobNumber ?? "",
          transport.fromPlace,
          transport.toPlace,
          transport.driver?.name ?? "",
          transport.contractor?.name ?? "",
          transport.seller?.name ?? "",
          transport.notes ?? "",
          containerLabel(transport.containerSize),
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((left, right) => {
      switch (sortBy) {
        case "date_asc":
          return new Date(left.date).getTime() - new Date(right.date).getTime();
        case "date_desc":
          return new Date(right.date).getTime() - new Date(left.date).getTime();
        case "price_asc":
          return (left.price ?? Number.NEGATIVE_INFINITY) - (right.price ?? Number.NEGATIVE_INFINITY);
        case "price_desc":
          return (right.price ?? Number.NEGATIVE_INFINITY) - (left.price ?? Number.NEGATIVE_INFINITY);
        case "driver_asc":
          return left.driver.name.localeCompare(right.driver.name);
        case "party_asc":
          return partyNameOf(left).localeCompare(partyNameOf(right));
        case "size_asc":
          return left.containerSize.localeCompare(right.containerSize);
        default:
          return 0;
      }
    });

    return sorted;
  }, [transports, partyId, driverId, containerSize, imoFilter, dateFrom, dateTo, minPrice, maxPrice, search, sortBy, showPrice, partyIdOf, partyNameOf]);

  const grouped = useMemo(() => {
    const byCounterpartyAndDate = role === "MANAGER" || role === "CONTRACTOR";
    const groups = new Map<string, { partyName: string; dateKey: string; rows: TransportRow[] }>();

    for (const transport of filteredSorted) {
      const date = dayKey(transport.date);
      const partyName = byCounterpartyAndDate ? partyNameOf(transport) : "Alle Transporte";
      const key = byCounterpartyAndDate ? `${partyName}__${date}` : date;

      if (!groups.has(key)) {
        groups.set(key, { partyName, dateKey: date, rows: [] });
      }
      groups.get(key)!.rows.push(transport);
    }

    return [...groups.values()].sort((left, right) => {
      if (left.partyName !== right.partyName) {
        return left.partyName.localeCompare(right.partyName);
      }
      return right.dateKey.localeCompare(left.dateKey);
    });
  }, [filteredSorted, role, partyNameOf]);

  const handleDelete = async (id: string) => {
    if (!confirm(tr("confirmDeleteTransport"))) return;
    setDeletingId(id);
    const res = await fetch(`/api/transports/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTransports((prev) => prev.filter((t) => t.id !== id));
      router.refresh();
    } else {
      setError(tr("transportDeleteFailed"));
    }
    setDeletingId(null);
  };

  return (
    <>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      )}
      <div className="mb-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Suche: Container, Orte, Fahrer, Partner…"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
          />

          {(role === "MANAGER" || role === "CONTRACTOR") && (
            <select
              value={partyId}
              onChange={(event) => setPartyId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            >
              <option value="">{partyLabel}: Alle</option>
              {partyOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          )}

          <select
            value={driverId}
            onChange={(event) => setDriverId(event.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
          >
            <option value="">Fahrer: Alle</option>
            {driverOptions.map((driver) => (
              <option key={driver.id} value={driver.id}>{driver.name}</option>
            ))}
          </select>

          <select
            value={containerSize}
            onChange={(event) => setContainerSize(event.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
          >
            <option value="">Containergröße: Alle</option>
            <option value="SIZE_20">20ft</option>
            <option value="SIZE_40">40ft</option>
            <option value="SIZE_45">45ft</option>
          </select>

          <select
            value={imoFilter}
            onChange={(event) => setImoFilter(event.target.value as "all" | "yes" | "no")}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
          >
            <option value="all">IMO/ADR: Alle</option>
            <option value="yes">Nur IMO/ADR</option>
            <option value="no">Ohne IMO/ADR</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
          />

          {showPrice && (
            <input
              type="number"
              min="0"
              step="0.01"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder="Min. Preis"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            />
          )}
          {showPrice && (
            <input
              type="number"
              min="0"
              step="0.01"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder="Max. Preis"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            />
          )}

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
          >
            <option value="date_desc">Sortierung: Datum (neueste zuerst)</option>
            <option value="date_asc">Sortierung: Datum (älteste zuerst)</option>
            <option value="party_asc">Sortierung: Partner (A-Z)</option>
            <option value="driver_asc">Sortierung: Fahrer (A-Z)</option>
            <option value="size_asc">Sortierung: Größe</option>
            {showPrice && <option value="price_desc">Sortierung: Preis (hoch→niedrig)</option>}
            {showPrice && <option value="price_asc">Sortierung: Preis (niedrig→hoch)</option>}
          </select>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden">
        {grouped.length === 0 ? (
          <div className="px-6 py-16 text-center text-slate-500 dark:text-slate-400">
            {tr("noTransportsYet")} {" "}
            <Link href="/transports/new" className="text-blue-600 hover:underline">
              {tr("createTransport")}
            </Link>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 font-medium">{tr("date")}</th>
                  <th className="px-4 py-3 font-medium">{tr("containerNumber")}</th>
                  <th className="px-4 py-3 font-medium">{tr("orderNumber")}</th>
                  <th className="px-4 py-3 font-medium">{tr("from")}</th>
                  <th className="px-4 py-3 font-medium">{tr("to")}</th>
                  <th className="px-4 py-3 font-medium">{tr("size")}</th>
                  <th className="px-4 py-3 font-medium">{tr("imo")}</th>
                  <th className="px-4 py-3 font-medium">{tr("waiting")}</th>
                  <th className="px-4 py-3 font-medium">{tr("driver")}</th>
                  <th className="px-4 py-3 font-medium">{partyLabel}</th>
                  <th className="px-4 py-3 font-medium">{tr("freightLetter")}</th>
                  {showPrice && <th className="px-4 py-3 font-medium">{tr("price")}</th>}
                  <th className="px-4 py-3 font-medium">{tr("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => (
                  <Fragment key={`group-${group.partyName}-${group.dateKey}`}>
                    <tr className="bg-slate-100 dark:bg-slate-700/40 border-y border-slate-200 dark:border-slate-600">
                      <td
                        colSpan={showPrice ? 13 : 12}
                        className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200"
                      >
                        {(role === "MANAGER" || role === "CONTRACTOR")
                          ? `${partyLabel}: ${group.partyName} • ${new Date(group.dateKey).toLocaleDateString()} • ${group.rows.length} Transporte`
                          : `${new Date(group.dateKey).toLocaleDateString()} • ${group.rows.length} Transporte`}
                      </td>
                    </tr>
                    {group.rows.map((transport) => {
                      const canEdit =
                        role === "MANAGER" ||
                        role === "CONTRACTOR" ||
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
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{transport.jobNumber ?? "—"}</td>
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
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{partyNameOf(transport)}</td>
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
                                  {deletingId === transport.id ? "…" : tr("delete")}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
