import type { ReactNode } from "react";
import { Search, Handshake, Sofa, Camera, Megaphone, CalendarCheck, IdCard, Sparkles, PhoneCall, Wrench, Check, ShieldCheck, Building2, Landmark, FileSignature, AtSign, Activity, Plus } from "lucide-react";
import { PORTFOLIO, PROOF, TERMS, DISCLAIMER, PHOTOS, VERIFY, FAQ, COMPANY, FOUNDERS, type Photo } from "@/lib/invest/config";
import { rs } from "@/lib/invest/calc";
import { Num, Reveal } from "./motion";

/* ── Photos ─────────────────────────────────────────────────────────────── */

export function photo(key: string): Photo {
  return PHOTOS.find((p) => p.key === key) ?? PHOTOS[0];
}

/** A resized copy from the storage transform endpoint — both edges bounded,
 *  aspect preserved (the width-only trap is documented in lib/img.ts). */
export function sized(url: string, size: number, quality = 72): string {
  return url.replace("/object/public/", "/render/image/public/") + `?width=${size}&height=${size}&quality=${quality}&resize=contain`;
}

export function Pic({ k, size = 900, className = "", eager = false }: { k: string; size?: number; className?: string; eager?: boolean }) {
  const p = photo(k);
  return <img src={sized(p.url, size)} alt={p.alt} className={className} loading={eager ? "eager" : "lazy"} decoding="async" />;
}

/* ── The story: why this exists, and why now ─────────────────────────────── */

