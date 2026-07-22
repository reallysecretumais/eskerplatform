"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { X, Volume2, VolumeX, Send, Keyboard } from "lucide-react";
import Link from "next/link";
import type { SlimListing } from "@/lib/data/listings";
import { unitForCategory, formatPrice } from "@/lib/listings";
import { thumb } from "@/lib/img";
import { getAudioCtx } from "@/lib/voiceAudio";
import { VoiceOrb, type OrbState } from "@/components/VoiceOrb";

type Phase = "init" | "denied" | "idle" | "listening" | "transcribing" | "thinking" | "speaking";
type Turn = { role: "user" | "assistant"; content: string };
type Lang = "ur" | "en";

// LANG comes first, then the spoken reply, then STAYS. Returns the clean reply,
// the language, and ids — works on partial text mid-stream too.
function parseVoice(full: string) {
  const lang: Lang = /LANG:\s*ur/i.test(full) ? "ur" : "en";
  let body = full;
  const m = body.match(/^\s*LANG:\s*(?:ur|en)\b[^\n]*\n?/i);
  if (m) body = body.slice(m[0].length);
  else if (/^\s*LANG/i.test(body)) body = ""; // LANG line still streaming
  const iStay = body.indexOf("STAYS:");
  const reply = (iStay >= 0 ? body.slice(0, iStay) : body).trim();
  const ids = iStay >= 0 ? body.slice(iStay + 6).split(/[\s,]+/).map((s) => s.trim()).filter(Boolean) : [];
  return { reply, lang, ids };
}

// Index just past the end of the first complete sentence at/after `from`, else -1.
function sentenceEnd(text: string, from: number): number {
  for (let i = from; i < text.length - 1; i++) {
    const c = text[i];
    if ((c === "." || c === "!" || c === "?" || c === "۔") && /\s/.test(text[i + 1])) return i + 1;
  }
  return -1;
}

