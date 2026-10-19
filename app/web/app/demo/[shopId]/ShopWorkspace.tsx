"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  apiGet,
  statusOrder,
  type Order,
  type Shop,
} from "../../lib/api";
import { useLang } from "../../lib/i18n";

const formatEtb = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });
import IntakeTrigger from "./IntakeTrigger";
import OrderActions from "./OrderActions";
import LangToggle from "./LangToggle";
import ThemeToggle from "./ThemeToggle";

export type WorkspaceTab = "board" | "invoices" | "audit";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  totalEtb: string;
  issuedAt: string;
  customerNameAm: string;
  make: string;
  model: string;
  plateNumber: string | null;
};

type AuditRow = {
  id: string;
  at: string;
  action: string;
  channel: string | null;
  after: Record<string, unknown> | null;
  before: Record<string, unknown> | null;
};

const chip: Record<string, string> = {
  received:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/25",
  inspection:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/25",
  estimate_sent:
    "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/25",
  estimate_declined:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/25",
  approved:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/25",
  in_progress:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/25",
  complete:
    "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/25",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25",
  cancelled:
    "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
};


export default function ShopWorkspace({
  shopId,
  tab,
}: {
  shopId: string;
  tab: WorkspaceTab;
}) {
  const { t } = useLang();
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<string>("all");
  const [hideEmpty, setHideEmpty] = useState(false);

  useEffect(() => {
    let alive = true;
    apiGet<{ shops: Shop[] }>("/v1/shops").then(
      ({ shops }) => alive && setShops(shops)
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setOrders(null);
    setInvoices(null);
    setAudit(null);
    (async () => {
      try {
        const { shops } = await apiGet<{ shops: Shop[] }>("/v1/shops");
        const shop = shops.find((s) => s.id === shopId);
        if (!shop || !alive) return;
        if (tab === "board") {
          const { orders } = await apiGet<{ orders: Order[] }>(
            `/v1/shops/${shopId}/orders`
          );
          if (alive) setOrders(orders);
        } else if (tab === "invoices") {
          const { invoices } = await apiGet<{ invoices: InvoiceRow[] }>(
            `/v1/shops/${shopId}/invoices`
          );
          if (alive) setInvoices(invoices);
        } else {
          const { entries } = await apiGet<{ entries: AuditRow[] }>(
            `/v1/shops/${shopId}/audit`
          );
          if (alive) setAudit(entries);
        }
      } catch {
        if (tab === "board" && alive) setOrders([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [shopId, tab, reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);
  const shop = shops.find((s) => s.id === shopId);
  const byStatus = new Map<string, Order[]>();
  for (const o of orders ?? []) {
    const list = byStatus.get(o.status) ?? [];
    list.push(o);
    byStatus.set(o.status, list);
  }

  const regime =
    shop?.taxRegime === "vat_15"
      ? t("shop.vat")
      : shop?.taxRegime === "tot_10_2"
        ? t("shop.tot")
        : t("shop.exempt");
  const shopType = (s: string) =>
    s === "ev" ? t("shop.ev") : s === "tire" ? t("shop.tire") : t("shop.general");

  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: "board", label: t("nav.board") },
    { id: "invoices", label: t("nav.invoices") },
    { id: "audit", label: t("nav.audit") },
  ];

  return (
    <div className="flex min-h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="glass sticky top-0 z-40">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="press text-sm text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              ← ጋራዥ
            </Link>
            {shops.length > 0 && (
              <div className="relative">
                <select
                  value={shopId}
                  onChange={(e) => router.push(`/demo/${e.target.value}`)}
                  className="w-fit appearance-none rounded-full border border-zinc-200 bg-transparent py-1.5 pl-3 pr-8 text-sm font-medium text-zinc-900 outline-none dark:border-zinc-700 dark:text-zinc-50"
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {shopType(s.shopType)}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">
                  ▼
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <IntakeTrigger shopId={shopId} onChanged={refresh} />
            <div className="flex items-center gap-2">
              <LangToggle />
              <ThemeToggle compact />
            </div>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-6xl items-center gap-5 px-6">
          {tabs.map((x) => (
            <Link
              key={x.id}
              href={`/demo/${shopId}${x.id === "board" ? "" : `/${x.id}`}`}
              className={
                "relative pb-3 pt-2 text-sm transition-colors " +
                (tab === x.id
                  ? "font-semibold text-zinc-900 after:absolute after:inset-x-0 after:-bottom-px after:border-b-2 after:border-emerald-600 dark:text-zinc-50 dark:after:border-emerald-400"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200")
              }
            >
              {x.label}
            </Link>
          ))}
          <span className="ml-auto hidden pb-3 text-xs text-zinc-400 sm:block">
            {regime}
          </span>
        </nav>
      </div>

      {tab === "board" && (
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-5">
          <div className="mb-4 flex shrink-0 flex-wrap items-center gap-2">
            <FilterChip
              label={t("board.filterAll")}
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            {statusOrder.map((sKey) => (
              <FilterChip
                key={sKey}
                label={t(`st.${sKey}`)}
                active={filter === sKey}
                onClick={() => setFilter(sKey)}
              />
            ))}
            <FilterChip
              label={hideEmpty ? t("board.showEmpty") : t("board.hideEmpty")}
              active={hideEmpty}
              onClick={() => setHideEmpty(!hideEmpty)}
            />
          </div>
          <div
            className={
              filter === "all"
                ? "flex flex-1 gap-4 overflow-x-auto"
                : "flex w-full"
            }
          >
          {filter === "all"
            ? statusOrder
                .filter((s) => !hideEmpty || (byStatus.get(s) ?? []).length > 0)
                .map((status, ci) => {
            const list = byStatus.get(status) ?? [];
            return (
              <section key={status} className="flex w-72 shrink-0 flex-col">
                <header className="flex items-center justify-between px-1 pb-3">
                  <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                    {t(`st.${status}`)}
                  </h2>
                  <span className="rounded-full bg-zinc-200/60 px-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {list.length}
                  </span>
                </header>
                <div className="flex flex-col gap-2">
                  {list.map((o, i) => (
                    <article
                      key={o.id}
                      className="enter rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                      style={{ animationDelay: `${Math.min(i, 4) * 40 + ci * 40}ms` }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {o.make} {o.model}
                        </p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${chip[o.status]}`}
                        >
                          {t(`st.${o.status}`)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        {t("board.plate")}: {o.plateNumber ?? "—"}
                      </p>
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {o.customerNameAm} · {o.customerPhone}
                      </p>
                      {o.promisedAt && (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                          {t("board.promised")}: {o.promisedAt.slice(0, 10)}
                        </p>
                      )}
                      <OrderActions
                        shopId={shopId}
                        order={o}
                        taxRegime={shop?.taxRegime ?? "vat_15"}
                        onChanged={refresh}
                      />
                    </article>
                  ))}
                  {list.length === 0 && (
                    <div
                      className="enter rounded-xl border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-400 dark:border-zinc-700"
                      style={{ animationDelay: `${ci * 40}ms` }}
                    >
                      {t("board.empty")}
                    </div>
                  )}
                </div>
              </section>
            );
          })
            : (() => {
                const list = byStatus.get(filter) ?? [];
                return (
                  <section className="flex w-full max-w-xl flex-col">
                    <header className="flex items-center justify-between px-1 pb-3">
                      <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                        {t(`st.${filter}`)}
                      </h2>
                      <span className="rounded-full bg-zinc-200/60 px-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {list.length}
                      </span>
                    </header>
                    <div className="flex flex-col gap-2">
                      {list.map((o, i) => (
                        <article
                          key={o.id}
                          className="enter rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                          style={{ animationDelay: `${Math.min(i, 4) * 40}ms` }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-zinc-900 dark:text-zinc-50">
                              {o.make} {o.model}
                            </p>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs ${chip[o.status]}`}
                            >
                              {t(`st.${o.status}`)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-zinc-500">
                            {t("board.plate")}: {o.plateNumber ?? "—"}
                          </p>
                          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                            {o.customerNameAm} · {o.customerPhone}
                          </p>
                          {o.promisedAt && (
                            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                              {t("board.promised")}: {o.promisedAt.slice(0, 10)}
                            </p>
                          )}
                          <OrderActions
                            shopId={shopId}
                            order={o}
                            taxRegime={shop?.taxRegime ?? "vat_15"}
                            onChanged={refresh}
                          />
                        </article>
                      ))}
                      {list.length === 0 && (
                        <div className="enter rounded-xl border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-400 dark:border-zinc-700">
                          {t("board.empty")}
                        </div>
                      )}
                    </div>
                  </section>
                );
              })()}
          </div>
          {orders && orders.length === 0 && (
            <div className="m-auto max-w-sm text-center">
              <p className="text-4xl">🧰</p>
              <p className="mt-3 text-sm text-zinc-500">{t("nav.loading")}</p>
            </div>
          )}
        </div>
      )}

      {tab === "invoices" && (
        <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {invoices === null && (
              <p className="p-6 text-sm text-zinc-400">{t("nav.loading")}</p>
            )}
            {invoices?.length === 0 && (
              <p className="p-6 text-sm text-zinc-400">{t("invPage.none")}</p>
            )}
            {invoices?.map((inv, i) => (
              <div
                key={inv.id}
                className="enter flex items-center justify-between gap-4 border-b border-zinc-100 px-5 py-4 last:border-0 dark:border-zinc-800"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm text-zinc-900 dark:text-zinc-50">
                    {inv.invoiceNumber}
                  </p>
                  <p className="truncate text-sm text-zinc-500">
                    {inv.customerNameAm} · {inv.make} {inv.model}
                    {inv.plateNumber ? ` · ${inv.plateNumber}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm text-zinc-600 dark:text-zinc-300">
                    {formatEtb(Number(inv.totalEtb))} {t("cur.ETB")}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      inv.status === "paid"
                        ? chip.paid
                        : inv.status === "voided"
                          ? chip.cancelled
                          : chip.complete
                    }`}
                  >
                    {inv.status === "paid"
                      ? t("invPage.paidChip")
                      : inv.status === "voided"
                        ? t("invPage.voided")
                        : t("invPage.unpaid")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-6">
          <p className="mb-4 text-sm text-zinc-500">{t("aud.sub")}</p>
          {audit === null && (
            <p className="text-sm text-zinc-400">{t("nav.loading")}</p>
          )}
          {audit?.length === 0 && (
            <p className="text-sm text-zinc-400">{t("aud.none")}</p>
          )}
          <ol className="relative ml-2 border-l border-zinc-200 dark:border-zinc-800">
            {audit?.map((e, i) => (
              <li
                key={e.id}
                className="enter relative py-3 pl-6"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <span className="absolute -left-[5px] top-5 h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {t(`aud.a.${e.action}`)}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {new Date(e.at).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {e.channel ? ` · ${e.channel}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "press rounded-full border px-3 py-1.5 text-xs font-medium transition-transform duration-150 ease-out active:scale-[0.97] " +
        (active
          ? "border-emerald-600 bg-emerald-600/10 text-emerald-800 dark:border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200")
      }
    >
      {label}
    </button>
  );
}
