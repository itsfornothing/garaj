"use client";

import { useState } from "react";
import { apiJson, type Order } from "../../lib/api";
import { useLang } from "../../lib/i18n";
import EstimateBuilderDialog from "./EstimateBuilderDialog";
import InvoiceDialog from "./InvoiceDialog";

export default function OrderActions({
  shopId,
  order,
  taxRegime,
  onChanged,
}: {
  shopId: string;
  order: Order;
  taxRegime: string;
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const { t } = useLang();

  async function advance(to: string) {
    if (busy) return;
    setBusy(true);
    await apiJson("POST", `/v1/shops/${shopId}/orders/${order.id}/status`, {
      to,
    });
    setBusy(false);
    onChanged?.();
  }

  if (order.status === "paid") {
    return (
      <p className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        {order.invoiceNumber} · {t("st.paid")} ✓
      </p>
    );
  }
  if (order.status === "cancelled") return null;
  if (order.status === "estimate_sent") {
    return (
      <p className="mt-3 text-xs text-zinc-400">
        {t("st.estimate_sent")} (v{order.estimateRevision ?? 1})
      </p>
    );
  }

  const solid =
    "press rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-40";
  const dark =
    "press rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 active:scale-[0.97] disabled:opacity-40 dark:bg-white dark:text-zinc-900";
  const ghost =
    "press rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 active:scale-[0.97] disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400";

  const btnFor: Record<string, React.ReactNode> = {
    received: (
      <>
        <button className={solid} disabled={busy} onClick={() => advance("inspection")}>
          {t("act.inspect")}
        </button>
        <button className={ghost} disabled={busy} onClick={() => advance("cancelled")}>
          {t("act.cancel")}
        </button>
      </>
    ),
    inspection: (
      <>
        <button className={solid} disabled={busy} onClick={() => setBuilderOpen(true)}>
          {t("act.build")}
        </button>
        <button className={ghost} disabled={busy} onClick={() => advance("cancelled")}>
          {t("act.cancel")}
        </button>
      </>
    ),
    estimate_declined: (
      <>
        <button className={solid} disabled={busy} onClick={() => setBuilderOpen(true)}>
          {t("act.build")}
        </button>
        <button className={ghost} disabled={busy} onClick={() => advance("cancelled")}>
          {t("act.cancel")}
        </button>
      </>
    ),
    approved: (
      <>
        <button className={solid} disabled={busy} onClick={() => advance("in_progress")}>
          {t("act.startWork")}
        </button>
        <button className={ghost} disabled={busy} onClick={() => advance("cancelled")}>
          {t("act.cancel")}
        </button>
      </>
    ),
    in_progress: (
      <button className={solid} disabled={busy} onClick={() => advance("complete")}>
        {t("act.finish")}
      </button>
    ),
    complete: (
      <button className={dark} disabled={busy} onClick={() => setInvoiceOpen(true)}>
        {order.invoiceId ? t("act.viewInvoice") : t("act.invoice")}
      </button>
    ),
  };

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {btnFor[order.status]}
        {order.status === "estimate_declined" && (
          <span className="text-[11px] text-red-500">
            {t("st.estimate_declined")}
          </span>
        )}
      </div>
      <EstimateBuilderDialog
        shopId={shopId}
        orderId={order.id}
        taxRegime={taxRegime}
        open={builderOpen}
        onClose={() => {
          setBuilderOpen(false);
          onChanged?.();
        }}
      />
      <InvoiceDialog
        shopId={shopId}
        orderId={order.id}
        invoiceId={order.invoiceId ?? null}
        open={invoiceOpen}
        onClose={() => {
          setInvoiceOpen(false);
          onChanged?.();
        }}
      />
    </>
  );
}
