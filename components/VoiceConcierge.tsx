"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X, Volume2, VolumeX, Send, Mic } from "lucide-react";
import type { PublicListing } from "@/lib/data/listings";
import { isUrduText } from "@/lib/listings";
import { StayCard } from "@/components/StayCard";
import { VoiceOrb, type OrbState } from "@/components/VoiceOrb";

type Phase = "init" | "denied" | "idle" | "listening" | "transcribing" | "thinking" | "speaking";
type Turn = { role: "user" | "assistant"; content: string };

// The full-screen, hands-free voice concierge. One spoken turn = record →
// transcribe (Whisper) → answer (the SAME safe retrieval as the text concierge,
// voice:true so it replies in the guest's language) → speak (OpenAI TTS) →
// listen again. The guest can interrupt (tap the orb), mute the voice, type
// instead, or end at any time. Built to run at 60fps and feel instant: the
// transcript and streamed reply + cards land before the voice plays.
export function VoiceConcierge({ listings, onClose }: { listings: PublicListing[]; onClose: () => void }) {
  const byId = new Map(listings.map((l) => [l.id, l]));

  const [phase, setPhase] = useState<Phase>("init");
  const [userText, setUserText] = useState("");
  const [reply, setReply] = useState("");
  const [matches, setMatches] = useState<PublicListing[]>([]);
  const [muted, setMuted] = useState(false);
  const [typed, setTyped] = useState("");

  // refs (imperative pipeline — avoids stale closures across the async chain)
  const phaseRef = useRef<Phase>("init");
  const aliveRef = useRef(true);
  const micOkRef = useRef(false);
  const mutedRef = useRef(false);
  const historyRef = useRef<Turn[]>([]);
  const levelRef = useRef(0);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef(0);
  const speechRef = useRef(false);
  const lastLoudRef = useRef(0);
  const recStartRef = useRef(0);
  const mimeRef = useRef("");

  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  // ── mic capture ───────────────────────────────────────────────
  function pickMime() {
    const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    for (const m of opts) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)) return m;
    return "";
  }
  const ext = (m: string) => (m.includes("mp4") ? "mp4" : m.includes("ogg") ? "ogg" : "webm");

  function startListening() {
    if (!aliveRef.current || !streamRef.current) return;
    chunksRef.current = [];
    speechRef.current = false;
    recStartRef.current = performance.now();
    lastLoudRef.current = performance.now();
    const mime = pickMime();
    mimeRef.current = mime;
    const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => handleRecording();
    recRef.current = rec;
    rec.start();
    go("listening");
  }

  function stopListening() {
    if (phaseRef.current !== "listening") return;
    go("transcribing");
    try {
      if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    } catch {
      /* ignore */
    }
  }

  async function handleRecording() {
    if (!aliveRef.current) return;
    const blob = new Blob(chunksRef.current, { type: mimeRef.current || "audio/webm" });
    if (blob.size < 1400) return afterTurn(); // too short / no speech → listen again
    const fd = new FormData();
    fd.append("audio", blob, `audio.${ext(mimeRef.current)}`);
    try {
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: fd });
      const data = await res.json();
      const q = (data?.text ?? "").trim();
      if (!aliveRef.current) return;
      if (!q) return afterTurn();
      void answer(q);
    } catch {
      if (aliveRef.current) afterTurn();
    }
  }

  // ── answer (same safe retrieval as the text concierge) ────────
  async function answer(text: string) {
    const hist: Turn[] = [...historyRef.current, { role: "user", content: text }];
    historyRef.current = hist;
    setUserText(text);
    setReply("");
    setMatches([]);
    go("thinking");

    let full = "";
    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: hist, voice: true }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        const i = full.indexOf("STAYS:");
        setReply((i >= 0 ? full.slice(0, i) : full).trim());
      }
      const i = full.indexOf("STAYS:");
      const r = (i >= 0 ? full.slice(0, i) : full).trim() || "Here's what I found for you.";
      const ids = i >= 0 ? full.slice(i + 6).split(/[\s,]+/).map((s) => s.trim()).filter(Boolean) : [];
      if (!aliveRef.current) return;
      setReply(r);
      setMatches(ids.map((id) => byId.get(id)).filter((l): l is PublicListing => Boolean(l)));
      historyRef.current = [...hist, { role: "assistant", content: r }];
      void speak(r);
    } catch {
      if (!aliveRef.current) return;
      setReply("Sorry — I had trouble just now. Please try again.");
      afterTurn();
    }
  }

  // ── speak ─────────────────────────────────────────────────────
  async function speak(text: string) {
    if (!aliveRef.current) return;
    if (mutedRef.current) return afterTurn();
    go("speaking");
    try {
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: isUrduText(text) ? "ur" : "en" }),
      });
      if (!res.ok || res.status === 204) return afterTurn();
      const blob = await res.blob();
      if (!aliveRef.current) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      const done = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
        afterTurn();
      };
      audio.onended = done;
      audio.onerror = done;
      await audio.play().catch(done);
    } catch {
      afterTurn();
    }
  }

  function afterTurn() {
    if (!aliveRef.current) return;
    if (mutedRef.current || !micOkRef.current) return go("idle");
    startListening();
  }

  function stopAudio() {
    const a = audioRef.current;
    if (a) {
      a.onended = null;
      a.onerror = null;
      a.pause();
      a.src = "";
      audioRef.current = null;
    }
  }

  // ── controls ──────────────────────────────────────────────────
  function onOrb() {
    const p = phaseRef.current;
    if (p === "listening") stopListening();
    else if (p === "speaking") {
      stopAudio();
      startListening();
    } else if (p === "idle" && micOkRef.current) startListening();
  }

  function toggleMute() {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) {
      stopAudio();
      if (phaseRef.current === "speaking") afterTurn();
    }
  }

  function submitTyped(e: FormEvent) {
    e.preventDefault();
    const q = typed.trim();
    if (!q || phaseRef.current === "thinking") return;
    setTyped("");
    stopAudio();
    void answer(q);
  }

  function end() {
    cleanup();
    onClose();
  }

  function cleanup() {
    aliveRef.current = false;
    stopAudio();
    try {
      if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    } catch {
      /* ignore */
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(rafRef.current);
    try {
      void ctxRef.current?.close();
    } catch {
      /* ignore */
    }
  }

  // ── init: mic + level loop + first listen ─────────────────────
  useEffect(() => {
    aliveRef.current = true;
    document.body.style.overflow = "hidden";

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!aliveRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        micOkRef.current = true;
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        ctxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = 1024;
        src.connect(an);
        analyserRef.current = an;

        const buf = new Float32Array(an.fftSize);
        const loop = () => {
          an.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          levelRef.current = Math.min(1, rms * 4);
          if (phaseRef.current === "listening") {
            const now = performance.now();
            if (rms > 0.045) {
              speechRef.current = true;
              lastLoudRef.current = now;
            }
            const tooLong = now - recStartRef.current > 14000;
            const silent = speechRef.current && now - lastLoudRef.current > 1200;
            if (tooLong || silent) stopListening();
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        startListening();
      } catch {
        micOkRef.current = false;
        go("denied");
      }
    })();

    return () => {
      document.body.style.overflow = "";
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── derived UI ────────────────────────────────────────────────
  const orbState: OrbState =
    phase === "listening" ? "listening" : phase === "speaking" ? "speaking" : phase === "thinking" || phase === "transcribing" ? "thinking" : "idle";
  const lang = isUrduText(reply || userText) ? "ur" : "en";
  const status =
    phase === "init" ? "Starting…" :
    phase === "denied" ? "Microphone is off — type below" :
    phase === "listening" ? "Listening…" :
    phase === "transcribing" ? "Got it…" :
    phase === "thinking" ? "Finding your stay…" :
    phase === "speaking" ? "" :
    micOkRef.current ? "Tap to speak" : "Type your question below";

  return (
    <div className="voice-in fixed inset-0 z-[60] flex flex-col bg-ink/95 text-white backdrop-blur-xl">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(60% 50% at 50% 38%, rgba(201,168,76,0.16), transparent 70%)" }} />

      {/* top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5">
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide">
          {lang === "ur" ? "اردو" : "EN"} · Esker voice
        </span>
        <button type="button" onClick={end} aria-label="Close voice concierge" className="rounded-full border border-white/15 bg-white/5 p-2 transition hover:bg-white/15">
          <X size={18} />
        </button>
      </div>

      {/* center: orb + captions */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <button type="button" onClick={onOrb} aria-label="Tap to speak or interrupt" className="outline-none">
          <VoiceOrb levelRef={levelRef} state={orbState} />
        </button>

        <div className="mt-8 min-h-[6.5rem] max-w-xl">
          {userText && <p dir="auto" className="mb-2 text-sm text-white/55">“{userText}”</p>}
          {reply ? (
            <p dir="auto" className="font-display text-xl font-medium leading-relaxed tracking-tight text-white sm:text-2xl">
              {reply}
            </p>
          ) : (
            <p className="text-sm uppercase tracking-[0.18em] text-gold">{status}</p>
          )}
          {reply && status && <p className="mt-3 text-xs uppercase tracking-[0.18em] text-white/45">{status}</p>}
        </div>
      </div>

      {/* result cards */}
      {matches.length > 0 && (
        <div className="relative z-10 mx-auto w-full max-w-4xl px-5">
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {matches.map((l) => (
              <div key={l.id} className="w-40 shrink-0 sm:w-48" onClick={end}>
                <StayCard title={l.title} category={l.category ?? "Stay"} area={l.area ?? ""} price={l.price} exclusive={l.esker_exclusive} photo={l.photos?.[0] ?? undefined} href={`/stays/${l.id}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* bottom controls */}
      <div className="relative z-10 mx-auto w-full max-w-xl px-5 pb-6 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-xs transition hover:bg-white/15"
            aria-pressed={muted}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} className="text-gold" />}
            <span className="hidden sm:inline">{muted ? "Voice off" : "Voice on"}</span>
          </button>

          <form onSubmit={submitTyped} className="flex flex-1 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-2 py-1.5 focus-within:border-gold/50">
            <Mic size={15} className="ml-1 shrink-0 text-white/40" />
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              dir="auto"
              placeholder={micOkRef.current ? "…or type your question" : "Type your question"}
              className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm text-white outline-none placeholder:text-white/40"
            />
            <button type="submit" aria-label="Send" className="shrink-0 rounded-lg bg-gold p-2 text-ink transition hover:brightness-105">
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
