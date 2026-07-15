import { notFound, redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { getPartnerDashboard, currentPktMonth, recentMonths } from "@/lib/data/partner";
import { PropertyDashboard } from "@/components/partner/PropertyDashboard";

export const metadata = { title: "Property — Esker" };

export default async function PartnerPropertyDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const account = await requireAccount();
  if (!account.roles.includes("partner")) redirect("/partner");

  const { id } = await params;
  const months = recentMonths(12);
  const requested = (await searchParams).month;
  const month = requested && months.includes(requested) ? requested : currentPktMonth();

  const data = await getPartnerDashboard(id, month);
  if (!data) notFound();

  return <PropertyDashboard data={data} months={months} monthBase={`/partner/properties/${id}`} />;
}
