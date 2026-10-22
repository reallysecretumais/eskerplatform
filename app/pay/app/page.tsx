import type { Metadata } from "next";
import { CircleCheck } from "lucide-react";
import { brand } from "@/lib/brand";

/**
 * Where Safepay sends a guest who paid (or backed out) from the APP.
 *
 * The app opens checkout in an in-app browser; this page hands the guest back
 * (`<scheme>://pay-return?b=<id>&state=done|cancelled`), which the waiting
 * Pay screen catches (the app's lib/checkout.ts). It tries on its own, and the
 * button does it on a tap, because some browsers only follow an app link the
 * guest touched. Nothing here is trusted: the app asks the server what
 * happened, so a forged `state` changes only these words.
 *
 *   b      the booking id
 *   s      the build's scheme (esker / eskerpreview / eskerdev)
 *   state  done | cancelled
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Back to the app", robots: { index: false } };

const SCHEMES = ["esker", "eskerpreview", "eskerdev"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PayAppReturnPage({ searchParams }: { searchParams: Promise<{ b?: string; s?: string; state?: string }> }) {
  const { b, s, state } = await searchParams;
  const scheme = SCHEMES.includes(s ?? "") ? s! : "esker";
  const done = state !== "cancelled";
  const target = b && UUID.test(b) ? `${scheme}://pay-return?b=${b}&state=${done ? "done" : "cancelled"}` : `${scheme}://trips`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm rounded-[22px] border border-line bg-surface p-8 text-center">
        {done ? <CircleCheck size={44} className="mx-auto text-brand" strokeWidth={1.5} /> : null}
        <h1 className={`${done ? "mt-4 " : ""}headline text-2xl text-ink`}>{done ? "Payment received" : "Payment not completed"}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {done
            ? `Thank you. We're confirming your booking now, and it will show in the ${brand.name} app in a moment.`
            : "No money was taken. Go back to the app to try again or pay by bank transfer."}
        </p>
        <a
          href={target}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white"
        >
          Back to the {brand.name} app
        </a>
      </div>
      {/* Try once on arrival; the button is there when the browser wants a tap. */}
      <script dangerouslySetInnerHTML={{ __html: `setTimeout(function(){location.href=${JSON.stringify(target)}},300)` }} />
    </main>
  );
}
