"use client";

import { useMemo, useState } from "react";
import { apiJson } from "../../lib/api";
import { useLang } from "../../lib/i18n";

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

type DecideResponse = {
  ok?: boolean;
  decision?: string;
  approvedCount?: number;
  // error shapes
  error?: string;
  messageAm?: string;
  remaining?: number;
};

const etb = (n: number) =>
  n.toLocaleString("am-ET", { maximumFractionDigits: 2 });

export default function EstimateApprover({
  data,
  token,
}: {
  data: EstimatePayload;
  token: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(data.lines.map((l) => l.id))
  );
  const [last4, setLast4] = useState("");
  const [decision, setDecision] = useState<null | {
    kind: "approved_all" | "approved_lines" | "declined";
    lines: number;
    confirmed: boolean;
  }>(null);
  const [pinError, setPinError] = useState<null | { text: string; remaining: number }>(
    null
  );
  const [linkState, setLinkState] = useState<null | "invalid" | "expired" | "locked">(
    null
  );
  const [busy, setBusy] = useState(false);
  const { t } = useLang();

  const head = data.head;
  const expiredInit = new Date(head.tokenExpiresAt) < new Date();

  const selectedTotal = useMemo(
    () =>
      data.lines
        .filter((l) => selected.has(l.id))
        .reduce((sum, l) => sum + Number(l.qty) * Number(l.unitPriceEtb), 0),
    [data.lines, selected]
  );

  const taxLabel: Record<string, string> = {
    vat_15: "taxV",
    tot_10_2: "taxT",
    exempt: "taxX",
  };

  const toggle = (id: string) => {
    if (busy) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function attempt(kind: "approved_all" | "approved_lines" | "declined") {
    if (busy) return;
    setBusy(true);
    const { status, data: res } = await apiJson<DecideResponse>(
      "POST",
      `/v1/estimate-links/${token}/decide`,
      {
        decision: kind,
        lineIds: kind === "approved_lines" ? [...selected] : undefined,
        remainderDecision: kind === "approved_lines" ? "deferred" : undefined,
        last4,
      }
    );
    setBusy(false);
    if (status === 200 && res.ok) {
      setDecision({
        kind,
        lines: kind === "approved_lines" ? (res.approvedCount ?? 0) : selected.size,
        confirmed: true,
      });
      return;
    }
    if (status === 400 && res.error === "last4_mismatch") {
      setPinError({
        text: t("cust.wrongPin"),
        remaining: res.remaining ?? 0,
      });
      return;
    }
    if (status === 429) setLinkState("locked");
    else if (status === 410) setLinkState("expired");
    else if (status === 403)
      setLinkState(res.error === "link_expired" ? "expired" : "invalid");
    else if (status === 409) setLinkState("invalid");
    else
      setPinError({ text: t("inv.fail"), remaining: 0 });
  }

  if (linkState) {
    const copy = {
      locked: { title: t("cust.locked"), body: t("cust.lockedB") },
      expired: { title: t("cust.expired"), body: t("cust.expiredB") },
      invalid: { title: t("cust.badLink"), body: t("cust.badLinkB") },
    }[linkState];
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <p className="font-medium">{copy.title}</p>
        <p className="mt-1 opacity-90">{copy.body}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            {head.make} {head.model}
          </p>
          <span className="text-sm text-zinc-400">
            {t("board.plate")} {head.plateNumber ?? "—"}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {head.shopName} · {t("cust.forPrefix")} {head.customerNameAm}
        </p>
      </div>

      {expiredInit ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          {t("cust.expiredB")}
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
                        disabled={busy}
                        onChange={() => toggle(l.id)}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {l.nameAm}
                          <span className="ml-2 text-xs text-zinc-400">
                            {l.kind === "service" ? t("cust.kindService") : t("cust.kindPart")}
                          </span>
                        </p>
                        <p className="text-sm text-zinc-500">
                          {Number(l.qty)} × {etb(Number(l.unitPriceEtb))} {t("cur.ETB")}
                        </p>
                      </div>
                      <p className="font-medium text-zinc-900 tabular-nums dark:text-zinc-50">
                        {etb(Number(l.qty) * Number(l.unitPriceEtb))} {t("cur.ETB")}
                      </p>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                <span>{t("est.subtotal")}</span>
                <span className="tabular-nums">{etb(Number(head.subtotalEtb))} {t("cur.ETB")}</span>
              </div>
              <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                <span>{t("est.tax")} ({t("est." + (taxLabel[head.taxType] ?? "taxX"))})</span>
                <span className="tabular-nums">{etb(Number(head.taxEtb))} {t("cur.ETB")}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-dashed border-zinc-300 pt-2 font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-50">
                <span>{t("est.total")}</span>
                <span className="tabular-nums">{etb(Number(head.totalEtb))} {t("cur.ETB")}</span>
              </div>
              {!decision && (
                <p className="mt-2 text-xs text-zinc-400">
                  {t("cust.deferNote")}
                </p>
              )}
            </div>
          </div>

          {decision ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              {decision.kind === "declined" ? (
                <>{t("cust.declined")}</>
              ) : (
                <>
                  {t("cust.thanks")}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t("cust.pinLabel")}
                </label>
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={last4}
                  onChange={(e) => {
                    setLast4(e.target.value.replace(/\D/g, ""));
                    setPinError(null);
                  }}
                  placeholder="· · · ·"
                  className="mt-2 w-32 rounded-lg border border-zinc-300 px-3 py-2 text-center text-lg tracking-widest text-zinc-900 outline-none transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
                {pinError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {pinError.text}
                    {pinError.remaining > 0 && (
                      <span className="ml-1 text-xs opacity-70">
                        ({pinError.remaining})
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  disabled={selected.size === 0 || busy}
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
                    ? t("cust.approveAll")
                    : t("cust.approveSel")} ({selected.size})
                </button>
                <button
                  disabled={busy}
                  onClick={() => attempt("declined")}
                  className="rounded-xl border border-zinc-300 px-5 py-3 font-medium text-zinc-700 transition-transform duration-200 ease-out active:scale-[0.97] disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
                >
                  {t("cust.declineAll")}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
