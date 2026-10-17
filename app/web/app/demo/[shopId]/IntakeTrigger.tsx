"use client";

import { useState } from "react";
import IntakeDialog from "./IntakeDialog";

export default function IntakeTrigger({ shopId }: { shopId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-transform duration-200 ease-out hover:bg-zinc-700 active:scale-[0.97] dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        አዲስ ሥራ ተቀበል
      </button>
      <IntakeDialog
        shopId={shopId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
