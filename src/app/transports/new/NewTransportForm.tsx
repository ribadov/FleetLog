"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getTranslator, readClientLocale, type Locale } from "@/lib/i18n";

type User = { id: string; name: string; role: string; workspaceId: string | null };
type LegForm = {
  fromPlace: string;
  toPlace: string;
  waitingFrom: string;
  waitingTo: string;
  price: string;
  isIMO: boolean;
};

interface Props {
  users: User[];
  places: string[];
  currentUserId: string;
  currentUserRole: string;
  allowedManagerIds: string[];
}

const makeInitialForm = (userId: string, role: string) => ({
  date: "",
  containerNumber: "",
  orderNumber: "",
  containerSize: "SIZE_20",
  driverId: role === "DRIVER" ? userId : "",
  contractorId: role === "CONTRACTOR" ? userId : "",
  sellerId: "",
  notes: "",
  workspaceCode: "",
  legs: [
    {
      fromPlace: "",
      toPlace: "",
      waitingFrom: "",
      waitingTo: "",
      price: "",
      isIMO: false,
    } as LegForm,
  ],
});

export default function NewTransportForm({ users, places, currentUserId, currentUserRole, allowedManagerIds }: Props) {
  const router = useRouter();
  const [locale] = useState<Locale>(() => readClientLocale());
  const t = useMemo(() => getTranslator(locale), [locale]);
  const [form, setForm] = useState(() => makeInitialForm(currentUserId, currentUserRole));
  const [freightLetterFile, setFreightLetterFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const drivers = users.filter((u) => u.role === "DRIVER");
  const contractors = users.filter((u) => u.role === "CONTRACTOR");
  const managers = users.filter((u) => u.role === "MANAGER");
  const availableSubcontractors = currentUserRole === "CONTRACTOR"
    ? managers.filter((manager) => allowedManagerIds.includes(manager.id))
    : managers;

  const showContractorField = currentUserRole === "MANAGER";
  const showDriverContractorField = currentUserRole === "DRIVER";
  const showSellerField = currentUserRole === "CONTRACTOR";
  const selectableContractors = showContractorField ? contractors : contractors;
  const selectedContractorId = showDriverContractorField
    ? form.contractorId
    : showContractorField
      ? (selectableContractors.some((entry) => entry.id === form.contractorId)
        ? form.contractorId
        : (selectableContractors[0]?.id || ""))
      : form.contractorId;
  const currentUserWorkspaceId = users.find((entry) => entry.id === currentUserId)?.workspaceId ?? null;
  const availableDrivers = currentUserRole === "MANAGER"
    ? drivers.filter((driver) => currentUserWorkspaceId ? driver.workspaceId === currentUserWorkspaceId : true)
    : currentUserRole === "CONTRACTOR"
      ? drivers.filter((driver) => {
          if (!form.sellerId) return false;
          const seller = availableSubcontractors.find((subcontractor) => subcontractor.id === form.sellerId);
          return Boolean(seller?.workspaceId) && driver.workspaceId === seller?.workspaceId;
        })
      : drivers;
  const selectedDriverId = currentUserRole === "MANAGER"
    ? (availableDrivers.some((entry) => entry.id === form.driverId) ? form.driverId : "")
    : form.driverId;
  const submitDisabled = loading
    || ((showContractorField || showDriverContractorField) && !selectedContractorId)
    || ((currentUserRole === "MANAGER" || currentUserRole === "CONTRACTOR") && !selectedDriverId);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setForm((prev) => {
        if (name === "sellerId" && currentUserRole === "CONTRACTOR") {
          return { ...prev, sellerId: value, driverId: "" };
        }
        return { ...prev, [name]: value };
      });
    }
  };

  const handleLegChange = (index: number, field: keyof LegForm, value: string) => {
    setForm((previous) => {
      const nextLegs = [...previous.legs];
      nextLegs[index] = { ...nextLegs[index], [field]: value };
      return { ...previous, legs: nextLegs };
    });
  };

  const handleLegImoChange = (index: number, checked: boolean) => {
    setForm((previous) => {
      const nextLegs = [...previous.legs];
      nextLegs[index] = { ...nextLegs[index], isIMO: checked };
      return { ...previous, legs: nextLegs };
    });
  };

  const addLeg = () => {
    setForm((previous) => ({
      ...previous,
      legs: [
        ...previous.legs,
        { fromPlace: "", toPlace: "", waitingFrom: "", waitingTo: "", price: "", isIMO: false } as LegForm,
      ],
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const body = {
      ...form,
      containerNumber: form.containerNumber,
      contractorId: selectedContractorId || null,
      driverId: selectedDriverId,
      sellerId: form.sellerId || null,
      notes: form.notes || null,
      workspaceCode: form.workspaceCode || null,
      legs: form.legs.map((leg) => ({
        fromPlace: leg.fromPlace,
        toPlace: leg.toPlace,
        waitingFrom: leg.waitingFrom || null,
        waitingTo: leg.waitingTo || null,
        price: leg.price ? parseFloat(leg.price) : 0,
        isIMO: leg.isIMO,
      })),
    };

    const res = await fetch("/api/transports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (res.ok) {
      const created = await res.json();

      if (freightLetterFile) {
        const uploadData = new FormData();
        uploadData.append("file", freightLetterFile);

        const uploadResponse = await fetch(`/api/transports/${created.id}/freight-letter`, {
          method: "POST",
          body: uploadData,
        });

        if (!uploadResponse.ok) {
          const uploadError = await uploadResponse.json();
          setError(uploadError.error || t("freightLetterUploadFailedCreate"));
          return;
        }
      }

      router.push("/transports");
    } else {
      const data = await res.json();
      setError(data.error || t("transportCreateFailed"));
    }
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition";
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("newTransportTitle")}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("newTransportSubtitle")}</p>
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

              <div className="flex items-center gap-3">
                <input
                  id={`leg-${index}-isIMO`}
                  type="checkbox"
                  checked={leg.isIMO}
                  onChange={(event) => handleLegImoChange(index, event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor={`leg-${index}-isIMO`} className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  ADR / IMO für diese Tour
                </label>
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

              {currentUserRole !== "DRIVER" && (
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

        {currentUserRole !== "DRIVER" && (
          <div>
            <label htmlFor="driverId" className={labelClass}>{t("driver")} *</label>
            <select
              id="driverId"
              name="driverId"
              required
              value={selectedDriverId}
              onChange={handleChange}
              disabled={currentUserRole === "CONTRACTOR" && !form.sellerId}
              className={inputClass + ((currentUserRole === "CONTRACTOR" && !form.sellerId) ? " opacity-70 cursor-not-allowed" : "")}
            >
              <option value="">{t("selectDriver")}</option>
              {availableDrivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {currentUserRole === "MANAGER" && availableDrivers.length === 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Für deinen Workspace sind aktuell keine Fahrer verfügbar.
              </p>
            )}
            {currentUserRole === "CONTRACTOR" && !form.sellerId && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Bitte zuerst einen Auftragnehmer auswählen, dann werden passende Fahrer angezeigt.
              </p>
            )}
            {currentUserRole === "CONTRACTOR" && form.sellerId && availableDrivers.length === 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Für den ausgewählten Auftragnehmer sind aktuell keine Fahrer verfügbar.
              </p>
            )}
          </div>
        )}

        {(showContractorField || showDriverContractorField) && (
          <div>
            <label htmlFor="contractorId" className={labelClass}>{t("contractor")} *</label>
            <select
              id="contractorId"
              name="contractorId"
              value={selectedContractorId}
              onChange={handleChange}
              className={inputClass}
              required
            >
              <option value="">{t("none")}</option>
              {selectableContractors.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {currentUserRole === "DRIVER" && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Wähle den Auftraggeber aus den Auftraggebern deines Auftragnehmers.
              </p>
            )}
            {selectableContractors.length === 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Du hast noch keine Auftraggeber. Bitte füge zuerst im Profil per Workspace-Code Auftraggeber hinzu.
              </p>
            )}
          </div>
        )}

        {showSellerField && (
          <div>
              <label htmlFor="sellerId" className={labelClass}>{t("subcontractor")} *</label>
              <select id="sellerId" name="sellerId" value={form.sellerId} onChange={handleChange} className={inputClass} required={currentUserRole === "CONTRACTOR"}>
                <option value="">{t("none")}</option>
                {availableSubcontractors.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              {currentUserRole === "CONTRACTOR" && availableSubcontractors.length === 0 && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Du hast noch keine Auftraggeber. Bitte füge zuerst im Profil per Workspace-Code Auftraggeber hinzu.
                </p>
              )}
          </div>
        )}

        <div>
          <label htmlFor="notes" className={labelClass}>{t("notes")}</label>
          <textarea id="notes" name="notes" rows={3} value={form.notes} onChange={handleChange} className={inputClass} placeholder={t("optionalNotes")} />
        </div>

        <div>
          <label htmlFor="freightLetter" className={labelClass}>{t("freightLetter")} (PDF)</label>
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
            disabled={submitDisabled}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? t("creating") : t("createTransport")}
          </button>
        </div>
      </form>
    </div>
  );
}
