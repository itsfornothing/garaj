"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, type Order, type Shop } from "./lib/api";
import { useLang } from "./lib/i18n";
import LangToggle from "./demo/[shopId]/LangToggle";
import ThemeToggle from "./demo/[shopId]/ThemeToggle";

const pillars = [
  { title: "home.w1", body: "home.w1b" },
  { title: "home.w2", body: "home.w2b" },
  { title: "home.w3", body: "home.w3b" },
  { title: "home.w4", body: "home.w4b" },
  { title: "home.w5", body: "home.w5b" },
  { title: "home.w6", body: "home.w6b" },
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

  const trackSpot = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div className="flex flex-1 flex-col overflow-x-clip bg-zinc-50 dark:bg-zinc-950">
      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-8">
        <div className="aurora" aria-hidden="true" />
        <span className="brand-glow text-lg font-semibold tracking-tight">
          ጋራዥ
        </span>
        <div className="flex items-center gap-2">
          <LangToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pt-14 pb-24" key={lang}>
        <p className="enter w-fit rounded-full border border-emerald-600/20 bg-emerald-50 px-3 py-1 text-sm text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400">
          {t("brand.tagline")}
        </p>
        <h1
          className="enter mt-6 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight text-zinc-900 sm:text-6xl dark:text-zinc-50"
          style={{ animationDelay: "40ms" }}
        >
          {t("home.hero")}
        </h1>
        <p
          className="enter mt-5 max-w-2xl text-xl leading-9 text-zinc-600 dark:text-zinc-300"
          style={{ animationDelay: "80ms" }}
        >
          {t("home.lead")}
        </p>
        <div className="enter mt-7 flex flex-wrap items-center gap-4" style={{ animationDelay: "120ms" }}>
          <a href="#shops" className="press rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#052e1b]">
            {t("home.cta")}
          </a>
        </div>

        <h2
          className="enter mt-20 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          style={{ animationDelay: "140ms" }}
        >
          {t("home.howwhy")}
        </h2>
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((f, i) => (
            <div
              key={f.title}
              className="enter lift rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              style={{ animationDelay: `${120 + i * 40}ms` }}
            >
              <div className="flex items-center gap-2">
                <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
                  {t(f.title)}
                </h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {t(f.body)}
              </p>
            </div>
          ))}
        </section>

        <h2 className="mt-20 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
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

        <h2 id="shops" className="mt-20 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("home.try")}
        </h2>
        <p className="mt-2 max-w-2xl text-base text-zinc-500">{t("home.trySub")}</p>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {(boards ?? []).map(({ shop, active, done }, i) => (
            <Link
              key={shop.id}
              href={`/demo/${shop.id}`}
              onMouseMove={trackSpot}
              className="enter lift spot group rounded-xl border border-zinc-200 bg-white p-5 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900"
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
