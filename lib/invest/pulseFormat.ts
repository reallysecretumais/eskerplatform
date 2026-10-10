/**
 * The live line's shape — pure, so client components can import it while
 * `lib/invest/pulse.ts` stays server-only.
 */
export type Pulse = { inboundMessages7d: number };
