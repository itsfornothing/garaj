"use client";

import { useMemo, useState } from "react";

export type Line = {
  id: string;
  kind: "service" | "part" | string;
  nameAm: string;
  nameEn: string | null;
  qty: string;
  unitPriceEtb: string;
};

export type Head = {
  versionId: string;
  revision: number;
  sentAt: string;
  tokenExpiresAt: string;
  subtotalEtb: string;
  taxEtb: string;
  taxType: string;
  totalEtb: string;
  customerNameAm: string;
  customerPhone: string;
  make: string;
  model: string;
  plateNumber: string | null;
  shopName: string;
};

export type EstimatePayload = { head: Head; lines: Line[] };

const etb = (n: number) =>
  n.toLocaleString("am-ET", { maximumFractionDigits: 2 });

export default function EstimateApprover({ data }: { data: EstimatePayload }) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(data.lines.map((l) => l.id))
  );
  const [last4, setLast4] = useState("");
  const [decision, setDecision] = useState<null | {
    kind: "approved_all" | "approved_lines" | "declined";
    lines: number;
  }>(null);
  const [error, setError] = useState<null | string>(null);

  const now = new Date();
  const expired = new Date(data.head.tokenExpiresAt) < now;

  const selectedTotal = useMemo(
    () =>
      data.lines
        .filter((l) => selected.has(l.id))
        .reduce((sum, l) => sum + Number(l.qty) * Number(l.unitPriceEtb), 0),
    [data.lines, selected]
  );
  const head = data.head;
  const taxLabel: Record<string, string> = {
    vat_15: "ቫት 15%",
    tot_10_2: "ታክስ በአገልግሎት 10%",
    exempt: "ታክስ ነጻ",
  };

  const toggle = (id: string) => {
    setDecision(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const attempt = (kind: "approved_all" | "approved_lines" | "declined") => {
    if (last4 !== head.customerPhone.slice(-4)) {
      setError("የስልክ ቁጥርዎ የመጨረሻዎቹ 4 አይመስሉም።");
      return;
    }
    setError(null);
    // Demo only: the real server route + token lockout lands with G2 auth.
    setDecision({ kind, lines: selected.size });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            {head.make} {head.model}
          </p>
          <span className="text-sm text-zinc-400">
            ሰሌዳ {head.plateNumber ?? "—"}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {head.shopName} · ለ{head.customerNameAm}
        </p>
      </div>

      {expired ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          የማገናኛው ጊዜ አልቋል። ጋራዥዎን ደውለው አዲስ አገናኝ እንዲልክ ጠይቁ።
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.lines.map((l) => {
                const on = selected.has(l.id);
                return (
                  <li key={l.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-5 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(l.id)}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {l.nameAm}
                          <span className="ml-2 text-xs text-zinc-400">
                            {l.kind === "service" ? "ሥራ" : "ምርት"}
                          </span>
                        </p>
                        <p className="text-sm text-zinc-500">
                          {Number(l.qty)} × {etb(Number(l.unitPriceEtb))} ብር
                        </p>
                      </div>
                      <p className="font-medium text-zinc-900 tabular-nums dark:text-zinc-50">
                        {etb(Number(l.qty) * Number(l.unitPriceEtb))} ብር
                      </p>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                <span>ጠቅላላ</span>
                <span className="tabular-nums">{etb(Number(head.subtotalEtb))} ብር</span>
              </div>
              <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                <span>ታክስ ({taxLabel[head.taxType] ?? head.taxType})</span>
                <span className="tabular-nums">{etb(Number(head.taxEtb))} ብር</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-dashed border-zinc-300 pt-2 font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-50">
                <span>ጠቅላላ ለመክፈል</span>
                <span className="tabular-nums">{etb(Number(head.totalEtb))} ብር</span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                ቀሣዎችን መምረጥ የእይታ ማሳያ ብቻ ነው — እውነተኛ ውሳኔ አይቀረጽም።
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              የስልክ ቁጥርዎ የመጨረሻ 4 አሃዞች
            </label>
            <input
              inputMode="numeric"
              maxLength={4}
              value={last4}
              onChange={(e) => {
                setLast4(e.target.value.replace(/\D/g, ""));
                setDecision(null);
                setError(null);
              }}
              placeholder="· · · ·"
              className="mt-2 w-32 rounded-lg border border-zinc-300 px-3 py-2 text-center text-lg tracking-widest text-zinc-900 outline-none transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>

          {decision ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              {decision.kind === "declined" ? (
                <>ግምቱ እምቢ ተብሎ ተመዝግቧል። ጋራዥዎ በቅርቡ ተለዋጭ አማራጭ ገልጸልዎታል።</>
              ) : (
                <>
                  ፈቃድ ተመዝግቧል — {decision.kind === "approved_all" ? "ሙሉ ግምት" : `${decision.lines} መስመሮች`}።
                  ጋራዥዎ ሥራውን ይጀምራል፣ ሲጠናቅ ስልክ እንዲደርስዎ ይላከል።
                </>
              )}
              <p className="mt-1 text-xs opacity-70">
                (ይህ ማሳያ ብቻ ነው — እውነተኛ ውሳኔ አልተመዘገበም።)
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                disabled={selected.size === 0}
                onClick={() =>
                  attempt(
                    selected.size === data.lines.length
                      ? "approved_all"
                      : "approved_lines"
                  )
                }
                className="flex-1 rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white transition-transform duration-200 ease-out hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-40"
              >
                {selected.size === data.lines.length
                  ? "ሙሉ ግምት ፈቅድ"
                  : `${selected.size} መስመሮችን ብቻ ፈቅድ`}
              </button>
              <button
                onClick={() => attempt("declined")}
                className="rounded-xl border border-zinc-300 px-5 py-3 font-medium text-zinc-700 transition-transform duration-200 ease-out active:scale-[0.97] dark:border-zinc-700 dark:text-zinc-300"
              >
                ፈቅዳም እምቢ
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
