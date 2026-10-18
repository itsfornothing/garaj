"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson, statusAm, type Order } from "../../lib/api";
import EstimateBuilderDialog from "./EstimateBuilderDialog";
import InvoiceDialog from "./InvoiceDialog";

export default function OrderActions({
  shopId,
  order,
  taxRegime,
}: {
  shopId: string;
  order: Order;
  taxRegime: string;
}) {
  const [busy, setBusy] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const router = useRouter();

  async function advance(to: string) {
    if (busy) return;
    setBusy(true);
    await apiJson("POST", `/v1/shops/${shopId}/orders/${order.id}/status`, {
      to,
    });
    setBusy(false);
    router.refresh();
  }

  if (order.status === "paid") {
    return (
      <p className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        {order.invoiceNumber} · ተከፍሏል ✓
      </p>
    );
  }
  if (order.status === "cancelled") return null;
  if (order.status === "estimate_sent") {
    return (
      <p className="mt-3 text-xs text-zinc-400">
        ግምት ተላከ (ድጋሚ {order.estimateRevision ?? 1}) — ደንበኛውን ይጠብቁ።
      </p>
    );
  }

  const solid = "rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition-transform duration-150 ease-out hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-40";
  const dark = "rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white transition-transform duration-150 ease-out hover:bg-zinc-700 active:scale-[0.97] disabled:opacity-40 dark:bg-white dark:text-zinc-900";
  const ghost = "rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400";

  const btnFor: Record<string, React.ReactNode> = {
    received: (
      <>
        <button className={solid} disabled={busy} onClick={() => advance("inspection")}>
          ምርመራ ግባ
        </button>
        <button className={ghost} disabled={busy} onClick={() => advance("cancelled")}>
          ሰርዝ
        </button>
      </>
    ),
    inspection: (
      <>
        <button className={solid} disabled={busy} onClick={() => setBuilderOpen(true)}>
          ግምት አዘጋጅ
        </button>
        <button className={ghost} disabled={busy} onClick={() => advance("cancelled")}>
          ሰርዝ
        </button>
      </>
    ),
    estimate_declined: (
      <>
        <button className={solid} disabled={busy} onClick={() => setBuilderOpen(true)}>
          እንደገና አገናኝ ላክ
        </button>
        <button className={ghost} disabled={busy} onClick={() => advance("cancelled")}>
          ሰርዝ
        </button>
      </>
    ),
    approved: (
      <>
        <button className={solid} disabled={busy} onClick={() => advance("in_progress")}>
          ሥራ ጀምር
        </button>
        <button className={ghost} disabled={busy} onClick={() => advance("cancelled")}>
          ሰርዝ
        </button>
      </>
    ),
    in_progress: (
      <button className={solid} disabled={busy} onClick={() => advance("complete")}>
        ተጠናቋል
      </button>
    ),
    complete: (
      <button className={dark} disabled={busy} onClick={() => setInvoiceOpen(true)}>
        ደረሰኝ አዘጋጅ
      </button>
    ),
  };

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {btnFor[order.status]}
        {order.status === "estimate_declined" && (
          <span className="text-[11px] text-red-500">
            ግምቱ እምቢ ተብሏል — {statusAm[order.status]}
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
          router.refresh();
        }}
      />
      <InvoiceDialog
        shopId={shopId}
        orderId={order.id}
        invoiceId={order.invoiceId ?? null}
        open={invoiceOpen}
        onClose={() => {
          setInvoiceOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
