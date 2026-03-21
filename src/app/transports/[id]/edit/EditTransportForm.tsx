"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getTranslator, readClientLocale, type Locale } from "@/lib/i18n";

type User = { id: string; name: string; role: string };
type LegForm = {
  fromPlace: string;
  toPlace: string;
  waitingFrom: string;
  waitingTo: string;
  price: string;
};

type Transport = {
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
  basePrice: number;
  waitingMinutes: number;
  waitingSurcharge: number;
  price: number;
  notes: string | null;
  driverId: string;
  contractorId: string | null;
  sellerId: string | null;
  legs?: Array<{
    id: string;
    sequence: number;
    fromPlace: string;
    toPlace: string;
    waitingFrom: string | null;
    waitingTo: string | null;
    basePrice: number;
    totalPrice: number;
  }>;
};

type Props = {
  transport: Transport;
  users: User[];
  places: string[];
  role: string;
  allowedManagerIds: string[];
};

export default function EditTransportForm({ transport, users, places, role, allowedManagerIds }: Props) {
  const router = useRouter();
  const [locale] = useState<Locale>(() => readClientLocale());
  const t = useMemo(() => getTranslator(locale), [locale]);

  const [form, setForm] = useState({
    date: transport.date.slice(0, 10),
    containerNumber: transport.orderNumber ?? "",
    orderNumber: transport.jobNumber ?? "",
    containerSize: transport.containerSize,
    isIMO: transport.isIMO,
    driverId: transport.driverId,
    contractorId: transport.contractorId ?? "",
    sellerId: transport.sellerId ?? "",
    notes: transport.notes ?? "",
    legs:
      transport.legs && transport.legs.length > 0
        ? transport.legs
            .slice()
            .sort((a, b) => a.sequence - b.sequence)
            .map((leg) => ({
              fromPlace: leg.fromPlace,
              toPlace: leg.toPlace,
              waitingFrom: leg.waitingFrom ?? "",
              waitingTo: leg.waitingTo ?? "",
              price: leg.basePrice.toString(),
            }))
        : [
            {
              fromPlace: transport.fromPlace,
              toPlace: transport.toPlace,
              waitingFrom: transport.waitingFrom ?? "",
              waitingTo: transport.waitingTo ?? "",
              price: transport.basePrice?.toString() ?? transport.price?.toString() ?? "",
            },
          ],
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [freightLetterFile, setFreightLetterFile] = useState<File | null>(null);

  const drivers = users.filter((user) => user.role === "DRIVER");
  const contractors = users.filter((user) => user.role === "CONTRACTOR");
  const managers = users.filter((user) => user.role === "MANAGER");
  const availableSubcontractors = role === "CONTRACTOR"
    ? managers.filter((manager) => allowedManagerIds.includes(manager.id))
    : managers;

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = event.target;
    if (type === "checkbox") {
      setForm((previous) => ({ ...previous, [name]: (event.target as HTMLInputElement).checked }));
    } else {
      setForm((previous) => ({ ...previous, [name]: value }));
    }
  };

  const handleLegChange = (index: number, field: keyof LegForm, value: string) => {
    setForm((previous) => {
      const nextLegs = [...previous.legs];
      nextLegs[index] = { ...nextLegs[index], [field]: value };
      return { ...previous, legs: nextLegs };
    });
  };

  const addLeg = () => {
    setForm((previous) => ({
      ...previous,
      legs: [...previous.legs, { fromPlace: "", toPlace: "", waitingFrom: "", waitingTo: "", price: "" }],
    }));
  };

  const removeLeg = (index: number) => {
    setForm((previous) => {
      if (previous.legs.length === 1) return previous;
      return {
        ...previous,
        legs: previous.legs.filter((_, currentIndex) => currentIndex !== index),
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const body = {
      ...form,
      containerNumber: form.containerNumber,
      contractorId: form.contractorId || null,
      sellerId: form.sellerId || null,
      notes: form.notes || null,
      legs: form.legs.map((leg) => ({
        fromPlace: leg.fromPlace,
        toPlace: leg.toPlace,
        waitingFrom: leg.waitingFrom || null,
        waitingTo: leg.waitingTo || null,
        price: leg.price ? parseFloat(leg.price) : 0,
      })),
    };

    const response = await fetch(`/api/transports/${transport.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (response.ok) {
      if (freightLetterFile) {
        const uploadData = new FormData();
        uploadData.append("file", freightLetterFile);

        const uploadResponse = await fetch(`/api/transports/${transport.id}/freight-letter`, {
          method: "POST",
          body: uploadData,
        });

        if (!uploadResponse.ok) {
          const uploadError = await uploadResponse.json();
          setError(uploadError.error || t("freightLetterUploadFailedUpdate"));
          return;
        }
      }

      router.push("/transports");
    } else {
      const data = await response.json();
      setError(data.error || t("transportUpdateFailed"));
    }
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition";
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("editTransportTitle")}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("editTransportSubtitle")}</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl shadow p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="date" className={labelClass}>{t("date")} *</label>
            <input id="date" name="date" type="date" required value={form.date} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label htmlFor="containerNumber" className={labelClass}>{t("containerNumber")} *</label>
            <input
              id="containerNumber"
              name="containerNumber"
              type="text"
              required
              value={form.containerNumber}
              onChange={handleChange}
              className={inputClass}
              placeholder="MSCU1234567"
            />
          </div>
          <div>
            <label htmlFor="orderNumber" className={labelClass}>{t("orderNumber")}</label>
            <input
              id="orderNumber"
              name="orderNumber"
              type="text"
              value={form.orderNumber}
              onChange={handleChange}
              className={inputClass}
              placeholder={t("optional")}
            />
          </div>
          <div>
            <label htmlFor="containerSize" className={labelClass}>{t("size")} *</label>
            <select id="containerSize" name="containerSize" value={form.containerSize} onChange={handleChange} className={inputClass}>
              <option value="SIZE_20">20 ft</option>
              <option value="SIZE_40">40 ft</option>
              <option value="SIZE_45">45 ft</option>
            </select>
          </div>
        </div>

        <datalist id="place-options">
          {places.map((place) => (
            <option key={place} value={place} />
          ))}
        </datalist>

        <div className="space-y-4">
          {form.legs.map((leg, index) => (
            <div key={`leg-${index}`} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tour {index + 1}</p>
                {form.legs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLeg(index)}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    {t("delete")}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>{t("from")} *</label>
                  <input
                    list="place-options"
                    type="text"
                    required
                    value={leg.fromPlace}
                    onChange={(event) => handleLegChange(index, "fromPlace", event.target.value)}
                    className={inputClass}
                    placeholder="City, Port…"
                  />
                </div>
                <div>
                  <label className={labelClass}>{t("to")} *</label>
                  <input
                    list="place-options"
                    type="text"
                    required
                    value={leg.toPlace}
                    onChange={(event) => handleLegChange(index, "toPlace", event.target.value)}
                    className={inputClass}
                    placeholder="City, Port…"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>{t("waiting")} {t("from")}</label>
                  <input
                    type="time"
                    value={leg.waitingFrom}
                    onChange={(event) => handleLegChange(index, "waitingFrom", event.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t("waiting")} {t("to")}</label>
                  <input
                    type="time"
                    value={leg.waitingTo}
                    onChange={(event) => handleLegChange(index, "waitingTo", event.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {role !== "DRIVER" && (
                <div>
                  <label className={labelClass}>{t("price")} (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={leg.price}
                    onChange={(event) => handleLegChange(index, "price", event.target.value)}
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addLeg}
            className="px-3 py-2 border border-blue-300 text-blue-600 rounded-lg text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            + Tour hinzufügen
          </button>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="isIMO"
            name="isIMO"
            type="checkbox"
            checked={form.isIMO}
            onChange={handleChange}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="isIMO" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("imo")} / ADR cargo
          </label>
        </div>

        <div>
          <label htmlFor="driverId" className={labelClass}>{t("driver")} *</label>
          <select
            id="driverId"
            name="driverId"
            required
            value={form.driverId}
            onChange={handleChange}
            disabled={role === "DRIVER"}
            className={inputClass + (role === "DRIVER" ? " opacity-70 cursor-not-allowed" : "")}
          >
            <option value="">{t("selectDriver")}</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="contractorId" className={labelClass}>{t("contractor")}{role === "MANAGER" ? " *" : ""}</label>
          <select id="contractorId" name="contractorId" value={form.contractorId} onChange={handleChange} className={inputClass} required={role === "MANAGER"}>
            {role !== "MANAGER" && <option value="">{t("none")}</option>}
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sellerId" className={labelClass}>{t("subcontractor")}{role === "CONTRACTOR" ? " *" : ""}</label>
          <select id="sellerId" name="sellerId" value={form.sellerId} onChange={handleChange} className={inputClass} required={role === "CONTRACTOR"}>
            <option value="">{t("none")}</option>
            {availableSubcontractors.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="notes" className={labelClass}>{t("notes")}</label>
          <textarea id="notes" name="notes" rows={3} value={form.notes} onChange={handleChange} className={inputClass} placeholder={t("optionalNotes")} />
        </div>

        <div>
          <label htmlFor="freightLetter" className={labelClass}>{t("freightLetter")} (PDF)</label>
          {transport.freightLetterPath && (
            <a
              href={transport.freightLetterPath}
              target="_blank"
              rel="noreferrer"
              className="mb-2 inline-flex text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t("openCurrentFreightLetter")}
            </a>
          )}
          <input
            id="freightLetter"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFreightLetterFile(e.target.files?.[0] ?? null)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("optionalPdfHint")}</p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/transports")}
            className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? t("saving") : t("saveChanges")}
          </button>
        </div>
      </form>
    </div>
  );
}
