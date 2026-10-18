"use client";

import { useState } from "react";
import { apiJson } from "../../lib/api";
import { useLang } from "../../lib/i18n";

const PROVIDERS = [
  { value: "telebirr", key: "pay.telebirr" },
  { value: "cbe_birr", key: "pay.cbe_birr" },
  { value: "ebirr", key: "pay.ebirr" },
  { value: "mpesa", key: "pay.mpesa" },
  { value: "card", key: "pay.card" },
];

export default function ChapaPayMock({
  shopId,
  invoiceId,
  totalEtb,
  invoiceNumber,
  onPaid,
  onBack,
}: {
  shopId: string;
  invoiceId: string;
  totalEtb: string;
  invoiceNumber: string;
  onPaid: (r: { providerRef: string; method: string; amount: number }) => void;
  onBack: () => void;
}) {
  const [provider, setProvider] = useState("telebirr");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"form" | "processing" | "done">("form");
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);
  const { t } = useLang();

  async function confirm() {
    if (step !== "form") return;
    setStep("processing");
    setError(null);
    const { status, data } = await apiJson<{
      ok?: boolean;
      providerRef?: string | null;
      amountPaid?: number;
      error?: string;
    }>("POST", `/v1/shops/${shopId}/invoices/${invoiceId}/pay`, { method: provider });
    if (status === 200 && data.ok) {
      setRef(data.providerRef ?? `DEMO-${provider.toUpperCase()}`);
      setStep("done");
      onPaid({
        providerRef: data.providerRef ?? `DEMO-${provider.toUpperCase()}`,
        method: provider,
        amount: data.amountPaid ?? Number(totalEtb),
      });
      return;
    }
    setStep("form");
    setError(status === 409 ? t("inv.wasPaid") : t("inv.fail"));
  }

  if (step === "done") {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-center dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <p className="text-2xl">✓</p>
        <p className="mt-1 font-medium text-emerald-800 dark:text-emerald-300">
          {t("inv.paid")} — {Number(totalEtb).toLocaleString("am-ET")} ብር
        </p>
        <p className="mt-1 font-mono text-xs text-emerald-700 dark:text-emerald-400">
          {invoiceNumber} · {ref}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {t("inv.pay")}
          </p>
          <p className="text-xs text-zinc-400">
            {invoiceNumber} · {Number(totalEtb).toLocaleString("am-ET")} ብር
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300">
          ምሳሌ · እውነተኛው ከG4 ነገዎች አስተሳሰብ
        </span>
      </div>

      <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {t("inv.provider")}
      </label>
      <select
        value={provider}
        onChange={(e) => setProvider(e.target.value)}
        disabled={step !== "form"}
        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
      >
        {PROVIDERS.map((p) => (
          <option key={p.value} value={p.value}>
            {t(p.key)}
          </option>
        ))}
      </select>

      {provider !== "card" && (
        <>
          <label className="mt-2 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            {t("inv.phone")}
          </label>
          <input
            value={phone}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
              setPhone(digits);
            }}
            onFocus={(e) => {
              if (!e.target.value) setPhone("09");
            }}
            inputMode="numeric"
            placeholder="09xx xxx xxx"
            disabled={step !== "form"}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm tracking-wider tabular-nums dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <p className="mt-2 text-[11px] leading-4 text-zinc-400">
        {t("inv.mockNote")}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onBack}
          disabled={step === "processing"}
          className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition-transform duration-150 ease-out active:scale-[0.97] dark:border-zinc-700 dark:text-zinc-400"
        >
          {t("inv.back")}
        </button>
        <button
          onClick={confirm}
          disabled={step === "processing" || (provider !== "card" && phone.length < 9)}
          className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-transform duration-150 ease-out hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-40"
        >
          {step === "processing" ? t("inv.processing") : t("inv.confirm")}
        </button>
      </div>
    </div>
  );
}
