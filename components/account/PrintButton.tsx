"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-full border border-line-hi px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-2 print:hidden"
    >
      <Printer size={15} /> Print / Save as PDF
    </button>
  );
}
