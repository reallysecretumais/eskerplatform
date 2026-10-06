"use client";

import { Download, ArrowLeft } from "lucide-react";

/** Screen-only bar on the handover sheet. On a phone, Print opens the share
 *  sheet where "Save as PDF" lives; on a laptop it's the print dialog. */
export function PrintBar({ back }: { back: string }) {
  return (
    <div className="sheet-bar">
      <a className="btn btn-ghost" href={back} style={{ background: "var(--ink)", minHeight: 44 }}>
        <ArrowLeft size={16} /> Back
      </a>
      <button type="button" className="btn btn-clay" style={{ minHeight: 44 }} onClick={() => window.print()}>
        <Download size={16} /> Save as PDF
      </button>
    </div>
  );
}
