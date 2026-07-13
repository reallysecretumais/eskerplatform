import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { getPartnerStatement, recentMonths, currentPktMonth } from "@/lib/data/partner";
import { PrintButton } from "@/components/account/PrintButton";
import { StatementView } from "@/components/partner/StatementView";

export const metadata = { title: "Statement — Esker" };

export default async function PartnerStatementPage({ params }: { params: Promise<{ id: string; month: string }> }) {
  const account = await requireAccount();
  if (!account.roles.includes("partner")) redirect("/partner");

  const { id, month } = await params;
  const months = recentMonths(24);
  const safeMonth = months.includes(month) ? month : currentPktMonth();

  const statement = await getPartnerStatement(id, safeMonth);
  if (!statement) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/partner/properties/${id}?month=${safeMonth}`} className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
          <ChevronLeft size={16} /> Back to property
        </Link>
        <PrintButton />
      </div>

      <div className="mt-4 print:mt-0">
        <StatementView s={statement} />
      </div>
    </div>
  );
}
