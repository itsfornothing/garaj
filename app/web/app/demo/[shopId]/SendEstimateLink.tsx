"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "../../lib/api";

export default function SendEstimateLink({ shopId }: { shopId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function send() {
    if (busy) return;
    setBusy(true);
    const { status, data } = await apiJson<{ token?: string }>(
      "POST",
      `/v1/shops/${shopId}/estimate-demo/send`
    );
    if (status === 200 && data.token) {
      router.push(`/demo/estimate/${shopId}?token=${data.token}`);
      return;
    }
    setBusy(false);
    setError("ችግር ተከስቷል — እባክዎ እንደገና ይሞክሩ።");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={send}
        disabled={busy}
        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-transform duration-200 ease-out hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-40"
      >
        {busy ? "በመላክ ላይ…" : "አዲስ ግምት አገናኝ ላክ"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
