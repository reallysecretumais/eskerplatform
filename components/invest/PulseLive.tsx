import { getPulse } from "@/lib/invest/pulse";
import { rs } from "@/lib/invest/calc";

/**
 * The live figure inside the "Esker OS · read live" card. An async server
 * component, rendered through <Suspense> from the page so the CRM round-trip
 * never holds up the rest of the page: the card paints with "Reading…" and
 * the figure streams in when it arrives.
 */
export async function PulseLive() {
  const pulse = await getPulse();
  if (!pulse) {
    return <p className="pulse-off">The live figure couldn&apos;t be read just now. Ask us to show you the system on a call.</p>;
  }
  return (
    <div className="pulse-body">
      <div>
        <b className="num">{rs(pulse.inboundMessages7d)}</b>
        <span>guest messages handled in the last 7 days</span>
      </div>
    </div>
  );
}

export function PulseWaiting() {
  return (
    <p className="pulse-off pulse-wait" aria-live="polite">
      Reading from Esker OS…
    </p>
  );
}
