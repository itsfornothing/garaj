"use client";

import { useEffect, useState } from "react";
import { apiJson } from "../../lib/api";
import ChapaPayMock from "./ChapaPayMock";
import { useLang } from "../../lib/i18n";

export type InvoicePayload = {
  id: string;
  invoiceNumber: string;
  fiscalYearEt: number;
  subtotalEtb: string;
  taxEtb: string;
  taxType: string;
  totalEtb: string;
  amountPaidEtb: string;
  status: string;
  issuedAt: string;
  dueAt: string;
  customerNameAm: string;
  customerPhone: string;
  make: string;
  model: string;
  plateNumber: string | null;
  lines: {
    lineKind: string;
    nameAm: string;
    qty: string;
    lineSubtotalEtb: string;
    lineTaxEtb: string;
    lineTotalEtb: string;
  }[];
  payments: {
    method: string;
    amountEtb: string;
    providerRef: string | null;
    paidAt: string;
  }[];
  qrDataUrl: string;
};

export default function InvoiceDialog({
  shopId,
  orderId,
  invoiceId,
  open,
  onClose,
}: {
  shopId: string;
  orderId: string;
  invoiceId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [inv, setInv] = useState<InvoicePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"invoice" | "chapa">("invoice");
  const { t } = useLang();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setInv(null);
    setError(null);
    (async () => {
      if (invoiceId) {
        const { data } = await apiJson<InvoicePayload>(
          "GET",
          `/v1/shops/${shopId}/invoices/${invoiceId}`
        );
        if (alive) setInv(data);
        return;
      }
      const { status, data } = await apiJson<InvoicePayload & { error?: string }>(
        "POST",
        `/v1/shops/${shopId}/orders/${orderId}/invoice`
      );
      if (!alive) return;
      if (status === 201 || data.invoiceNumber) setInv(data);
      else if (data.error === "estimate_not_approved")
        setError(t("est.noApproved"));
      else if (data.error === "no_estimate")
        setError(t("est.noApproved"));
      else setError(t("invPage.none"));
    })();
    return () => {
      alive = false;
    };
  }, [open, shopId, orderId, invoiceId]);

  if (!open) return null;

  async function pay(method: string) {
    if (!inv || busy) return;
    setBusy(true);
    const { status } = await apiJson("POST", `/v1/shops/${shopId}/invoices/${inv.id}/pay`, {
      method,
    });
    setBusy(false);
    if (status === 200) {
      setInv({
        ...inv,
        status: "paid",
        amountPaidEtb: inv.totalEtb,
        payments: [
          ...inv.payments,
          {
            method,
            amountEtb: inv.totalEtb,
            providerRef: method === "cash" ? null : "CHAPA-DEMO",
            paidAt: new Date().toISOString(),
          },
        ],
      });
      return;
    }
    setError(status === 409 ? t("inv.wasPaid") : t("inv.fail"));
  }

  const unpaid = inv && inv.status === "unpaid";

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
            {t("nav.invoices")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        {!inv && !error && (
          <p className="mt-6 text-center text-sm text-zinc-400">{t("inv.processing")}</p>
        )}
        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {inv && (
          <>
            <div className="mt-3 flex items-baseline justify-between">
              <p className="font-mono text-lg text-zinc-900 dark:text-zinc-50">
                {inv.invoiceNumber}
              </p>
              <span className={`rounded-full px-2.5 py-0.5 text-xs ${
                inv.status === "paid"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
              }`}>
                {inv.status === "paid" ? t("inv.paid") : t("invPage.unpaid")}
              </span>
            </div>
            <p className="text-sm text-zinc-500">
              {inv.make} {inv.model} · {inv.plateNumber ?? "—"} ·{" "}
              {inv.customerNameAm} · {inv.customerPhone}
            </p>

            <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
              {inv.lines.map((l, i) => (
                <li key={i} className="flex justify-between py-2 text-sm">
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {l.nameAm}
                    <span className="ml-1 text-xs text-zinc-400">
                      {Number(l.qty)} × {l.lineKind === "service" ? t("cust.kindService") : t("cust.kindPart")}
                    </span>
                  </span>
                  <span className="tabular-nums text-zinc-900 dark:text-zinc-50">
                    {Number(l.lineTotalEtb).toLocaleString("en-US")} {t("cur.ETB")}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-2 border-t border-zinc-200 pt-2 text-sm dark:border-zinc-800">
              <div className="flex justify-between text-zinc-500">
                <span>{t("est.subtotal")}</span>
                <span className="tabular-nums">
                  {Number(inv.subtotalEtb).toLocaleString("en-US")} {t("cur.ETB")}
                </span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>
                  {t("est.tax")}{" "}
                  {inv.taxType === "vat_15"
                    ? "(15%)"
                    : inv.taxType === "tot_10_2"
                      ? "(10% / 2%)"
                      : "0%"}
                </span>
                <span className="tabular-nums">
                  {Number(inv.taxEtb).toLocaleString("en-US")} {t("cur.ETB")}
                </span>
              </div>
              <div className="mt-1 flex justify-between font-medium text-zinc-900 dark:text-zinc-50">
                <span>{t("est.total")}</span>
                <span className="tabular-nums">
                  {Number(inv.totalEtb).toLocaleString("en-US")} {t("cur.ETB")}
                </span>
              </div>
            </div>

            {inv.payments.length > 0 && (
              <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                {inv.payments
                  .map(
                    (p) =>
                      `${t("pay." + p.method)} — ${Number(
                        p.amountEtb
                      ).toLocaleString("en-US")} ${t("cur.ETB")}${p.providerRef ? ` (${p.providerRef})` : ""}`
                  )
                  .join(" · ")}
              </p>
            )}

            <div className="mt-4 grid grid-cols-4 items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <img
                src={inv.qrDataUrl}
                alt="QR"
                className="col-span-1 h-20 w-20 rounded-lg bg-white p-1"
              />
              <p className="col-span-3 text-xs leading-5 text-zinc-500">
                {t("inv.qr")}
              </p>
             </div>

            {unpaid ? (
              view === "chapa" ? (
                <div className="mt-4">
                  <ChapaPayMock
                    shopId={shopId}
                    invoiceId={inv.id}
                    totalEtb={inv.totalEtb}
                    invoiceNumber={inv.invoiceNumber}
                    onBack={() => setView("invoice")}
                    onPaid={(r) => {
                      setInv({
                        ...inv,
                        status: "paid",
                        amountPaidEtb: inv.totalEtb,
                        payments: [
                          ...inv.payments,
                          {
                            method: r.method,
                            amountEtb: String(r.amount),
                            providerRef: r.providerRef,
                            paidAt: new Date().toISOString(),
                          },
                        ],
                      });
                      setView("invoice");
                    }}
                  />
                </div>
              ) : (
                <div className="mt-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => pay("cash")}
                      disabled={busy}
                      className="flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-transform duration-200 ease-out active:scale-[0.97] disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
                    >
                      {t("inv.cash")}
                    </button>
                    <button
                      onClick={() => setView("chapa")}
                      className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-transform duration-200 ease-out hover:bg-emerald-700 active:scale-[0.97]"
                    >
                      {t("inv.pay")}
                    </button>
                  </div>
                </div>
              )
            ) : (
              <button
                onClick={onClose}
                className="mt-4 w-full rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-transform duration-200 ease-out active:scale-[0.97] dark:bg-white dark:text-zinc-900"
              >
                {t("inv.close")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
