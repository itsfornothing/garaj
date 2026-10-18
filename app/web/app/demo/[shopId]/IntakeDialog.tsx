"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../../lib/api";
import { useLang } from "../../lib/i18n";

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

export default function IntakeDialog({
  shopId,
  open,
  onClose,
  onChanged,
}: {
  shopId: string;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { t } = useLang();
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

  const FUELS: { value: string; key: string }[] = [
    { value: "petrol", key: "fm.fuel.petrol" },
    { value: "diesel", key: "fm.fuel.diesel" },
    { value: "bev", key: "fm.fuel.ev" },
    { value: "hev", key: "fm.fuel.hybrid" },
    { value: "phev", key: "fm.fuel.plug_in_hybrid" },
    { value: "lpg", key: "fm.fuel.lpg" },
    { value: "other", key: "intake.fuelOther" },
  ];

  const ERROR_KEY: Record<string, string> = {
    consent_required: "intake.consent",
    customer_required: "intake.name",
    vehicle_required: "intake.model",
    vehicle_not_found: "intake.search",
    customer_vehicle_mismatch: "intake.search",
    fuel_type_required: "intake.fuel",
  };

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
    const timer = setTimeout(async () => {
      const res = await fetch(`${API_URL}/v1/shops/${shopId}/vehicles?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      if (alive) setResults(data.results ?? []);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
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
      ? { vehicleId: sel.id, consent, notesAm: notes || undefined, odometerIn: odometer ? Number(odometer) : undefined }
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
    const res = await fetch(`${API_URL}/v1/shops/${shopId}/intake`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.status === 201) {
      reset();
      onClose();
      onChanged?.();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(
      data.error && ERROR_KEY[data.error]
        ? t(ERROR_KEY[data.error])
        : t("inv.fail")
    );
  }

  const inputCls =
    "mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/70 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal-in w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            {t("intake.title")}
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
              {t("intake.search")}
            </label>
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSel(null);
              }}
              className={inputCls}
            />
            {sel ? (
              <div className="mt-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <p className="font-medium text-emerald-800 dark:text-emerald-300">
                  {sel.make} {sel.model} · {sel.plateNumber ?? "—"}
                </p>
                <p className="text-emerald-700 dark:text-emerald-400">
                  {sel.customerNameAm} · {sel.customerPhone}
                </p>
              </div>
            ) : (
              <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
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
                        {v.plateNumber ?? "—"}
                      </span>
                      <span className="block text-xs text-zinc-500">
                        {v.customerNameAm} · {v.customerPhone}
                      </span>
                    </button>
                  </li>
                ))}
                {q.trim().length >= 2 && results.length === 0 && (
                  <li className="px-1 py-2 text-sm text-zinc-400">
                    {t("intake.newVehicle")}
                  </li>
                )}
              </ul>
            )}
            <button
              onClick={() => setMode("new")}
              className="press mt-3 text-sm font-medium text-emerald-700 active:scale-[0.97] dark:text-emerald-400"
            >
              {t("intake.newVehicle")}
            </button>
          </>
        ) : (
          <>
            <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder={t("intake.plate")} className={inputCls} />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <input value={make} onChange={(e) => setMake(e.target.value)} placeholder={t("intake.make")} className={inputCls} />
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={t("intake.model")} className={inputCls} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {FUELS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFuelType(f.value)}
                  className={
                    "rounded-full border px-3 py-1.5 text-xs transition-colors " +
                    (fuelType === f.value
                      ? "border-emerald-600 bg-emerald-600/10 font-medium text-emerald-700 dark:text-emerald-400"
                      : "border-zinc-300 text-zinc-500 hover:border-zinc-400 dark:border-zinc-700")
                  }
                >
                  {t(f.key)}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder={t("intake.phone")} className={inputCls} />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("intake.name")} className={inputCls} />
            </div>
            <button
              onClick={() => setMode("search")}
              className="press mt-4 text-sm font-medium text-emerald-700 active:scale-[0.97] dark:text-emerald-400"
            >
              ← {t("intake.search")}
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
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {t("intake.consent")}
            </span>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("intake.notes")} className={"col-span-2 " + inputCls} />
          <input
            value={odometer}
            onChange={(e) => setOdometer(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder={t("intake.odometer").split(" ")[0]}
            className={inputCls}
          />
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          onClick={submit}
          disabled={
            busy ||
            !consent ||
            (sel ? false : !make || !model || !fuelType || !phone || !name)
          }
          className="press mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-40"
        >
          {busy ? t("act.busy") : t("intake.submit")}
        </button>
      </div>
    </div>
  );
}
