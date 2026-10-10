"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ChevronDown, FileText, MessageCircle, Volume2, VolumeX, MapPin, Sparkles } from "lucide-react";
import { AREAS, BUDGETS, PACKAGES, TERMS, COST_LABEL, UNIT_INCLUDES, FOUNDERS, HERO_VIDEO, PHOTOS, type PackageId, type UnitType } from "@/lib/invest/config";
import { quote, compareRows, returnRange, headline, fitForBudget, areaSummary, standardAreas, specialAreas, unitsOf, findArea, rs, lakh, pct, months, stakeLabel, type Quote, type Option } from "@/lib/invest/calc";
import type { Pulse } from "@/lib/invest/pulseFormat";
import { Num, Reveal, useInView } from "./motion";
import { Story, Model, Protected, Proof, Verify, People, Terms, Footer, Pic, photo, sized } from "./Sections";
import { MapDefs, AreaTile } from "./AreaMap";

export type InitialSelection = { areaId: string; unit: UnitType; stake: number; pkg: PackageId };

const rsFmt = (n: number) => rs(n);
const pkgOf = (id: PackageId) => PACKAGES.find((p) => p.id === id)!;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function InvestPage({ initial, name, pulse }: { initial: InitialSelection; name: string | null; pulse: Pulse | null }) {
  const [areaId, setAreaId] = useState(initial.areaId);
  const [unit, setUnit] = useState<UnitType>(initial.unit);
  const [stake, setStake] = useState(initial.stake);
  const [pkg, setPkg] = useState<PackageId>(initial.pkg);
  const [budget, setBudget] = useState<number | null>(null);

  const area = findArea(areaId)!;
  const available = unitsOf(area);
  const q = quote({ areaId, unit, stake })!;
  const proj = q.packages[pkg];

  // The selection lives in the URL, so a refresh, a shared link, the WhatsApp
  // message and the handover sheet all carry exactly what's on screen.
  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.set("area", areaId);
    u.searchParams.set("unit", unit);
    u.searchParams.set("stake", stake === 1 ? "100" : "50");
    u.searchParams.set("pkg", pkg);
    u.searchParams.delete("denied");
    u.searchParams.delete("k"); // never leave the access code sitting in the address bar
    window.history.replaceState(null, "", u);
  }, [areaId, unit, stake, pkg]);

  function apply(o: { areaId: string; unit: UnitType; stake: number }) {
    setAreaId(o.areaId);
    setUnit(o.unit);
    setStake(o.stake);
  }
  function pickArea(id: string) {
    const a = findArea(id)!;
    setAreaId(id);
    if (!a.units[unit]) setUnit(unitsOf(a)[0]);
  }

  // On a phone the area cards scroll sideways: keep the selected one in view —
  // on arrival (a shared link may select the fifth) and after a Compare tap.
  const areasRef = useRef<HTMLDivElement>(null);
  const firstPlacement = useRef(true);
  useEffect(() => {
    const row = areasRef.current;
    const card = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !card || row.scrollWidth <= row.clientWidth) return;
    const left = row.scrollLeft + card.getBoundingClientRect().left - row.getBoundingClientRect().left - 20;
    // On arrival: jump (a smooth scroll in a snapping row gets cut short
    // mid-glide — measured stopping halfway). Afterwards the glide reads well.
    row.scrollTo({ left, behavior: firstPlacement.current ? "auto" : "smooth" });
    firstPlacement.current = false;
  }, [areaId]);

  const resultsRef = useRef<HTMLDivElement>(null);
  function load(id: string, u: UnitType) {
    setAreaId(id);
    setUnit(u);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const fit = budget !== null ? fitForBudget(budget) : null;

  return (
    <>
      <MapDefs />
      <Progress />
      <Hero name={name} />
      <Story />
      <Model />

      <section id="numbers" className="pad">
        <div className="wrap">
          <p className="eyebrow">Your numbers</p>
          <Reveal>
            <h2 className="serif h2" style={{ marginTop: 16 }}>
              Start with <em>your budget.</em>
            </h2>
          </Reveal>
          <p className="lede" style={{ marginTop: 14 }}>
            Tell us roughly what you&apos;d like to invest, and we&apos;ll show what it gets you. Then fine-tune the area, the unit and your stake; every figure recalculates from today&apos;s rents and our real running costs.
          </p>

          <div className="budgets" role="group" aria-label="Budget">
            {BUDGETS.map((b) => (
              <button
                key={b.amount}
                type="button"
                className="chip num"
                aria-pressed={budget === b.amount}
                onClick={() => {
                  setBudget(b.amount);
                  const f = fitForBudget(b.amount);
                  apply(f.best ?? f.smallest);
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
          {fit ? <Fit budget={budget!} fit={fit} current={{ areaId, unit, stake }} onPick={apply} /> : null}

          <div className="calc-grid">
            <div>
              <div className="q-block">
                <div className="q-label">
                  <span className="n num">01</span>
                  <h3 className="serif">Choose an area</h3>
                </div>
                <div className="areas" role="group" aria-label="Area" ref={areasRef}>
                  {standardAreas().map((a) => {
                    const s = areaSummary(a);
                    const ph = PHOTOS.find((p) => p.area === a.id);
                    return (
                      <button key={a.id} type="button" className="area" aria-pressed={a.id === areaId} onClick={() => pickArea(a.id)}>
                        <div className="ph arch">
                          {ph ? <Pic k={ph.key} size={520} /> : <AreaTile areaId={a.id} active={a.id === areaId} />}
                          <span className="badge num">up to {s.bestReturn}% / yr</span>
                        </div>
                        <div className="meta">
                          <div className="nm">{a.name}</div>
                          <div className="sb">{a.sub}</div>
                          <div className="fr num">from Rs {lakh(s.fromUpfront)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="seg-note">{area.tagline}</p>
              </div>

              <div className="q-block">
                <div className="q-label">
                  <span className="n num">02</span>
                  <h3 className="serif">Choose a unit</h3>
                </div>
                <Segmented
                  label="Unit"
                  value={unit}
                  options={(["1BHK", "2BHK"] as const).map((u) => ({ value: u, label: u, disabled: !available.includes(u) }))}
                  onChange={(v) => setUnit(v as UnitType)}
                />
                <p className="seg-note">
                  {(["1BHK", "2BHK"] as const).filter((u) => !available.includes(u)).map((u) => `${u} not offered in ${area.name}. `)}
                  {UNIT_INCLUDES[unit]}
                </p>
              </div>

              <div className="q-block">
                <div className="q-label">
                  <span className="n num">03</span>
                  <h3 className="serif">Choose your stake</h3>
                </div>
                <Segmented
                  label="Stake"
                  value={String(stake)}
                  options={[
                    { value: "1", label: "Full (100%)" },
                    { value: "0.5", label: "Half (50%)" },
                  ]}
                  onChange={(v) => setStake(Number(v))}
                />
                <p className="seg-note">
                  Your investment: <b className="num">Rs <Num value={q.yourCapital} format={rsFmt} startOnView={false} /></b>
                  {budget !== null && q.yourCapital > budget ? <span className="over"> · above your {BUDGETS.find((b) => b.amount === budget)?.label} budget</span> : null}
                </p>
              </div>
            </div>

            <div className="results-col" ref={resultsRef} id="results">
              <Results q={q} pkg={pkg} setPkg={setPkg} />
            </div>
          </div>

          <Compare onLoad={load} current={{ areaId, unit }} />
        </div>
      </section>

      <Limited />
      <Protected />
      <Proof />
      <Verify pulse={pulse} />
      <People />
      <Terms />
      <Cta q={q} pkg={pkg} />
      <Footer />
      <StickySummary amount={proj.yourMonthly} label={`${area.name} · ${unit} · ${stake === 1 ? "Full" : "Half"}`} resultsRef={resultsRef} />
    </>
  );
}

/* ── Scroll progress hairline ───────────────────────────────────────────── */

function Progress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      el.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return <div className="progress" ref={ref} aria-hidden />;
}

/* ── Hero ───────────────────────────────────────────────────────────────── */

function Hero({ name }: { name: string | null }) {
  const range = useMemo(() => returnRange("standard"), []);
  const h = useMemo(() => headline("standard"), []);
  return (
    <header className="dark hero" id="top">
      <div className="topbar">
        <div className="wrap">
          <div className="mark">
            ESKER
            <small>RENTALS</small>
          </div>
          <span className="private">Private · Investors</span>
        </div>
      </div>
      <div className="wrap hero-grid">
        <div>
          <p className="eyebrow enter enter-1">{name ? `Prepared for ${name}` : "Invest with Esker"}</p>
          <h1 className="serif h1 enter enter-2" style={{ marginTop: 18 }}>
            Earn from Islamabad&apos;s short-stay market. <em>Without buying property.</em>
          </h1>
          <p className="lede enter enter-3" style={{ marginTop: 20 }}>
            You fund the setup of an apartment. We find it, furnish it and run it, and {Math.round(TERMS.investorShare * 100)}% of the profit is yours, every month.
          </p>
          <div className="keyfacts enter enter-4">
            <div>
              <b className="num">Rs {lakh(h.fromCapital)}</b>
              <span>to start</span>
            </div>
            <div>
              <b className="num">Rs {Math.round(h.monthlyMin / 1000)}k–{lakh(h.monthlyMax)}</b>
              <span>projected a month</span>
            </div>
            <div>
              <b className="num">{Math.floor(h.paybackMin)}–{Math.ceil(h.paybackMax)} months</b>
              <span>to get your capital back</span>
            </div>
          </div>
          <p className="cap enter enter-4">
            <span className="num">{range.min}–{range.max}%</span> projected annual return at the Standard package <span className="proj">Projected</span>
          </p>
          <div className="trust enter enter-5">
            <div><b className="num">25+</b><span className="lbl">properties</span></div>
            <div><b className="num">3 years</b><span className="lbl">operating</span></div>
            <div><b className="num">85–90%</b><span className="lbl">portfolio occupancy</span></div>
            <div><b className="num">30 days</b><span className="lbl">to go live</span></div>
          </div>
          <div className="hero-btns enter enter-5">
            <a className="btn btn-clay" href="#numbers">
              See your numbers <ArrowDown size={17} className="arrow" />
            </a>
            <a className="btn btn-ghost" href="#next">
              Talk to a founder
            </a>
          </div>
        </div>
        <div className="hero-arch">
          <div className="arch-ring" aria-hidden />
          <div className="frame arch arch-open">
            <Film />
          </div>
          <span className="chip">
            <i aria-hidden />
            Live in {TERMS.launchDays} days
          </span>
        </div>
      </div>
    </header>
  );
}

/** Hamza's one-minute film, silent until tapped. Its captions are burned in,
 *  so it reads muted; reduced motion shows the poster and a play button. */
function Film() {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const still = reduced();
  useEffect(() => {
    const v = ref.current;
    if (!v || still) return;
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [still]);
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (!playing) {
      v.muted = false;
      setMuted(false);
      v.play().then(() => setPlaying(true)).catch(() => {});
      return;
    }
    v.muted = !v.muted;
    setMuted(v.muted);
  };
  return (
    <div className="film">
      <video ref={ref} src={HERO_VIDEO.src} poster={sized(photo(HERO_VIDEO.poster).url, 900)} muted loop playsInline preload="metadata" aria-label={HERO_VIDEO.caption} />
      <button type="button" className="film-btn" onClick={toggle} aria-label={!playing ? "Play with sound" : muted ? "Turn sound on" : "Turn sound off"}>
        {!playing || muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        <span>{!playing ? "Play with sound" : muted ? "Tap for sound" : "Sound on"}</span>
      </button>
      <span className="film-cap">{HERO_VIDEO.caption}</span>
    </div>
  );
}

/* ── Budget fit ─────────────────────────────────────────────────────────── */

function Fit({ budget, fit, current, onPick }: { budget: number; fit: ReturnType<typeof fitForBudget>; current: { areaId: string; unit: UnitType; stake: number }; onPick: (o: Option) => void }) {
  const label = BUDGETS.find((b) => b.amount === budget)?.label ?? `Rs ${lakh(budget)}`;
  const best = fit.best;
  const same = (o: Option) => o.areaId === current.areaId && o.unit === current.unit && o.stake === current.stake;
  return (
    <Reveal className="fit">
      {best ? (
        <>
          <p className="fit-lead">
            <b>{label}</b> gets you a <b>{best.stake === 1 ? "full" : "half"} share of a {best.unit} in {findArea(best.areaId)!.name}</b> for Rs {rs(best.quote.yourCapital)}: projected <b className="num">Rs {rs(best.quote.packages.standard.yourMonthly)}</b> a month, capital back in about {months(best.quote.packages.standard.paybackMonths)} months.
          </p>
          {fit.within.length > 1 ? (
            <div className="fit-alts">
              <span>Also within budget:</span>
              {fit.within.slice(1, 6).map((o) => (
                <button key={`${o.areaId}-${o.unit}-${o.stake}`} type="button" className="alt num" aria-pressed={same(o)} onClick={() => onPick(o)}>
                  {findArea(o.areaId)!.name} {o.unit} · {o.stake === 1 ? "full" : "half"} · Rs {rs(o.quote.packages.standard.yourMonthly)}/mo
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="fit-lead">
          Our smallest option is a <b>half share of a {fit.smallest.unit} in {findArea(fit.smallest.areaId)!.name}</b> at Rs {rs(fit.smallest.quote.yourCapital)}, projected <b className="num">Rs {rs(fit.smallest.quote.packages.standard.yourMonthly)}</b> a month. Two people often take one apartment between them; ask us.
        </p>
      )}
    </Reveal>
  );
}

/* ── Segmented toggle (sliding thumb) ───────────────────────────────────── */

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string; disabled?: boolean }[]; onChange: (v: string) => void }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className="seg" role="group" aria-label={label}>
      <span className="thumb" aria-hidden style={{ width: `calc((100% - 10px) / ${options.length})`, transform: `translateX(${idx * 100}%)` }} />
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} disabled={o.disabled} onClick={() => onChange(o.value)} title={o.disabled ? "Not offered here" : undefined}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Results ────────────────────────────────────────────────────────────── */

function Results({ q, pkg, setPkg }: { q: Quote; pkg: PackageId; setPkg: (p: PackageId) => void }) {
  const [open, setOpen] = useState(false);
  const p = q.packages[pkg];
  const scale = Math.max(24, Math.ceil(p.paybackMonths / 6) * 6);
  const ticks = [0, scale / 4, scale / 2, (3 * scale) / 4, scale];
  const profitNights = Math.max(0, p.nights - q.breakevenNights);

  return (
    <div className="panel">
      <p className="lbl">Your monthly share</p>
      <div className="hero-num">
        <span className="rs">Rs</span>
        <Num value={p.yourMonthly} format={rsFmt} />
      </div>
      <p className="hero-sub num">
        Rs <Num value={p.yourYearly} format={rsFmt} startOnView={false} /> a year · <Num value={pct(p.annualReturn)} format={(n) => String(Math.round(n))} startOnView={false} />% annual return
      </p>
      <p className="sel">
        <span className="proj">Projected · {pkgOf(pkg).label} · {p.nights} nights</span>
      </p>

      <div className="pkgs" role="group" aria-label="Occupancy package">
        {PACKAGES.map((pk) => {
          const r = q.packages[pk.id];
          return (
            <button key={pk.id} type="button" className="pkg" aria-pressed={pk.id === pkg} onClick={() => setPkg(pk.id)}>
              <span className="t">
                {pk.label}
                <span className="num">{pk.nights} nights</span>
              </span>
              <span className="m num">
                Rs {rs(r.yourMonthly)}
                <small>/mo</small>
              </span>
              <span className="y num">
                Rs {lakh(r.yourYearly)}/yr · <b>{pct(r.annualReturn)}% return</b> · back in ~{months(r.paybackMonths)} mo
              </span>
            </button>
          );
        })}
      </div>

      <div className="payback">
        <div className="bar" aria-hidden>
          <span className="fill" style={{ width: `${Math.min(100, (p.paybackMonths / scale) * 100)}%` }} />
        </div>
        <div className="bar-ticks num" aria-hidden>
          {ticks.map((t) => (
            <span key={t}>{t === 0 ? "Month 0" : Math.round(t)}</span>
          ))}
        </div>
        <p>
          Your capital back in <b className="num">~{months(p.paybackMonths)} months</b>. Every month after is profit, for as long as the property runs.
        </p>
      </div>

      <div className="breakeven">
        <div className="dots" aria-hidden>
          {Array.from({ length: 30 }, (_, i) => (
            <span key={i} className={`dot ${i < q.breakevenNights ? "cost" : i < p.nights ? "profit" : ""}`} style={{ transitionDelay: `${i * 18}ms` }} />
          ))}
        </div>
        <div className="legend">
          <span><i style={{ background: "var(--sand)" }} />Covers every cost</span>
          <span><i style={{ background: "var(--clay-l)" }} />Profit nights</span>
        </div>
        <p>
          This apartment covers all its costs at just <b className="num">{q.breakevenNights} nights</b> a month. At {p.nights} nights, the other{" "}
          <b className="num">{profitNights}</b> are profit.
        </p>
      </div>

      <div className="disclose" data-open={open}>
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          See the full breakdown <ChevronDown size={18} />
        </button>
        <div className="body">
          <div>
            <div className="rows num">
              <div className="row-head">Every month · {p.nights} nights</div>
              <div className="row"><span>Revenue · {p.nights} × Rs {rs(q.nightly)}</span><span>Rs {rs(p.revenue)}</span></div>
              <div className="row"><span>Rent</span><span>− Rs {rs(q.costs.rent)}</span></div>
              {(Object.keys(COST_LABEL) as (keyof typeof COST_LABEL)[]).map((k) => (
                <div key={k} className="row"><span>{COST_LABEL[k]}</span><span>− Rs {rs(q.costs[k])}</span></div>
              ))}
              <div className="row total"><span>Net profit</span><span>Rs {rs(p.netProfit)}</span></div>
              <div className="row"><span>Investor share · {Math.round(TERMS.investorShare * 100)}%</span><span>Rs {rs(p.investorPool)}</span></div>
              <div className="row"><span>Esker share · {Math.round(TERMS.eskerShare * 100)}%</span><span>Rs {rs(p.eskerPool)}</span></div>
              <div className="row total accent"><span>Your share · {stakeLabel(q.stake)}</span><span>Rs {rs(p.yourMonthly)}</span></div>

              <div className="row-head">What your investment covers</div>
              <div className="row"><span>Advance rent · {TERMS.advanceRentMonths} month</span><span>Rs {rs(q.advanceRent)}</span></div>
              <div className="row">
                <span>
                  Security · {TERMS.securityMonths} months
                  <span className="note">Refundable at lease end</span>
                </span>
                <span>Rs {rs(q.securityDeposit)}</span>
              </div>
              <div className="row"><span>{q.furnishingLabel}</span><span>Rs {rs(q.furnishing)}</span></div>
              <div className="row"><span>Total setup</span><span>Rs {rs(q.upfrontTotal)}</span></div>
              <div className="row total accent"><span>Your investment · {stakeLabel(q.stake)}</span><span>Rs {rs(q.yourCapital)}</span></div>
            </div>
            <p className="panel-foot">
              Rent Rs {rs(q.rent)} (market {q.area.units[q.unit]!.rentRange}). Nightly rate Rs {rs(q.nightly)}
              {q.area.units[q.unit]!.nightlyRange ? ` (range ${q.area.units[q.unit]!.nightlyRange})` : ""}. Company overheads (ads, staff, software) are carried by Esker and never charged to the property.
            </p>
          </div>
        </div>
      </div>
      <p className="panel-foot">Projections, not guarantees. Actual returns depend on how the property performs.</p>
    </div>
  );
}

/* ── Compare (folded under the calculator) ──────────────────────────────── */

function Compare({ onLoad, current }: { onLoad: (areaId: string, unit: UnitType) => void; current: { areaId: string; unit: UnitType } }) {
  const rows = useMemo(() => compareRows("standard"), []);
  const top = rows[0]?.annualReturn ?? 1;
  const [open, setOpen] = useState(false);
  const [ref, inView] = useInView<HTMLDivElement>(0.15);
  return (
    <div className="disclose disclose-light" data-open={open} style={{ marginTop: 40 }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>
          Compare every area <small>Standard package · full share · ranked by projected return</small>
        </span>
        <ChevronDown size={18} />
      </button>
      <div className="body">
        <div>
          <div className="cmp" ref={ref}>
            {rows.map((r, i) => {
              const isCur = r.areaId === current.areaId && r.unit === current.unit;
              return (
                <button key={`${r.areaId}-${r.unit}`} type="button" className="cmp-row" onClick={() => onLoad(r.areaId, r.unit)} aria-current={isCur}>
                  <span className="rk num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="nm">
                    {r.areaName}
                    <small>{r.unit}</small>
                    {isCur ? <small style={{ color: "var(--clay)" }}>· selected</small> : null}
                  </span>
                  <span className="ret num">
                    {pct(r.annualReturn)}%<small>a year</small>
                  </span>
                  <span className="track" aria-hidden>
                    <i style={{ width: inView && open ? `${(r.annualReturn / top) * 100}%` : 0, transitionDelay: `${i * 90}ms` }} />
                  </span>
                  <span className="facts num">
                    <span>Invest <b>Rs {lakh(r.upfront)}</b></span>
                    <span>Monthly <b>Rs {rs(r.monthly)}</b></span>
                    <span>Back in <b>~{months(r.paybackMonths)} mo</b></span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── The one-off: E-11 terrace-pool penthouse ───────────────────────────── */

function Limited() {
  const sp = specialAreas();
  if (!sp.length) return null;
  return (
    <section className="pad limited-sec" id="limited">
      <div className="wrap">
        {sp.map((a) => {
          const unit = unitsOf(a)[0];
          const q = quote({ areaId: a.id, unit, stake: 1 })!;
          const p = q.packages.standard;
          const ph = PHOTOS.find((x) => x.area === a.id) ?? PHOTOS[0];
          const wa = (f: (typeof FOUNDERS)[number]) => `https://wa.me/${f.phone}?text=${encodeURIComponent(`Hi ${f.name}, I'd like to hear about the ${a.name} (the one-investor opportunity).`)}`;
          return (
            <Reveal key={a.id} className="limited">
              <div className="limited-ph arch-soft">
                <Pic k={ph.key} size={1100} />
                <span className="tag">
                  <Sparkles size={13} aria-hidden /> {a.special!.tag}
                </span>
              </div>
              <div className="limited-bd">
                <p className="eyebrow">One opportunity, one investor</p>
                <h2 className="serif h2" style={{ marginTop: 12 }}>
                  {a.name.replace(" Penthouse", "")} <em>Penthouse.</em>
                </h2>
                <p className="lede" style={{ marginTop: 14 }}>{a.special!.blurb}</p>
                <ul className="limited-hl">
                  {a.special!.highlights.map((h) => (
                    <li key={h}>
                      <MapPin size={13} aria-hidden /> {h}
                    </li>
                  ))}
                </ul>
                <div className="limited-nums num">
                  <div>
                    <b>Rs {lakh(q.upfrontTotal)}</b>
                    <span>all-in: {q.furnishingLabel.toLowerCase()}, plus the lease deposit</span>
                  </div>
                  <div>
                    <b>Rs {rs(p.yourMonthly)}</b>
                    <span>projected a month at {p.nights} booked nights</span>
                  </div>
                  <div>
                    <b>~{Math.round(p.paybackMonths)} months</b>
                    <span>to get your capital back</span>
                  </div>
                  <div>
                    <b>{q.breakevenNights} nights</b>
                    <span>a month covers every cost, electricity at Rs {lakh(q.costs.electricity)} for the pool</span>
                  </div>
                </div>
                <div className="limited-btns">
                  {FOUNDERS.map((f) => (
                    <a key={f.name} className="btn btn-clay" href={wa(f)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle size={16} /> Ask {f.name}
                    </a>
                  ))}
                </div>
                <p className="small" style={{ marginTop: 14, color: "var(--mute-d)" }}>
                  First come, first served. Full projection and the breakdown of the Rs {lakh(q.upfrontTotal)} on a call or at the property.
                </p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ── CTA ────────────────────────────────────────────────────────────────── */

function Cta({ q, pkg }: { q: Quote; pkg: PackageId }) {
  const [name, setName] = useState("");
  const p = q.packages[pkg];
  const share = q.stake === 1 ? "100%" : "50%";
  const sheetHref = () => {
    const s = new URLSearchParams({ area: q.area.id, unit: q.unit, stake: q.stake === 1 ? "100" : "50", pkg, name: name.trim() });
    return `/invest/sheet?${s}`;
  };
  const wa = (founder: (typeof FOUNDERS)[number], text: string) => `https://wa.me/${founder.phone}?text=${encodeURIComponent(text)}`;
  const talk = `Hi {name}, I'm interested in a ${share} share of a ${q.unit} in ${q.area.name} (${pkgOf(pkg).label} package).`;

  return (
    <section className="dark pad" id="next">
      <div className="wrap">
        <p className="eyebrow">Next step</p>
        <Reveal>
          <h2 className="serif h2" style={{ marginTop: 16, maxWidth: "12em" }}>
            See it <em>for yourself.</em>
          </h2>
        </Reveal>
        <p className="lede" style={{ marginTop: 14 }}>
          Your selection: <b>{share} share</b> of a <b>{q.unit}</b> in <b>{q.area.name}</b>, {pkgOf(pkg).label} package. Investment <b className="num">Rs {rs(q.yourCapital)}</b>, projected <b className="num">Rs {rs(p.yourMonthly)} a month</b>.
        </p>
        <div className="close-grid">
          <Reveal className="close-card" delay={1}>
            <h4 className="serif">Talk it through</h4>
            <p>A 15-minute call or a WhatsApp chat with either founder. Your selection comes with the message.</p>
            <div className="wa">
              {FOUNDERS.map((f) => (
                <a key={f.name} className="btn btn-clay" href={wa(f, talk.replace("{name}", f.name))} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={17} />
                  <span style={{ textAlign: "left" }}>
                    {f.name}
                    <small className="num">{f.display}</small>
                  </span>
                </a>
              ))}
            </div>
          </Reveal>
          <Reveal className="close-card" delay={2}>
            <h4 className="serif">Visit a property</h4>
            <p>Walk into a live apartment in Islamabad, meet the caretaker and see the standard for yourself. No obligation.</p>
            <a className="btn btn-ghost" href={wa(FOUNDERS[0], "Hi Umais, I'd like to visit one of your properties before deciding.")} target="_blank" rel="noopener noreferrer">
              <MapPin size={17} /> Arrange a visit
            </a>
          </Reveal>
          <Reveal className="close-card" delay={3}>
            <h4 className="serif">Take the numbers with you</h4>
            <p>A one-page sheet of exactly what&apos;s on screen, with your name on it, to print or save.</p>
            <form
              className="field"
              onSubmit={(e) => {
                e.preventDefault();
                window.open(sheetHref(), "_blank", "noopener");
              }}
            >
              <label htmlFor="inv-name">Your name</label>
              <input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="For your personalised sheet" autoComplete="name" required />
              <button type="submit" className="btn btn-ghost" style={{ marginTop: 6 }}>
                <FileText size={17} /> Get the sheet
              </button>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── Mobile sticky summary ──────────────────────────────────────────────── */

function StickySummary({ amount, label, resultsRef }: { amount: number; label: string; resultsRef: React.RefObject<HTMLDivElement | null> }) {
  const [pastHero, setPastHero] = useState(false);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("top");
    const cta = document.getElementById("next");
    const res = resultsRef.current;
    if (!hero || !res || !cta || typeof IntersectionObserver === "undefined") return;
    const a = new IntersectionObserver(([e]) => setPastHero(!e.isIntersecting), { threshold: 0 });
    const b = new IntersectionObserver(([e]) => setResultsVisible(e.isIntersecting), { threshold: 0.15 });
    // The closing section already states the selection — the bar would only cover it.
    const c = new IntersectionObserver(([e]) => setCtaVisible(e.isIntersecting), { threshold: 0 });
    a.observe(hero);
    b.observe(res);
    c.observe(cta);
    return () => {
      a.disconnect();
      b.disconnect();
      c.disconnect();
    };
  }, [resultsRef]);
  const show = pastHero && !resultsVisible && !ctaVisible;
  return (
    <div className={`sticky-sum ${show ? "show" : ""}`} aria-hidden={!show}>
      <div style={{ minWidth: 0 }}>
        <div className="v num">Rs {rs(amount)} / mo</div>
        <div className="d">{label} · projected</div>
      </div>
      <button type="button" className="btn btn-clay go" onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
        See it
      </button>
    </div>
  );
}
