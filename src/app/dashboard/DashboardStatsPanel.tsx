"use client";

import { useState } from "react";

type StatsTransport = {
  date: string;
  price: number;
  contractorName: string | null;
  sellerName: string | null;
};

type Props = {
  role: string;
  nowIso: string;
  transports: StatsTransport[];
};

type Timeframe = "year" | "month" | "week" | "day";

function toDayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function labelForDay(dayKey: string) {
  const [year, month, day] = dayKey.split("-");
  return `${day}.${month}.${year}`;
}

function startOfTimeframe(now: Date, timeframe: Timeframe): Date {
  const date = new Date(now);

  if (timeframe === "day") {
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  if (timeframe === "week") {
    const day = date.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    date.setUTCDate(date.getUTCDate() - diff);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  if (timeframe === "month") {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  }

  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
}

function chartPath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";

  const max = Math.max(1, ...values);
  const stepX = values.length > 1 ? width / (values.length - 1) : width;

  return values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - (value / max) * height;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

export default function DashboardStatsPanel({ role, nowIso, transports }: Props) {
  const [timeframe, setTimeframe] = useState<Timeframe>("month");
  const [selectedParty, setSelectedParty] = useState("all");

  const partyLabel = role === "CONTRACTOR" ? "Auftragnehmer" : "Auftraggeber";

  const partyNameOf = (row: StatsTransport) => {
    if (role === "CONTRACTOR") return row.sellerName ?? "Unbekannt";
    return row.contractorName ?? "Unbekannt";
  };

  const now = new Date(nowIso);
  const since = startOfTimeframe(now, timeframe);

  const filteredData = transports.filter((row) => {
    const date = new Date(row.date);
    if (date < since || date > now) return false;
    if (selectedParty !== "all" && partyNameOf(row) !== selectedParty) return false;
    return true;
  });

  const overallRevenue = filteredData.reduce((sum, row) => sum + row.price, 0);

  const revenueByPartyMap = new Map<string, number>();
  for (const row of filteredData) {
    const name = partyNameOf(row);
    revenueByPartyMap.set(name, (revenueByPartyMap.get(name) ?? 0) + row.price);
  }
  const revenueByParty = [...revenueByPartyMap.entries()]
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  const chartPointsMap = new Map<string, number>();
  for (const row of filteredData) {
    const dayKey = toDayKey(new Date(row.date));
    chartPointsMap.set(dayKey, (chartPointsMap.get(dayKey) ?? 0) + 1);
  }
  const chartEntries = [...chartPointsMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const chartPoints = {
    labels: chartEntries.map((entry) => entry[0]),
    values: chartEntries.map((entry) => entry[1]),
  };

  const unique = new Set<string>();
  for (const row of transports) {
    unique.add(partyNameOf(row));
  }
  const options = [...unique].sort((a, b) => a.localeCompare(b));

  const width = 720;
  const height = 180;
  const path = chartPath(chartPoints.values, width, height);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6 mb-10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Statistiken</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={timeframe}
            onChange={(event) => setTimeframe(event.target.value as Timeframe)}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
          >
            <option value="year">Jahr</option>
            <option value="month">Monat</option>
            <option value="week">Woche</option>
            <option value="day">Tag</option>
          </select>

          <select
            value={selectedParty}
            onChange={(event) => setSelectedParty(event.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
          >
            <option value="all">{partyLabel}: Insgesamt</option>
            {options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Gesamtumsatz</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            €{overallRevenue.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Zeitraum: {timeframe}</p>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Auftragsvolumen</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {chartPoints.values.reduce((sum, value) => sum + value, 0)} Container
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Anzahl Transporte im Zeitraum</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">Auftragsvolumen pro Tag (Graph)</p>
        {chartPoints.values.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Keine Daten im ausgewählten Zeitraum.</p>
        ) : (
          <div className="space-y-2">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
              <rect x="0" y="0" width={width} height={height} fill="transparent" />
              <path d={path} fill="none" stroke="currentColor" strokeWidth="3" className="text-blue-600 dark:text-blue-400" />
            </svg>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-500 dark:text-slate-400">
              {chartPoints.labels.slice(-8).map((label, index) => (
                <div key={`${label}-${index}`} className="truncate">{labelForDay(label)}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">Umsatz nach {partyLabel}</p>
        {revenueByParty.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Keine Daten im ausgewählten Zeitraum.</p>
        ) : (
          <div className="space-y-2">
            {revenueByParty.map((row) => (
              <div key={row.name} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">{row.name}</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  €{row.revenue.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
