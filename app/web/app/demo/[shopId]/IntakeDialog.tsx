"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "../../lib/api";

type VehicleHit = {
  id: string;
  make: string;
  model: string;
  plateNumber: string | null;
  customerId: string;
  customerNameAm: string;
  customerPhone: string;
  consentGiven: boolean;
};

const ERROR_AM: Record<string, string> = {
  consent_required: "የደንበኛ ፍቃድ ማረጋገጥ አስፈላጊ ነው።",
  customer_required: "የደንበኛው ስልክ ቁጥር እና ሙሉ ስም ያስፈልጋሉ።",
  vehicle_required: "ብራንድ እና ሞዴል ያስፈልጋሉ።",
  vehicle_not_found: "ተሽከርካሪው አልተገኘም።",
  customer_vehicle_mismatch: "የተመረጠው ተሽከርካሪ እና ደንበኛ አይስማሙም።",
  fuel_type_required: "የነዳጅ አይነት ይምረጡ።",
};

const FUELS: { value: string; label: string }[] = [
  { value: "petrol", label: "በንዚን" },
  { value: "diesel", label: "ዲዝኤል" },
  { value: "bev", label: "ኤሌክትሪክ" },
  { value: "hev", label: "ሃይብሪድ" },
  { value: "phev", label: "ሃይብሪድ (ፕላግ-ኢን)" },
  { value: "lpg", label: "ኤልፒጂ" },
  { value: "other", label: "ሌላ" },
];

export default function IntakeDialog({
  shopId,
  open,
  onClose,
}: {
  shopId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<VehicleHit[]>([]);
  const [sel, setSel] = useState<VehicleHit | null>(null);
  const [mode, setMode] = useState<"search" | "new">("search");
  const [plate, setPlate] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [fuelType, setFuelType] = useState("petrol");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [notes, setNotes] = useState("");
  const [odometer, setOdometer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  useEffect(() => {
    if (!open || mode !== "search") return;
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      const { data } = await apiJson<{ results: VehicleHit[] }>(
        "GET",
        `/v1/shops/${shopId}/vehicles?q=${encodeURIComponent(term)}`
      );
      if (alive) setResults(data.results ?? []);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, shopId, open, mode]);

  if (!open) return null;

  function reset() {
    setQ("");
    setResults([]);
    setSel(null);
    setMode("search");
    setPlate("");
    setMake("");
    setModel("");
    setFuelType("petrol");
    setPhone("");
    setName("");
    setConsent(false);
    setNotes("");
    setOdometer("");
    setError(null);
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    const body = sel
      ? {
          vehicleId: sel.id,
          consent,
          notesAm: notes || undefined,
          odometerIn: odometer ? Number(odometer) : undefined,
        }
      : {
          plate: plate || undefined,
          make,
          model,
          fuelType,
          phone,
          customerNameAm: name,
          consent,
          notesAm: notes || undefined,
          odometerIn: odometer ? Number(odometer) : undefined,
        };
    const { status, data } = await apiJson<{ error?: string; messageAm?: string }>(
      "POST",
      `/v1/shops/${shopId}/intake`,
      body
    );
    setBusy(false);
    if (status === 201) {
      reset();
      onClose();
      router.refresh();
      return;
    }
    setError(
      data.messageAm ??
        (data.error && ERROR_AM[data.error]) ??
        "ችግር ተከስቷል — እባክዎ እንደገና ይሞክሩ።"
    );
  }

  const consentUnchecked = !consent;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/70 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            አዲስ ሥራ ተቀበል
          </h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-2 py-1 text-sm text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        {mode === "search" ? (
          <>
            <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              ተሽከርካሪ ፈልግ
            </label>
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSel(null);
              }}
              placeholder="ሰሌዳ ቁጥር፣ ስልክ ወይም ደንበኛ ስም"
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            {sel ? (
              <div className="mt-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <p className="font-medium text-emerald-800 dark:text-emerald-300">
                  {sel.make} {sel.model} · {sel.plateNumber ?? "ሰሌዳ የለም"}
                </p>
                <p className="text-emerald-700 dark:text-emerald-400">
                  {sel.customerNameAm} · {sel.customerPhone}
                </p>
              </div>
            ) : (
              <ul className="mt-2 flex flex-col gap-1">
                {results.map((v) => (
                  <li key={v.id}>
                    <button
                      onClick={() => setSel(v)}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm transition-colors hover:border-emerald-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-emerald-500/40 dark:hover:bg-zinc-800/60"
                    >
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {v.make} {v.model}
                      </span>
                      <span className="ml-2 text-zinc-400">
                        {v.plateNumber ?? "ሰሌዳ የለም"}
                      </span>
                      <span className="block text-xs text-zinc-500">
                        {v.customerNameAm} · {v.customerPhone}
                      </span>
                    </button>
                  </li>
                ))}
                {q.trim().length >= 2 && results.length === 0 && (
                  <li className="px-1 py-2 text-sm text-zinc-400">
                    ምንም አልተገኘም — ከታች አዲስ ተሽከርካሪ ማስገባት ይችላሉ።
                  </li>
                )}
              </ul>
            )}
            <button
              onClick={() => setMode("new")}
              className="mt-3 text-sm font-medium text-emerald-700 transition-transform duration-150 ease-out active:scale-[0.97] dark:text-emerald-400"
            >
              + አዲስ ተሽከርካሪ
            </button>
          </>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <input
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="ሰሌዳ ቁጥር (አማራጭ)"
                className="col-span-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
              <input
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="ብራንድ (ኮሮላ…)"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="ሞዴል"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
              <select
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value)}
                className="col-span-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                {FUELS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="ደንበኛው ስልክ"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ደንበኛው ሙሉ ስም"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>
            <button
              onClick={() => setMode("search")}
              className="mt-3 text-sm font-medium text-emerald-700 transition-transform duration-150 ease-out active:scale-[0.97] dark:text-emerald-400"
            >
              ← ፍለጋ ወደ ሰሌዳ
            </button>
          </>
        )}

        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                setError(null);
              }}
              className="mt-0.5 h-4 w-4 accent-emerald-600"
            />
            <span>
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                ደንበኛው ፍቃድ ሰጠ።
              </span>
              <span className="block text-xs text-zinc-500">
                በስልክ የሚላክ ግምት ማገናኛ እና ማሳወቂያ እንደሚቀበል ፈቅዷል — በቃል አገናኝ ማድረግ ያስፈልጋል።
              </span>
            </span>
          </label>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ማስታወሻ (አማራጭ)"
            className="col-span-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <input
            value={odometer}
            onChange={(e) => setOdometer(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="ኦዶሜተር"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          onClick={submit}
          disabled={
            busy ||
            consentUnchecked ||
            (sel
              ? false
              : !make || !model || !fuelType || !phone || !name)
          }
          className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white transition-transform duration-200 ease-out hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-40"
        >
          {busy ? "በመመዝገብ ላይ…" : "ተቀበል"}
        </button>
      </div>
    </div>
  );
}
