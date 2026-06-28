"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X, Volume2, VolumeX, Send, Keyboard } from "lucide-react";
import Link from "next/link";
import type { PublicListing } from "@/lib/data/listings";
import { unitForCategory, formatPrice } from "@/lib/listings";
import { thumb } from "@/lib/img";
import { getAudioCtx } from "@/lib/voiceAudio";
import { VoiceOrb, type OrbState } from "@/components/VoiceOrb";

type Phase = "init" | "denied" | "idle" | "listening" | "transcribing" | "thinking" | "speaking";
type Turn = { role: "user" | "assistant"; content: string };
type Lang = "ur" | "en";

// Strip the control lines (LANG / STAYS) the model appends, returning the clean
// spoken reply, the tagged language, and the recommended ids.
function parseVoice(full: string) {
  const iLang = full.indexOf("LANG:");
  const iStay = full.indexOf("STAYS:");
  const cuts = [iLang, iStay].filter((i) => i >= 0);
  const cut = cuts.length ? Math.min(...cuts) : full.length;
  const reply = full.slice(0, cut).trim();
  const lang: Lang = /LANG:\s*ur/i.test(full) ? "ur" : "en";
  const ids = iStay >= 0 ? full.slice(iStay + 6).split(/[\s,]+/).map((s) => s.trim()).filter(Boolean) : [];
  return { reply, lang, ids };
}

