"use client";

import { useState } from "react";
import IntakeDialog from "./IntakeDialog";

export default function IntakeTrigger({
  shopId,
  onChanged,
}: {
  shopId: string;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="press rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 active:scale-[0.97] dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        <span className="font-noto">＋</span> አዲስ ሥራ
      </button>
      <IntakeDialog
        shopId={shopId}
        open={open}
        onClose={() => setOpen(false)}
        onChanged={onChanged}
      />
    </>
  );
}