export function Story() {
  return (
    <section className="pad story" id="story">
      <div className="wrap">
        <div className="story-grid">
          <div>
            <p className="eyebrow">Why this exists</p>
            <Reveal>
              <h2 className="serif h2" style={{ marginTop: 16 }}>
                Three years of running them. <em>Now open to you.</em>
              </h2>
            </Reveal>
            <Reveal delay={1}>
              <p className="lede" style={{ marginTop: 18 }}>
                Short-stay apartments earn far more than a regular rental. Running one well is a full-time job: finding the right building, furnishing it to a standard guests pay for, then the bookings, the cleaning, the late calls, the repairs.
              </p>
            </Reveal>
            <Reveal delay={2}>
              <p className="lede" style={{ marginTop: 14 }}>
                We built the operation that does that job. Twenty-five properties across Islamabad and Rawalpindi, our own cleaners, photographers, ad team, booking desk and guest managers, and a system we wrote ourselves to run it all. Until now, a closed circle of investors has earned from it every month. <b>This is the first time we&apos;re opening it to the public.</b>
              </p>
            </Reveal>
          </div>
          <div className="story-pics" aria-hidden>
            <Reveal className="sp sp-1"><Pic k="b17-pool" size={700} /></Reveal>
            <Reveal className="sp sp-2" delay={1}><Pic k="studio-jacuzzi" size={600} /></Reveal>
            <Reveal className="sp sp-3" delay={2}><Pic k="e11-cinema" size={600} /></Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── The model in one sentence, then four steps ─────────────────────────── */

const SENTENCE: { t: string; em?: boolean }[] = [
  { t: "You fund the setup. We find, furnish and run the apartment. It's live in 30 days, and " },
  { t: "70% of the net profit", em: true },
  { t: " is yours, every month." },
];

export function Model() {
  return (
    <section className="bone pad" id="model">
      <div className="wrap">
        <p className="eyebrow">The model</p>
        <Sentence />
        <div className="steps">
          {[
            ["You invest", "In a one- or two-bedroom apartment, as a full or half share. From Rs 4.6 lakh."],
            ["We secure it", "In a building we've vetted, on a 2–3 year renewable lease held by Esker."],
            ["We furnish it", "To the Esker standard: jacuzzi, projector, console, statement interiors. Live in 30 days."],
            ["You earn", "70% of the net profit, every month, with a report that itemises every rupee."],
          ].map(([h, p], i) => (
            <Reveal key={h} delay={(i % 4) as 0 | 1 | 2 | 3} className="step">
              <div className="step-arch" aria-hidden>
                <svg viewBox="0 0 52 64">
                  <path d="M1 64 V26 A25 25 0 0 1 51 26 V64" />
                </svg>
                <b className="num">{String(i + 1).padStart(2, "0")}</b>
              </div>
              <div>
                <h3 className="serif">{h}</h3>
                <p>{p}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="split">
          <div className="split-big num">
            70<span>/</span>30
            <small>You / Esker</small>
          </div>
          <p>
            The setup — furnishing, fittings and the lease deposit — is <b>owned 70% by you and 30% by Esker</b>, and the profit is split the same way. We are co-owners of every apartment we run for an investor, so <b>we only do well when you do.</b>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/** Each word brightens in turn as the sentence scrolls into view. */
function Sentence() {
  let i = 0;
  return (
    <Reveal className="sentence-wrap">
      <p className="serif sentence" style={{ marginTop: 18 }}>
        {SENTENCE.flatMap((part, pi) =>
          part.t.split(/(\s+)/).filter(Boolean).map((w, wi) => {
            const delay = `${(i++ * 0.035).toFixed(3)}s`;
            return /^\s+$/.test(w) ? (
              w
            ) : (
              <span key={`${pi}-${wi}`} className="w" style={{ transitionDelay: delay }}>
                {part.em ? <em>{w}</em> : w}
              </span>
            );
          }),
        )}
      </p>
    </Reveal>
  );
}

/* ── How your money is protected (what you own + what we carry) ─────────── */

const HANDLES = [
  [Search, "Finding the property"],
  [Handshake, "Negotiating the lease"],
  [Sofa, "Furnishing and design"],
  [Camera, "Professional shoot"],
  [Megaphone, "Marketing and ads"],
  [CalendarCheck, "Every booking"],
  [IdCard, "Guest ID verification"],
  [Sparkles, "Cleaning after every stay"],
  [PhoneCall, "The 2am calls"],
  [Wrench, "Maintenance and repairs"],
] as const;

export function Protected() {
  return (
    <section className="dark pad" id="protected">
      <div className="wrap">
        <p className="eyebrow">What you own</p>
        <Reveal>
          <h2 className="serif h2" style={{ marginTop: 16, maxWidth: "14em" }}>
            Not a promise on paper. <em>Furniture, fittings and an apartment that earns.</em>
          </h2>
        </Reveal>
        <div className="own-grid">
          {[
            ["A real asset", "Your money buys real furniture and fittings in a real apartment, co-owned 70/30. If you ever exit, you receive your share of it."],
            ["A lease we carry", "The tenancy is in Esker's name, on strict owner terms. You carry no landlord or tenant exposure."],
            ["A report every month", "Revenue, every expense itemised, net profit and your share. An actual report, not a WhatsApp message."],
          ].map(([h, p], i) => (
            <Reveal key={h} delay={(i + 1) as 1 | 2 | 3} className="own-item">
              <h4 className="serif">{h}</h4>
              <p>{p}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className="handles-row">
          <p className="handles-lead">
            Your part is to invest and read your report. <em className="clay">Ours is everything else:</em>
          </p>
          <ul className="handles-chips">
            {HANDLES.map(([Icon, label]) => (
              <li key={label}>
                <Icon size={14} strokeWidth={1.6} aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Proof ──────────────────────────────────────────────────────────────── */

export function Proof() {
  return (
    <section className="pad proof" id="proof">
      <div className="wrap">
        <p className="eyebrow">Proof</p>
        <Reveal>
          <h2 className="serif h2" style={{ marginTop: 16, maxWidth: "13em" }}>
            We don&apos;t list properties. <em>We run them.</em>
          </h2>
        </Reveal>
        <div className="facts4">
          {PORTFOLIO.map((f) => (
            <div key={f.label}>
              <b className="num">
                {"prefix" in f ? f.prefix : ""}
                <Num value={f.value} format={(n) => String(Math.round(n))} duration={1400} />
                {f.suffix}
              </b>
              <span className="lbl">{f.label}</span>
            </div>
          ))}
        </div>

        <div className="stmts">
          {PROOF.map((p, i) => (
            <Reveal key={p.name} delay={(i + 1) as 1 | 2} className="stmt">
              <div className="ph">
                <Pic k={p.photo} size={900} />
                <span className="place">{p.place}</span>
              </div>
              <div className="bd">
                <div className="hd">
                  <span>Monthly statement</span>
                  <span className="num">{p.month}</span>
                </div>
                <h4 className="serif">{p.name}</h4>
                <p className="sub">{p.sub}</p>
                <div className="rev">
                  <span className="lbl">Revenue in one month</span>
                  <b className="num">
                    Rs <Num value={p.revenue} format={rs} duration={1600} />
                  </b>
                </div>
                <ul>
                  {p.lines.map((l) => (
                    <li key={l}>
                      <Check size={15} strokeWidth={2} aria-hidden />
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
                <span className="stamp">Real figures · our records</span>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="small" style={{ marginTop: 22 }}>
          Figures from our own operating records for the month stated. Ask us to walk you through the full report.
        </p>
      </div>
    </section>
  );
}

/* ── Check us yourself ──────────────────────────────────────────────────── */

const VERIFY_ICONS = [Building2, Landmark, ShieldCheck, FileSignature, AtSign, Activity] as const;

export function Verify({ pulseSlot }: { pulseSlot: ReactNode }) {
  return (
    <section className="bone pad" id="verify">
      <div className="wrap">
        <p className="eyebrow">Check us yourself</p>
        <Reveal>
          <h2 className="serif h2" style={{ marginTop: 16, maxWidth: "13em" }}>
            Don&apos;t take our word for it. <em>Check.</em>
          </h2>
        </Reveal>
        <p className="lede" style={{ marginTop: 14 }}>
          You&apos;re about to trust a company with real money. Here is how to make sure it&apos;s real, before you do.
        </p>
        <div className="verify">
          {VERIFY.map((v, i) => {
            const Icon = VERIFY_ICONS[i % VERIFY_ICONS.length];
            return (
              <Reveal key={v.title} delay={(i % 3) as 0 | 1 | 2} className="vf">
                <Icon size={20} strokeWidth={1.4} aria-hidden />
                <h4 className="serif">{v.title}</h4>
                <p>{v.body}</p>
                {v.title === "Three years in public" ? (
                  <a className="vf-link" href={COMPANY.instagram.url} target="_blank" rel="noopener noreferrer">
                    @{COMPANY.instagram.handle} on Instagram
                  </a>
                ) : null}
              </Reveal>
            );
          })}
        </div>
        <Reveal className="pulse" as="div">
          <div className="pulse-head">
            <span className="dot-live" aria-hidden />
            <span>Esker OS · read live</span>
            <span className="num pulse-time">{new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" })} PKT</span>
          </div>
          {pulseSlot}
          <p className="pulse-foot">Two numbers read from the system that runs every booking and every guest conversation. They change every time you look. Nothing identifying anyone is ever shown.</p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── The people ─────────────────────────────────────────────────────────── */

export function People() {
  return (
    <section className="pad people" id="people">
      <div className="wrap">
        <p className="eyebrow">Who you&apos;re dealing with</p>
        <Reveal>
          <h2 className="serif h2" style={{ marginTop: 16, maxWidth: "12em" }}>
            Two founders. <em>Both on WhatsApp.</em>
          </h2>
        </Reveal>
        <div className="people-grid">
          {FOUNDERS.map((f, i) => (
            <Reveal key={f.name} delay={(i + 1) as 1 | 2} className="person">
              <div className="person-arch" aria-hidden>
                <span className="serif">{f.name[0]}</span>
              </div>
              <div>
                <h4 className="serif">{f.name}</h4>
                <p className="role">{f.role}</p>
                <p>{f.line}</p>
                <a className="person-wa" href={`https://wa.me/${f.phone}`} target="_blank" rel="noopener noreferrer">
                  <span className="num">{f.display}</span>
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Terms + the questions investors ask ────────────────────────────────── */

export function Terms() {
  const pct = (r: number) => `${Math.round(r * 100)}%`;
  const rows: [string, string][] = [
    ["Ownership", `${pct(TERMS.investorShare)} you · ${pct(TERMS.eskerShare)} Esker, of the setup and of the profit`],
    ["Your share", `${pct(TERMS.investorShare)} of net profit, paid every month`],
    ["Stake", "50% or 100% of a single 1BHK or 2BHK"],
    ["Upfront lease cost", `${TERMS.advanceRentMonths} month's rent + ${TERMS.securityMonths} months' security (refundable at lease end)`],
    ["Launch", `Live within ${TERMS.launchDays} days of funding`],
    ["Lease", `${TERMS.leaseYears}, held by Esker on strict owner terms`],
    ["Exit", `${TERMS.exitNoticeDays} days' notice. You receive your share of the furniture and fittings`],
    ["Reporting", "Monthly, every expense itemised"],
    ["Buildings", "Handpicked only. We operate only in buildings we've vetted"],
    ["Company overheads", "Ads, staff and software are carried by Esker, never charged to the property"],
  ];
  return (
    <section className="pad terms-sec" id="terms">
      <div className="wrap">
        <div className="terms-grid">
          <div>
            <p className="eyebrow">Terms at a glance</p>
            <Reveal>
              <h2 className="serif h2" style={{ marginTop: 16 }}>
                Simple, and <em>written down.</em>
              </h2>
            </Reveal>
            <div className="terms">
              {rows.map(([k, v]) => (
                <div key={k} className="term">
                  <span>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow">The questions investors ask</p>
            <Reveal>
              <h2 className="serif h2" style={{ marginTop: 16 }}>
                Asked before. <em>Answered here.</em>
              </h2>
            </Reveal>
            <div className="faq">
              {FAQ.map((f) => (
                <details key={f.q} className="faq-item">
                  <summary>
                    <span>{f.q}</span>
                    <Plus size={18} aria-hidden />
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="dark foot">
      <div className="wrap">
        <p>{DISCLAIMER}</p>
        <p className="foot-co">
          Esker Rentals · NTN {COMPANY.ntn} · {COMPANY.office} · {COMPANY.website.replace("https://", "")}
        </p>
      </div>
    </footer>
  );
}