// The voice concierge — a floating, voice-first scene over a cheap static
// (no boxy panel). Streams speech: the first sentence is spoken while the rest
// is still being written, so there's almost no wait. The orb is the entity; the
// matched stays float in. The guest can interrupt, mute, type, or end.
export function VoiceConcierge({ listings, onClose }: { listings: SlimListing[]; onClose: () => void }) {
  const byId = new Map(listings.map((l) => [l.id, l]));

  const [phase, setPhase] = useState<Phase>("init");
  const [reply, setReply] = useState("");
  const [lang, setLang] = useState<Lang>("en");
  const [matches, setMatches] = useState<SlimListing[]>([]);
  const [muted, setMuted] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [typed, setTyped] = useState("");
  const [hasAsked, setHasAsked] = useState(false);

  // refs (imperative pipeline — avoids stale closures across the async chain)
  const phaseRef = useRef<Phase>("init");
  const aliveRef = useRef(true);
  const micOkRef = useRef(false);
  const mutedRef = useRef(false);
  const historyRef = useRef<Turn[]>([]);
  const levelRef = useRef(0);
  const pulseRef = useRef(0); // "heard you" pop timestamp

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

  // streaming-speech state
  const queueRef = useRef<AudioBuffer[]>([]);
  const playingRef = useRef(false);
  const pendingRef = useRef(0);
  const streamDoneRef = useRef(false);
  const finishedRef = useRef(false);
  const spokenRef = useRef(0);
  const synthSeqRef = useRef<Promise<void>>(Promise.resolve());

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
    pulseRef.current = performance.now(); // instant "heard you" pop
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

  // ── answer + streaming speech ─────────────────────────────────
  async function answer(text: string) {
    stopAudio();
    queueRef.current = [];
    playingRef.current = false;
    pendingRef.current = 0;
    streamDoneRef.current = false;
    finishedRef.current = false;
    spokenRef.current = 0;
    synthSeqRef.current = Promise.resolve();

    const hist: Turn[] = [...historyRef.current, { role: "user", content: text }];
    historyRef.current = hist;
    setHasAsked(true);
    setReply("");
    setMatches([]);
    go("thinking");

    let full = "";
    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: hist, voice: true, surface: "voice" }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        const p = parseVoice(full);
        setReply(p.reply);
        if (!mutedRef.current) flushSentences(p.reply, p.lang, false); // speak as it streams
      }
      const p = parseVoice(full);
      if (!aliveRef.current) return;
      const finalReply = p.reply || "Here's what I found for you.";
      setReply(finalReply);
      setLang(p.lang);
      setMatches(p.ids.map((id) => byId.get(id)).filter((l): l is SlimListing => Boolean(l)));
      historyRef.current = [...hist, { role: "assistant", content: finalReply }];
      streamDoneRef.current = true;
      if (mutedRef.current) finishTurn();
      else {
        flushSentences(finalReply, p.lang, true);
        maybeFinish();
      }
    } catch {
      if (!aliveRef.current) return;
      setReply("Sorry — I had trouble just now. Please try again.");
      streamDoneRef.current = true;
      finishTurn();
    }
  }

  // pull whole sentences off the streaming reply and synthesize them in order
  function flushSentences(replyText: string, l: Lang, isFinal: boolean) {
    let end: number;
    while ((end = sentenceEnd(replyText, spokenRef.current)) !== -1) {
      const chunk = replyText.slice(spokenRef.current, end).trim();
      spokenRef.current = end;
      if (chunk) enqueueSpeak(chunk, l);
    }
    if (isFinal) {
      const rest = replyText.slice(spokenRef.current).trim();
      spokenRef.current = replyText.length;
      if (rest) enqueueSpeak(rest, l);
    }
  }

  function enqueueSpeak(text: string, l: Lang) {
    pendingRef.current++;
    synthSeqRef.current = synthSeqRef.current.then(() => synthChunk(text, l));
  }

  async function synthChunk(text: string, l: Lang) {
    try {
      if (!aliveRef.current || mutedRef.current) return;
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: l }),
      });
      if (!res.ok || res.status === 204) return;
      const arr = await res.arrayBuffer();
      if (!aliveRef.current || mutedRef.current) return;
      const ctx = getAudioCtx();
      if (ctx.state === "suspended") await ctx.resume();
      const buf = await ctx.decodeAudioData(arr);
      if (!aliveRef.current || mutedRef.current) return;
      if (phaseRef.current !== "speaking" && phaseRef.current !== "thinking") return; // barged out
      queueRef.current.push(buf);
      if (phaseRef.current !== "speaking") go("speaking");
      startPlaying();
    } catch {
      /* ignore this chunk */
    } finally {
      pendingRef.current--;
      maybeFinish();
    }
  }

  function startPlaying() {
    if (!playingRef.current) playNext();
  }

  function playNext() {
    if (!aliveRef.current) {
      playingRef.current = false;
      return;
    }
    const buf = queueRef.current.shift();
    if (!buf) {
      playingRef.current = false;
      maybeFinish();
      return;
    }
    playingRef.current = true;
    const ctx = getAudioCtx();
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
      playNext();
    };
    ttsRef.current = node;
    node.start();
  }

  function maybeFinish() {
    if (!playingRef.current && queueRef.current.length === 0 && streamDoneRef.current && pendingRef.current === 0) finishTurn();
  }

  function finishTurn() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    afterTurn();
  }

  function afterTurn() {
    if (!aliveRef.current) return;
    if (mutedRef.current || !micOkRef.current) return go("idle");
    startListening();
  }

  function stopAudio() {
    queueRef.current = [];
    playingRef.current = false;
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
      finishedRef.current = true; // don't let the finishing pipeline also re-listen
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
      if (phaseRef.current === "speaking") go("idle");
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
    try {
      void getAudioCtx().suspend(); // keep it alive (unlocked) for next time
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
            const tooLong = now - recStartRef.current > 13000;
            const silent = speechRef.current && now - lastLoudRef.current > 800; // snappier turn-end
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

  // Voice-first: the orb carries the state. Only a tiny prompt shows while we're
  // waiting on the guest; the reply text appears only as a fallback when muted.
  const statusLabel =
    phase === "denied" ? "Microphone is off — type below" :
    phase === "listening" ? "Listening" :
    phase === "idle" ? (micOkRef.current ? "Tap to speak" : "Type your question") :
    "";
  const showDots = phase === "listening";

  const overlay = (
    <div
      className="voice-in fixed inset-0 z-[60] flex flex-col overflow-hidden text-white"
      style={{ background: "radial-gradient(120% 85% at 50% 32%, #1a1712 0%, #0c0a07 56%, #060504 100%)" }}
    >
      {/* gold aura — radial gradient (no blur filter), the only thing behind the orb */}
      <div
        className="pointer-events-none absolute left-1/2 top-[34%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.22) 0%, rgba(201,168,76,0.06) 38%, rgba(201,168,76,0) 64%)" }}
      />

      {/* close only */}
      <div className="relative z-10 flex justify-end px-6 pt-6">
        <button type="button" onClick={end} aria-label="Close" className="rounded-full bg-white/10 p-2.5 text-white/80 transition hover:bg-white/20">
          <X size={18} />
        </button>
      </div>

      {/* center: orb */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        <button type="button" onClick={onOrb} aria-label="Tap to speak or interrupt" className="outline-none transition-transform active:scale-95">
          <VoiceOrb levelRef={levelRef} state={orbState} pulseRef={pulseRef} />
        </button>

        <div className="mt-7 flex min-h-[2.25rem] max-w-lg items-start justify-center">
          {muted && reply ? (
            <p dir="auto" className="rise font-display text-xl font-medium leading-relaxed tracking-tight text-white/90 sm:text-2xl">
              {reply}
            </p>
          ) : statusLabel ? (
            <span className="inline-flex items-center gap-2 text-sm font-medium tracking-wide text-white/60">
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

        {!hasAsked && (phase === "listening" || phase === "idle") && (
          <p className="rise mt-3 text-xs text-white/40">Try: “pool ke saath ghar this weekend”</p>
        )}
      </div>

      {/* floating recommendations — one contained row, never overflows the screen */}
      {matches.length > 0 && (
        <div className="relative z-10 px-4">
          <div className="mx-auto flex max-w-3xl gap-3 overflow-x-auto pb-1 sm:justify-center [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {matches.slice(0, 4).map((l, i) => {
              const { amount, unit } = formatPrice(l.price, unitForCategory(l.category ?? ""));
              return (
                <Link
                  key={l.id}
                  href={`/stays/${l.id}`}
                  onClick={end}
                  style={{ animationDelay: `${i * 90}ms` }}
                  className="card-float group w-36 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.08] shadow-[0_16px_36px_-12px_rgba(0,0,0,0.6)] transition hover:border-gold/50 hover:bg-white/15 sm:w-44"
                >
                  <div
                    className="relative aspect-[4/3] bg-white/5"
                    style={{ backgroundImage: l.photo ? `url(${thumb(l.photo, 500, 70)})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}
                  >
                    {l.esker_exclusive && <span className="absolute left-2 top-2 rounded-md bg-gold px-2 py-0.5 text-[10px] font-medium text-ink">Exclusive</span>}
                  </div>
                  <div className="p-2.5 text-left">
                    <div className="truncate text-sm font-medium text-white">{l.title}</div>
                    <div className="text-xs text-white/55">{l.area ?? ""}</div>
                    <div className="mt-1 text-sm text-gold tnum">
                      {amount}<span className="text-white/45"> / {unit}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* controls — minimal */}
      <div className="relative z-10 flex flex-col items-center gap-3 px-6 pb-9 pt-3">
        {showInput && (
          <form onSubmit={submitTyped} className="flex w-full max-w-md items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 focus-within:border-gold/50">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              dir="auto"
              autoFocus
              placeholder="Type your question…"
              className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/45"
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
            className={`grid h-11 w-11 place-items-center rounded-full transition ${muted ? "bg-white/8 text-white/50" : "bg-gold/20 text-gold"}`}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            type="button"
            onClick={() => setShowInput((s) => !s)}
            aria-pressed={showInput}
            title="Type instead"
            className={`grid h-11 w-11 place-items-center rounded-full transition ${showInput ? "bg-gold/20 text-gold" : "bg-white/8 text-white/70"}`}
          >
            <Keyboard size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(overlay, document.body) : null;
}
