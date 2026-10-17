import { connection } from "next/server";
import Link from "next/link";
import {
  apiGet,
  statusAm,
  statusOrder,
  type Order,
  type Shop,
} from "../../lib/api";

export const instant = false;

type Params = Promise<{ shopId: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { shopId } = await params;
  let name = shopId;
  try {
    const { shops } = await apiGet<{ shops: Shop[] }>("/v1/shops");
    const shop = shops.find((s) => s.id === shopId);
    if (shop) name = shop.name;
  } catch {
    // fall back to id in title
  }
  return { title: `${name} · ጋራዥ ሠሌዳ` };
}

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

export default async function DemoBoard({ params }: { params: Params }) {
  await connection();
  const { shopId } = await params;
  const { shops } = await apiGet<{ shops: Shop[] }>("/v1/shops");
  const shop = shops.find((s) => s.id === shopId);
  if (!shop) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-32 text-center">
        <h1 className="text-xl font-medium">ጋራዥ አልተገኘም።</h1>
        <Link
          href="/"
          className="text-sm font-medium text-emerald-700 transition-transform duration-150 ease-out active:scale-[0.97] dark:text-emerald-400"
        >
          ← ወደ ቀጥታ ይመለሱ
        </Link>
      </main>
    );
  }

  const { orders } = await apiGet<{ orders: Order[] }>(
    `/v1/shops/${shop.id}/orders`
  );

  const byStatus = new Map<string, Order[]>();
  for (const o of orders) {
    const list = byStatus.get(o.status) ?? [];
    list.push(o);
    byStatus.set(o.status, list);
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link
              href="/"
              className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              ← ጋራዥ
            </Link>
            <h1 className="mt-0.5 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              {shop.name}
              <span className="ml-2 text-sm text-zinc-400">
                {shop.shopType === "ev"
                  ? "ኤቪ ጋራዥ"
                  : shop.shopType === "tire"
                    ? "ጎማ ጋራዥ"
                    : "አጠቃላይ ጋራዥ"}
              </span>
            </h1>
          </div>
          <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-500 dark:border-zinc-700">
            {shop.taxRegime === "vat_15"
              ? "ቫት 15%"
              : shop.taxRegime === "tot_10_2"
                ? "ታክስ በአገልግሎት 10% · በክፍልፊት 2%"
                : "ግብይት ነጻ"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-x-auto p-6">
        {statusOrder.map((status) => {
          const list = byStatus.get(status) ?? [];
          return (
            <section
              key={status}
              className="flex w-72 shrink-0 flex-col gap-3"
            >
              <header className="flex items-center justify-between px-1">
                <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  {statusAm[status]}
                </h2>
                <span className="rounded-full bg-zinc-200/60 px-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {list.length}
                </span>
              </header>
              <div className="flex flex-col gap-2">
                {list.map((o) => (
                  <article
                    key={o.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {o.make} {o.model}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${chip[o.status]}`}
                      >
                        {statusAm[o.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      ሰሌዳ: {o.plateNumber ?? "—"}
                    </p>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {o.customerNameAm} · {o.customerPhone}
                    </p>
                    {o.promisedAt && (
                      <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        ተስፋ ቀን: {o.promisedAt.slice(0, 10)}
                      </p>
                    )}
                  </article>
                ))}
                {list.length === 0 && (
                  <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-400 dark:border-zinc-700">
                    ባዶ
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
