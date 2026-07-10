// Client-safe pieces of the host-listing interview: the opener string + the
// field/message types. NO "server-only", NO admin/service-role imports — so the
// interview UI (a client component) can use these without pulling the server
// engine (and the service-role client) into the browser bundle. The engine in
// `hostInterview.ts` imports + re-exports from here.

export type InterviewFields = {
  title?: string;
  category?: string;
  area?: string; // must match a covered-area label
  bedrooms?: number;
  capacity?: number;
  price?: number;
  amenities?: string[];
  description?: string;
};

export type ChatMsg = { role: "user" | "assistant"; content: string };

// The greeting the client shows instantly (no round-trip). The engine injects it
// into the transcript so the model never repeats it.
export const INTERVIEW_OPENER =
  "Salam! I'm Esker's listing assistant — tell me about your place and I'll write the listing for you as we chat. So: what is it, and where is it? (Urdu bhi chalega!)";
