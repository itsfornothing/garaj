"use client";

import { useEffect, useState } from "react";
import { useLang } from "../../lib/i18n";

type Mode = "light" | "dark" | "system";

const apply = (m: Mode) => {
  const dark =
    m === "dark" ||
    (m === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute(
    "data-mode",
    dark ? "dark" : "light"
  );
};

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { t } = useLang();
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    let m: Mode = "system";
    try {
      const v = localStorage.garaj_mode;
      if (v === "dark" || v === "light" || v === "system") m = v;
    } catch {}
    setMode(m);
    apply(m);
  }, []);

  const cycle = () => {
    const next: Mode =
      mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
    setMode(next);
    apply(next);
    try {
      localStorage.garaj_mode = next;
    } catch {}
  };

  const glyph = mode === "light" ? "☀️" : mode === "dark" ? "🌙" : "ⓐ";
  const label = t("mode." + mode);

  if (compact) {
    return (
      <button
        onClick={cycle}
        title={label}
        aria-label={label}
        className="press flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-sm transition-transform duration-150 ease-out active:scale-[0.97] dark:border-zinc-700 dark:bg-zinc-900"
      >
        <span>{glyph}</span>
      </button>
    );
  }

  return (
    <button
      onClick={cycle}
      title={label}
      aria-label={label}
      className="press flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition-transform duration-150 ease-out active:scale-[0.97] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    >
      <span>{glyph}</span>
      <span>{label}</span>
    </button>
  );
}
