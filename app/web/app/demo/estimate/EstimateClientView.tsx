"use client";

import Link from "next/link";
import { useLang } from "../../lib/i18n";
import EstimateApprover, { type EstimatePayload } from "./EstimateApprover";

export function EstimateGate({
  kind,
}: {
  kind: "invalid" | "expired";
}) {
  const { t } = useLang();
  const copy =
    kind === "expired"
      ? { title: t("cust.expired"), body: t("cust.expiredB") }
      : { title: t("cust.badLink"), body: t("cust.badLinkB") };
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-32 text-center">
      <div className="modal-in max-w-md rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <p className="font-medium">{copy.title}</p>
        <p className="mt-1 opacity-90">{copy.body}</p>
      </div>
      <Link href="/" className="press text-sm font-medium text-emerald-700 active:scale-[0.97] dark:text-emerald-400">
        ← {t("shop.back")}
      </Link>
    </main>
  );
}

export function EstimateView({
  data,
  token,
}: {
  data: EstimatePayload;
  token: string;
}) {
  const { t } = useLang();
  const head = data.head;
  const expired = new Date(head.tokenExpiresAt) < new Date();
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-10 pb-20">
        <div className="mb-2 flex items-center justify-between">
          <Link
            href="/"
            className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            ← ጋራዥ
          </Link>
          <span
            className={`rounded-full px-3 py-1 text-xs ${
              expired
                ? "bg-amber-100 text-amber-700"
                : "bg-violet-100 text-violet-700"
            }`}
          >
            {expired ? t("cust.expired") : t("cust.ready")}
          </span>
        </div>
        <h1 className="mb-6 text-xl font-medium text-zinc-900 dark:text-zinc-50">
          {t("est.title")}{" "}
          <span className="text-sm font-normal text-zinc-400">
            (v{head.revision})
          </span>
        </h1>
        <EstimateApprover data={data} token={token} />
      </main>
    </div>
  );
}
