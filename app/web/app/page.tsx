"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, type Order, type Shop } from "./lib/api";
import { useLang } from "./lib/i18n";
import LangToggle from "./demo/[shopId]/LangToggle";

const features = [
  { title: "home.f.heap", body: "home.f.heapB" },
  { title: "home.f.report", body: "home.f.reportB", road: true },
  { title: "home.f.offline", body: "home.f.offlineB", road: true },
  { title: "home.f.ev", body: "home.f.evB" },
];

const steps = [
  { n: "1", title: "home.s1", body: "home.s1b" },
  { n: "2", title: "home.s2", body: "home.s2b" },
  { n: "3", title: "home.s3", body: "home.s3b" },
];

export default function Home() {
  const { t, lang } = useLang();
  const [boards, setBoards] = useState<
    { shop: Shop; active: number; done: number }[] | null
  >(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { shops } = await apiGet<{ shops: Shop[] }>("/v1/shops");
        const rows = await Promise.all(
          shops.map(async (s) => {
            const { orders } = await apiGet<{ orders: Order[] }>(
              `/v1/shops/${s.id}/orders`
            );
            return {
              shop: s,
              active: orders.filter(
                (o) => !["paid", "cancelled"].includes(o.status)
              ).length,
              done: orders.filter((o) => o.status === "paid").length,
            };
          })
        );
        if (alive) setBoards(rows);
      } catch {
        if (alive) setBoards([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const shopType = (s: string) =>
    s === "ev" ? t("shop.ev") : s === "tire" ? t("shop.tire") : t("shop.general");
  const regime = (s: string) =>
    s === "vat_15"
      ? t("shop.vat")
      : s === "tot_10_2"
        ? t("shop.tot")
        : t("shop.exempt");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-8">
        <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          ጋራዥ
        </span>
        <LangToggle />
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pt-10 pb-24" key={lang}>
        <p className="enter w-fit rounded-full border border-emerald-600/20 bg-emerald-50 px-3 py-1 text-sm text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400">
          {t("brand.tagline")}
        </p>
        <h1
          className="enter max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50"
          style={{ animationDelay: "40ms" }}
        >
          {t("home.hero")}
        </h1>
        <p
          className="enter mt-4 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400"
          style={{ animationDelay: "80ms" }}
        >
          {t("home.sub")}
        </p>

        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="enter lift rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              style={{ animationDelay: `${120 + i * 40}ms` }}
            >
              <div className="flex items-center gap-2">
                <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
                  {t(f.title)}
                </h2>
                {f.road && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    {t("home.coming")}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {t(f.body)}
              </p>
            </div>
          ))}
        </section>

        <h2 className="mt-16 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("home.how")}
        </h2>
        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="enter rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600/10 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                {s.n}
              </span>
              <h3 className="mt-3 font-medium text-zinc-900 dark:text-zinc-50">
                {t(s.title)}
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {t(s.body)}
              </p>
            </div>
          ))}
        </section>

        <h2 className="mt-16 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("home.demoShops")}
        </h2>
        <p className="mt-2 text-sm text-zinc-500">{t("home.demoSub")}</p>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {(boards ?? []).map(({ shop, active, done }, i) => (
            <Link
              key={shop.id}
              href={`/demo/${shop.id}`}
              className="enter lift group rounded-xl border border-zinc-200 bg-white p-5 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                  {shop.name}
                </h3>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {shopType(shop.shopType)}
                  {shop.taxRegime === "vat_15" ? " · 15%" : ""}
                </span>
              </div>
              <p className="mt-3 text-sm text-zinc-500">
                {active} {t("home.activeJobs")} · {done} {t("home.paidJobs")}
              </p>
              <p className="mt-1 text-xs text-zinc-400">{regime(shop.taxRegime)}</p>
              <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {t("home.openBoard")}
                <span className="transition-transform duration-200 ease-out group-hover:translate-x-0.5">
                  →
                </span>
              </p>
            </Link>
          ))}
        </section>
      </main>
      <footer className="border-t border-zinc-200 px-6 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
        {t("footer.note")}
      </footer>
    </div>
  );
}
