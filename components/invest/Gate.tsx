"use client";

import { useActionState } from "react";
import { enterCode, type GateState } from "@/app/invest/actions";

/** The one field between the internet and the investor page. */
export function Gate({ denied }: { denied: boolean }) {
  const [state, action, pending] = useActionState<GateState, FormData>(enterCode, {
    error: denied ? "That link's code isn't valid. Enter the code you were given." : null,
  });
  return (
    <main className="dark gate">
      <div className="gate-box">
        <div className="gate-arch enter" aria-hidden>
          <span className="mark">
            ESKER
            <small>RENTALS</small>
          </span>
        </div>
        <p className="eyebrow enter enter-1">Private · Investors</p>
        <h1 className="serif h3 enter enter-2" style={{ marginTop: 12 }}>
          Enter your access code
        </h1>
        <form action={action} className="enter enter-3">
          <div className="field">
            <input name="code" aria-label="Access code" autoComplete="off" autoCapitalize="none" spellCheck={false} required autoFocus />
          </div>
          <button type="submit" className="btn btn-clay" disabled={pending}>
            {pending ? "Opening…" : "Open"}
          </button>
          {state.error ? <p className="err">{state.error}</p> : null}
        </form>
      </div>
    </main>
  );
}
