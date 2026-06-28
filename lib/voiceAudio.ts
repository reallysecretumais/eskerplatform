"use client";

// One shared AudioContext for the voice concierge, unlocked by a real user
// gesture (the "Speak to Esker" tap). Browsers block audio that starts later in
// an async pipeline; resuming the context inside the click "unlocks" it so the
// concierge's spoken replies actually play. Reused across opens so it stays
// unlocked. Playing TTS through this context (not an <audio> element) also lets
// the orb react to the real voice.

type ACtor = typeof AudioContext;
let ctx: AudioContext | null = null;

export function getAudioCtx(): AudioContext {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: ACtor }).webkitAudioContext;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** Call inside a user gesture so later programmatic playback is allowed. */
export async function unlockAudio(): Promise<void> {
  try {
    const c = getAudioCtx();
    if (c.state === "suspended") await c.resume();
  } catch {
    /* ignore — playback will simply fall back to silent */
  }
}
