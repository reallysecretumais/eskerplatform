"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 print:hidden"
    >
      <Printer size={15} /> Print / Save as PDF
    </button>
  );
}
