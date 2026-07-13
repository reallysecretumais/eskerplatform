"use client";

import { useRouter } from "next/navigation";

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

// Read-only month navigation for a partner property. Changing the select pushes
// `?month=YYYY-MM` onto the same route; the server re-reads that month.
export function MonthPicker({ basePath, months, current }: { basePath: string; months: string[]; current: string }) {
  const router = useRouter();
  return (
    <select
      value={current}
      onChange={(e) => router.push(`${basePath}?month=${e.target.value}`)}
      className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-line-hi"
      aria-label="Select month"
    >
      {months.map((m) => (
        <option key={m} value={m}>{monthLabel(m)}</option>
      ))}
    </select>
  );
}
