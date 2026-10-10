import { getPulse } from "@/lib/invest/pulse";
import { ago } from "@/lib/invest/pulseFormat";
import { rs } from "@/lib/invest/calc";

/**
 * The two live figures inside the "Esker OS · read live" card. An async server
 * component, rendered through <Suspense> from the page so the CRM round-trip
 * never holds up the rest of the page: the card paints with "Reading…" and the
 * figures stream in when they arrive.
 */
export async function PulseLive() {
  const pulse = await getPulse();
  if (!pulse) {
    return <p className="pulse-off">The live figures couldn&apos;t be read just now. Ask us to show you the system on a call.</p>;
  }
  return (
    <div className="pulse-body">
      <div>
        <b className="num">{pulse.lastBookingAt ? ago(pulse.lastBookingAt) : "—"}</b>
        <span>last booking received</span>
      </div>
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
