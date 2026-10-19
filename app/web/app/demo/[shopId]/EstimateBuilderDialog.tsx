"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../lib/api";
import { useLang } from "../../lib/i18n";

type Job = {
  id: string;
  nameAm: string;
  nameEn: string | null;
  laborHours: string;
  laborRateEtb: string;
};

export type Fx = {
  rates: Record<string, number>;
  markupPct: number;
  asOf: string;
};

type PartRow = {
  nameAm: string;
  qty: string;
  currency: string;
  costOriginal: string;
  markupPct: string;
};

const emptyPart: PartRow = {
  nameAm: "",
  qty: "1",
  currency: "CNY",
  costOriginal: "",
  markupPct: "",
};

export default function EstimateBuilderDialog({
  shopId,
  orderId,
  taxRegime,
  open,
  onClose,
}: {
  shopId: string;
  orderId: string;
  taxRegime: string;
  open: boolean;
  onClose: () => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [fx, setFx] = useState<Fx | null>(null);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const { t } = useLang();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const { data } = await apiJson<{ jobs: Job[]; fx: Fx }>(
        "GET",
        `/v1/shops/${shopId}/catalog`
      );
      if (alive) {
        setJobs(data.jobs ?? []);
        setFx(data.fx);
        setParts([structuredClone(emptyPart)]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, shopId]);

  const preview = useMemo(() => {
    const jobLines = jobs
      .filter((j) => picked.has(j.id))
      .map((j) => ({
        kind: "labor" as const,
        amount: Number(j.laborHours) * Number(j.laborRateEtb),
      }));
    const partLines = parts
      .filter((p) => p.nameAm && Number(p.costOriginal) > 0)
      .map((p) => ({
        kind: "part" as const,
        amount:
          Number(p.costOriginal) *
          (fx?.rates[p.currency] ?? 1) *
          (1 + ((fx?.markupPct ?? 0) / 100)),
      }));
    const all = [...jobLines, ...partLines];
    const subtotal = all.reduce((s, l) => s + l.amount, 0);
    const labor = all.filter((l) => l.kind === "labor").reduce((s, l) => s + l.amount, 0);
    const part = all.filter((l) => l.kind === "part").reduce((s, l) => s + l.amount, 0);
    let tax = 0;
    let taxLabel = t("est.taxX");
    if (taxRegime === "vat_15") {
      tax = subtotal * 0.15;
      taxLabel = t("est.taxV");
    } else if (taxRegime === "tot_10_2") {
      tax = labor * 0.1 + part * 0.02;
      taxLabel = t("est.taxT");
    }
    const etb = (n: number) =>
      n.toLocaleString("am-ET", { maximumFractionDigits: 2 });
    return {
      subtotal: etb(subtotal),
      tax: etb(tax),
      taxLabel,
      total: etb(subtotal + tax),
      count: all.length,
    };
  }, [jobs, picked, parts, fx, taxRegime]);

  if (!open) return null;

  const payload = () => ({
    services: [...picked].map((id) => ({ cannedJobId: id })),
    parts: parts
      .filter((p) => p.nameAm && Number(p.costOriginal) > 0)
      .map((p) => ({
        nameAm: p.nameAm,
        qty: Number(p.qty) || 1,
        costOriginal: Number(p.costOriginal),
        currency: p.currency,
        markupPct: p.markupPct ? Number(p.markupPct) : undefined,
      })),
  });

  async function save(withSend: boolean) {
    if (busy || preview.count === 0) return;
    setBusy(true);
    setError(null);
    const saved = await apiJson<{ versionId?: string; revision?: number }>(
      "POST",
      `/v1/shops/${shopId}/orders/${orderId}/estimate`,
      payload()
    );
    if (saved.status !== 201) {
      setBusy(false);
      setError(t("est.failSave"));
      return;
    }
    if (!withSend) {
      setBusy(false);
      onClose();
      return;
    }
    const sent = await apiJson<{ token?: string }>(
      "POST",
      `/v1/shops/${shopId}/orders/${orderId}/estimate/send`
    );
    setBusy(false);
    if (sent.status === 200 && sent.data.token) {
      setLink(
        `${window.location.origin}/demo/estimate/${shopId}?token=${sent.data.token}`
      );
    } else {
      setError(t("est.savedNoLink"));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/70 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal-in w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        {link ? (
          <>
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              {t("st.estimate_sent")} ✓
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              {t("home.s2b")}
            </p>
            <div className="mt-3 flex gap-2">
              <input
                readOnly
                value={link}
                className="flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              />
              <button
                onClick={() => navigator.clipboard?.writeText(link)}
                className="rounded-lg bg-zinc-900 px-3 text-sm text-white transition-transform duration-150 ease-out active:scale-[0.97] dark:bg-white dark:text-zinc-900"
              >
                {t("act.copy")}
              </button>
            </div>
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-xl bg-emerald-600 px-5 py-2.5 font-medium text-white transition-transform duration-200 ease-out hover:bg-emerald-700 active:scale-[0.97]"
            >
              {t("inv.close")}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
                {t("est.title")}
              </h2>
              <button
                onClick={onClose}
                disabled={busy}
                className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("est.jobs")}
            </p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {jobs.map((j) => {
                const on = picked.has(j.id);
                return (
                  <li key={j.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-zinc-200 px-3 py-2 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setPicked((prev) => {
                            const next = new Set(prev);
                            if (next.has(j.id)) next.delete(j.id);
                            else next.add(j.id);
                            return next;
                          })
                        }
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span className="flex-1 text-sm text-zinc-900 dark:text-zinc-50">
                        {j.nameAm}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {Number(j.laborHours)} {t("est.hours")} ·{" "}
                        {(
                          Number(j.laborHours) * Number(j.laborRateEtb)
                        ).toLocaleString("am-ET")}{" "}
                        {t("cur.ETB")}
                      </span>
                    </label>
                  </li>
                );
              })}
              {jobs.length === 0 && (
                <li className="text-sm text-zinc-400">—</li>
              )}
            </ul>

            <p className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("est.parts")}{" "}
              {fx && (
                <span className="text-xs font-normal text-zinc-400">
                  {t("est.fxDesk")
                    .replace("{cny}", String(fx.rates.CNY))
                    .replace("{usd}", String(fx.rates.USD))
                    .replace("{pct}", String(fx.markupPct))
                    .replace("{asOf}", fx.asOf)}
                </span>
              )}
            </p>
            <ul className="mt-1.5 flex flex-col gap-2">
              {parts.map((p, i) => (
                <li key={i} className="grid grid-cols-6 gap-2">
                  <input
                    value={p.nameAm}
                    onChange={(e) =>
                      setParts((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, nameAm: e.target.value } : x
                        )
                      )
                    }
                    placeholder={t("est.partName")}
                    className="col-span-2 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                  <input
                    value={p.costOriginal}
                    onChange={(e) =>
                      setParts((prev) =>
                        prev.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                costOriginal: e.target.value.replace(/[^\d.]/g, ""),
                              }
                            : x
                        )
                      )
                    }
                    inputMode="decimal"
                    placeholder={(p.currency === "CNY" ? "¥ " : p.currency === "USD" ? "$ " : "") + t("est.partCost")}
                    className="rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                  <select
                    value={p.currency}
                    onChange={(e) =>
                      setParts((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, currency: e.target.value } : x
                        )
                      )
                    }
                    className="rounded-lg border border-zinc-300 bg-white px-1.5 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    <option value="CNY">CNY</option>
                    <option value="USD">USD</option>
                    <option value="ETB">ETB</option>
                  </select>
                  <input
                    value={p.qty}
                    onChange={(e) =>
                      setParts((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, qty: e.target.value.replace(/\D/g, "") } : x
                        )
                      )
                    }
                    inputMode="numeric"
                    placeholder={t("est.partQty")}
                    className="rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                  <button
                    onClick={() =>
                      setParts((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setParts((prev) => [...prev, structuredClone(emptyPart)])}
              className="mt-2 text-sm font-medium text-emerald-700 transition-transform duration-150 ease-out active:scale-[0.97] dark:text-emerald-400"
            >
              {t("est.addPart")}
            </button>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-800/40">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>{t("est.subtotal")} ({preview.count})</span>
                <span className="tabular-nums">{preview.subtotal} {t("cur.ETB")}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>{preview.taxLabel}</span>
                <span className="tabular-nums">{preview.tax} {t("cur.ETB")}</span>
              </div>
              <div className="mt-1 flex justify-between font-medium text-zinc-900 dark:text-zinc-50">
                <span>{t("est.total")}</span>
                <span className="tabular-nums">{preview.total} {t("cur.ETB")}</span>
              </div>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => save(false)}
                disabled={busy || preview.count === 0}
                className="flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-transform duration-200 ease-out active:scale-[0.97] disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
              >
                {t("act.save")}
              </button>
              <button
                onClick={() => save(true)}
                disabled={busy || preview.count === 0}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-transform duration-200 ease-out hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-40"
              >
                {busy ? t("act.busy") : t("act.send")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