// The full-screen, hands-free voice concierge — a cinematic, voice-first scene
// (not a chat popup). One spoken turn = record → transcribe → answer (the same
// safe public-listings retrieval, voice:true; Urdu comes back as clean Roman
// Urdu) → speak → listen again. Audio plays through the shared, gesture-unlocked
// AudioContext so replies reliably play and the orb pulses with the real voice.
export function VoiceConcierge({ listings, onClose }: { listings: PublicListing[]; onClose: () => void }) {
  const byId = new Map(listings.map((l) => [l.id, l]));

  const [phase, setPhase] = useState<Phase>("init");
  const [reply, setReply] = useState("");
  const [lang, setLang] = useState<Lang>("en");
  const [matches, setMatches] = useState<PublicListing[]>([]);
  const [muted, setMuted] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [typed, setTyped] = useState("");

  // refs (imperative pipeline — avoids stale closures across the async chain)
  const phaseRef = useRef<Phase>("init");
  const aliveRef = useRef(true);
  const micOkRef = useRef(false);
  const mutedRef = useRef(false);
  const historyRef = useRef<Turn[]>([]);
  const levelRef = useRef(0);

  const streamRef = useRef<MediaStream | null>(null);
  const micSrcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micAnRef = useRef<AnalyserNode | null>(null);
  const outAnRef = useRef<AnalyserNode | null>(null);
  const ttsRef = useRef<AudioBufferSourceNode | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
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
        setReply(parseVoice(full).reply);
      }
      const { reply: r, lang: L, ids } = parseVoice(full);
      if (!aliveRef.current) return;
      const finalReply = r || "Here's what I found for you.";
      setReply(finalReply);
      setLang(L);
      setMatches(ids.map((id) => byId.get(id)).filter((l): l is PublicListing => Boolean(l)));
      historyRef.current = [...hist, { role: "assistant", content: finalReply }];
      void speak(finalReply, L);
    } catch {
      if (!aliveRef.current) return;
      setReply("Sorry — I had trouble just now. Please try again.");
      afterTurn();
    }
  }

  // ── speak (Web Audio playback through the unlocked context) ────
  async function speak(text: string, l: Lang) {
    if (!aliveRef.current) return;
    if (mutedRef.current) return afterTurn();
    go("speaking");
    try {
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: l }),
      });
      if (!res.ok || res.status === 204) return afterTurn();
      const arr = await res.arrayBuffer();
      if (!aliveRef.current) return;
      const ctx = getAudioCtx();
      if (ctx.state === "suspended") await ctx.resume();
      const buf = await ctx.decodeAudioData(arr);
      if (!aliveRef.current) return;
      const node = ctx.createBufferSource();
      node.buffer = buf;
      const out = outAnRef.current;
      if (out) {
        node.connect(out);
        out.connect(ctx.destination);
      } else {
        node.connect(ctx.destination);
      }
      node.onended = () => {
        if (ttsRef.current === node) ttsRef.current = null;
        afterTurn();
      };
      ttsRef.current = node;
      node.start();
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
    const n = ttsRef.current;
    if (n) {
      n.onended = null;
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
      ttsRef.current = null;
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
    try {
      micSrcRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(rafRef.current);
    // keep the shared context alive (just idle it) so it stays unlocked next time
    try {
      void getAudioCtx().suspend();
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

        const ctx = getAudioCtx();
        if (ctx.state === "suspended") await ctx.resume();
        const micSrc = ctx.createMediaStreamSource(stream);
        micSrcRef.current = micSrc;
        const micAn = ctx.createAnalyser();
        micAn.fftSize = 1024;
        micSrc.connect(micAn);
        micAnRef.current = micAn;
        const outAn = ctx.createAnalyser();
        outAn.fftSize = 512;
        outAnRef.current = outAn;

        const micBuf = new Float32Array(new ArrayBuffer(micAn.fftSize * 4));
        const outBuf = new Float32Array(new ArrayBuffer(outAn.fftSize * 4));
        const rms = (an: AnalyserNode, b: Float32Array<ArrayBuffer>) => {
          an.getFloatTimeDomainData(b);
          let s = 0;
          for (let i = 0; i < b.length; i++) s += b[i] * b[i];
          return Math.sqrt(s / b.length);
        };
        const loop = () => {
          const micRms = rms(micAn, micBuf);
          if (phaseRef.current === "speaking") levelRef.current = Math.min(1, rms(outAn, outBuf) * 5);
          else levelRef.current = Math.min(1, micRms * 4);
          if (phaseRef.current === "listening") {
            const now = performance.now();
            if (micRms > 0.045) {
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
        setShowInput(true);
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

  // Voice-first: no on-screen reply text (it carried mixed scripts and felt like
  // a chatbot). The orb conveys thinking/speaking; only a tiny prompt shows when
  // we're waiting on the guest. The reply text appears only as a fallback when
  // the voice is muted.
  const statusLabel =
    phase === "denied" ? "Microphone is off — type below" :
    phase === "listening" ? "Listening" :
    phase === "idle" ? (micOkRef.current ? "Tap to speak" : "Type your question") :
    "";
  const showDots = phase === "listening";

  return (
    <div
      className="voice-in fixed inset-0 z-[60] flex flex-col overflow-hidden text-white"
      style={{ background: "radial-gradient(125% 90% at 50% 28%, #1a1712 0%, #0b0a08 55%, #060504 100%)" }}
    >
      {/* gold aura behind the orb */}
      <div
        className="pointer-events-none absolute left-1/2 top-[32%] h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[130px]"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.20), transparent 70%)" }}
      />
      {/* cinematic vignette */}
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,0.55)" }} />

      {/* top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-6">
        <span className="font-display text-sm font-semibold tracking-wide text-white/65">
          Esker <span className="text-gold">voice</span>
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/55">
            {lang === "ur" ? "Urdu" : "English"}
          </span>
          <button type="button" onClick={end} aria-label="Close" className="rounded-full border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/15">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* center: orb + reply */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <button type="button" onClick={onOrb} aria-label="Tap to speak or interrupt" className="outline-none transition-transform active:scale-95">
          <VoiceOrb levelRef={levelRef} state={orbState} />
        </button>

        <div className="mt-10 flex min-h-[2.5rem] max-w-lg items-start justify-center">
          {muted && reply ? (
            <p dir="auto" className="rise font-display text-xl font-medium leading-relaxed tracking-tight text-white/90 sm:text-2xl">
              {reply}
            </p>
          ) : statusLabel ? (
            <span className="inline-flex items-center gap-2 text-sm font-medium tracking-wide text-white/55">
              {statusLabel}
              {showDots && (
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold [animation-delay:160ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold [animation-delay:320ms]" />
                </span>
              )}
            </span>
          ) : null}
        </div>
      </div>

      {/* results — a clean gallery row that rises in */}
      {matches.length > 0 && (
        <div className="rise relative z-10 mx-auto w-full max-w-3xl px-6">
          <div className="flex justify-start gap-3 overflow-x-auto pb-1 sm:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {matches.slice(0, 4).map((l) => {
              const { amount, unit } = formatPrice(l.price, unitForCategory(l.category ?? ""));
              return (
                <Link
                  key={l.id}
                  href={`/stays/${l.id}`}
                  onClick={end}
                  className="group w-44 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur transition hover:border-gold/40 sm:w-52"
                >
                  <div
                    className="relative aspect-[4/3] bg-white/5"
                    style={{ backgroundImage: l.photos?.[0] ? `url(${thumb(l.photos[0], 500, 70)})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}
                  >
                    {l.esker_exclusive && <span className="absolute left-2 top-2 rounded-md bg-gold px-2 py-0.5 text-[10px] font-medium text-ink">Exclusive</span>}
                  </div>
                  <div className="p-3">
                    <div className="truncate text-sm font-medium text-white">{l.title}</div>
                    <div className="text-xs text-white/50">{l.area ?? ""}</div>
                    <div className="mt-1.5 text-sm text-gold tnum">
                      {amount}<span className="text-white/40"> / {unit}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* controls — minimal, glassy, voice-first */}
      <div className="relative z-10 flex flex-col items-center gap-3 px-6 pb-9 pt-5">
        {showInput && (
          <form onSubmit={submitTyped} className="flex w-full max-w-md items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2 backdrop-blur-md focus-within:border-gold/50">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              dir="auto"
              autoFocus
              placeholder="Type your question…"
              className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/40"
            />
            <button type="submit" aria-label="Send" className="shrink-0 rounded-full bg-gold p-1.5 text-ink transition hover:brightness-105">
              <Send size={15} />
            </button>
          </form>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMute}
            aria-pressed={muted}
            title={muted ? "Voice off" : "Voice on"}
            className={`grid h-11 w-11 place-items-center rounded-full border backdrop-blur transition ${muted ? "border-white/12 bg-white/5 text-white/50" : "border-gold/40 bg-gold/15 text-gold"}`}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            type="button"
            onClick={() => setShowInput((s) => !s)}
            aria-pressed={showInput}
            title="Type instead"
            className={`grid h-11 w-11 place-items-center rounded-full border backdrop-blur transition ${showInput ? "border-gold/40 bg-gold/15 text-gold" : "border-white/12 bg-white/5 text-white/70"}`}
          >
            <Keyboard size={18} />
          </button>
        </div>

        <p className="text-[11px] text-white/40">Tap the circle to talk · English or Urdu</p>
      </div>
    </div>
  );
}
