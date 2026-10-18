"use client";

import { useLang } from "../../lib/i18n";

export default function LangToggle({ className = "" }: { className?: string }) {
  const { t, lang, setLang } = useLang();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "am" ? "en" : "am")}
      aria-label={lang === "am" ? "English" : "አማርኛ"}
      className={`press inline-flex h-8 items-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 ${className}`}
    >
      <span className="tabular-nums">{t("lang.toggle")}</span>
    </button>
  );
}
