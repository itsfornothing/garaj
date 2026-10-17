import { connection } from "next/server";
import Link from "next/link";
import { apiGet, type Order, type Shop } from "./lib/api";

export const instant = false;

const features = [
  {
    title: "ግምት በተልእኮ ይፈቀዳ",
    body: "ደንበኛው የጥገና ግምት በተልእኮ አገናኝ ያገኛል — የፈቀደውን በራሱ ይመረጣል፤ የስልክ ጥሪ አያስፈልግም።",
  },
  {
    title: "ዕለታዊ ሪፖርት",
    body: "ምን ተጠናቋል፣ ምን ቀርቧል፣ ስንት ወጥቷል — በየቀኑ በአንድ አጭር ሪፖርት፣ ሁለቱም የቀን ቆጠራ በትክክል ተከታትሏል።",
  },
  {
    title: "ከመስመር ውጭ የሚሰራ",
    body: "ኢንተርኔት ሲቋረጥ ሥራው አይቋረጥም — ፍርም በተለየው ይከማቻል፣ እንደገና ሲገናኝ በራሱ ይቀርጻል።",
  },
  {
    title: "የኤሌክትሪክ ተሽከርካሩም ይቀበላል",
    body: "ባትሪ፣ ሶፍትዌር እና የኤሌክትሪክ ተሽከርካሪ ጥገናዎች በቀጥታ ከደንበኛ ታሪክ ጋር ይነገራሉ።",
  },
];

export default async function Home() {
  await connection();
  const { shops } = await apiGet<{ shops: Shop[] }>("/v1/shops");
  const boards = await Promise.all(
    shops.map(async (s) => {
      const { orders } = await apiGet<{ orders: Order[] }>(
        `/v1/shops/${s.id}/orders`
      );
      return { shop: s, orders };
    })
  );

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pt-20 pb-24">
        <p className="w-fit rounded-full border border-emerald-600/20 bg-emerald-50 px-3 py-1 text-sm text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400">
          ለኢትዮጵያ ጋራዦች የተመሰረተ
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
          ጋራዥዎን በስልክዎ ያስተዳድሩ
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          ተቀብሎ ከተከፍሏል ድረስ — ግምት፣ ፈቃድ፣ ደረሰኝ እና የወጪ ገቢ ሁሉም በአንድ ቦታ።
          በአማርኛ ፊደል፣ በብር፣ ለኢትዮጵያ ጋራዦች ብቻ።
        </p>

        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
                {f.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {f.body}
              </p>
            </div>
          ))}
        </section>

        <h2 className="mt-16 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          በንቁ አገልግሎት ላይ ያሉ ምሳሌ ጋራዦች
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          እውነተኛ የሥራ ፍሰት ለማሳየት የተዘጋጁ ምሳሌ ጋራዦች ናቸው — በነፃ ይጎብኙ።
        </p>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {boards.map(({ shop, orders }) => {
            const active = orders.filter(
              (o) => !["paid", "cancelled"].includes(o.status)
            ).length;
            const done = orders.filter((o) => o.status === "paid").length;
            return (
              <Link
                key={shop.id}
                href={`/demo/${shop.id}`}
                className="group rounded-xl border border-zinc-200 bg-white p-5 transition-transform duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                    {shop.name}
                  </h3>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {shop.shopType === "ev"
                      ? "ኤቪ"
                      : shop.shopType === "tire"
                        ? "ጎማ"
                        : "አጠቃላይ"}
                    {shop.taxRegime === "vat_15" ? " · ቫት 15%" : ""}
                  </span>
                </div>
                <p className="mt-3 text-sm text-zinc-500">
                  {active} ንቁ ሥራ · {done} የተከፈሉ
                </p>
                <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  ሠሌዳውን ይክፈቱ
                  <span className="transition-transform duration-200 ease-out group-hover:translate-x-0.5">
                    →
                  </span>
                </p>
              </Link>
            );
          })}
        </section>
      </main>
      <footer className="border-t border-zinc-200 px-6 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
        ጋራዥ · በአማርኛ ፊደል የተገነባ የጋራዥ አስተዳደር ስርዓት።
      </footer>
    </div>
  );
}
