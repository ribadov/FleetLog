"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type User = { id: string; name: string; role: string };

const initialForm = {
  date: "",
  fromPlace: "",
  toPlace: "",
  containerSize: "SIZE_20",
  isIMO: false,
  waitingFrom: "",
  waitingTo: "",
  price: "",
  driverId: "",
  contractorId: "",
  sellerId: "",
  notes: "",
};

export default function NewTransportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const role = session?.user?.role;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" && session) {
      fetch("/api/users")
        .then((r) => r.json())
        .then((data: User[]) => {
          setUsers(data);
          if (role === "DRIVER") {
            setForm((prev) => ({ ...prev, driverId: session.user.id }));
          }
        });
    }
    // Run only once when session is established
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const drivers = users.filter((u) => u.role === "DRIVER");
  const contractors = users.filter((u) => u.role === "CONTRACTOR" || u.role === "MANAGER");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const body = {
      ...form,
      price: form.price ? parseFloat(form.price) : 0,
      contractorId: form.contractorId || null,
      sellerId: form.sellerId || null,
      notes: form.notes || null,
      waitingFrom: form.waitingFrom || null,
      waitingTo: form.waitingTo || null,
    };

    const res = await fetch("/api/transports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/transports");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create transport");
    }
  };

  if (status === "loading") {
    return <div className="flex items-center justify-center h-64 text-slate-500">Loading…</div>;
  }

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition";
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New Transport</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Fill in the transport details below.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl shadow p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="date" className={labelClass}>Date *</label>
            <input id="date" name="date" type="date" required value={form.date} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label htmlFor="containerSize" className={labelClass}>Container Size *</label>
            <select id="containerSize" name="containerSize" value={form.containerSize} onChange={handleChange} className={inputClass}>
              <option value="SIZE_20">20 ft</option>
              <option value="SIZE_40">40 ft</option>
              <option value="SIZE_45">45 ft</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="fromPlace" className={labelClass}>From *</label>
            <input id="fromPlace" name="fromPlace" type="text" required value={form.fromPlace} onChange={handleChange} className={inputClass} placeholder="City, Port…" />
          </div>
          <div>
            <label htmlFor="toPlace" className={labelClass}>To *</label>
            <input id="toPlace" name="toPlace" type="text" required value={form.toPlace} onChange={handleChange} className={inputClass} placeholder="City, Port…" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="waitingFrom" className={labelClass}>Waiting From</label>
            <input id="waitingFrom" name="waitingFrom" type="time" value={form.waitingFrom} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label htmlFor="waitingTo" className={labelClass}>Waiting To</label>
            <input id="waitingTo" name="waitingTo" type="time" value={form.waitingTo} onChange={handleChange} className={inputClass} />
          </div>
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
            IMO / ADR cargo
          </label>
        </div>

        <div>
          <label htmlFor="driverId" className={labelClass}>Driver *</label>
          <select
            id="driverId"
            name="driverId"
            required
            value={form.driverId}
            onChange={handleChange}
            disabled={role === "DRIVER"}
            className={inputClass + (role === "DRIVER" ? " opacity-70 cursor-not-allowed" : "")}
          >
            <option value="">Select driver…</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="contractorId" className={labelClass}>Contractor</label>
          <select id="contractorId" name="contractorId" value={form.contractorId} onChange={handleChange} className={inputClass}>
            <option value="">None</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sellerId" className={labelClass}>Seller</label>
          <select id="sellerId" name="sellerId" value={form.sellerId} onChange={handleChange} className={inputClass}>
            <option value="">None</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {role !== "DRIVER" && (
          <div>
            <label htmlFor="price" className={labelClass}>Price (€)</label>
            <input id="price" name="price" type="number" min="0" step="0.01" value={form.price} onChange={handleChange} className={inputClass} placeholder="0.00" />
          </div>
        )}

        <div>
          <label htmlFor="notes" className={labelClass}>Notes</label>
          <textarea id="notes" name="notes" rows={3} value={form.notes} onChange={handleChange} className={inputClass} placeholder="Optional notes…" />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/transports")}
            className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? "Creating…" : "Create Transport"}
          </button>
        </div>
      </form>
    </div>
  );
}
