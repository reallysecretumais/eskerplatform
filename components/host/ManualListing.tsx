"use client";

import { useState } from "react";
import { ListingForm } from "@/components/host/ListingForm";
import { PhotoStep } from "@/components/host/PhotoStep";
import type { CoveredArea } from "@/lib/data/host";

// "List it yourself" as one continuous flow: fill the basics → the draft saves →
// the photo step appears right here (no jump to a different page), so photos are
// an unmissable part of listing.
export function ManualListing({ areas }: { areas: CoveredArea[] }) {
  const [draftId, setDraftId] = useState<string | null>(null);
  return draftId ? <PhotoStep draftId={draftId} /> : <ListingForm areas={areas} onCreated={setDraftId} />;
}
