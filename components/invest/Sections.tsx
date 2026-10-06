import {
  Search, Handshake, Sofa, Camera, Megaphone, CalendarCheck, IdCard, Sparkles, PhoneCall, Wrench, Check,
} from "lucide-react";
import { PORTFOLIO, PROOF, TERMS, DISCLAIMER } from "@/lib/invest/config";
import { rs } from "@/lib/invest/calc";
import { Num, Reveal } from "./motion";

/* ── The model in one sentence, then four steps ─────────────────────────── */

const SENTENCE: { t: string; em?: boolean }[] = [
  { t: "You fund the setup. Esker finds, furnishes and runs the apartment. It's live in 30 days, and you get " },
  { t: "70% of the net profit", em: true },
  { t: " every month." },
];

export function Model() {
  return (
    <section className="bone pad">
      <div className="wrap">
        <p className="eyebrow">The model</p>
        <Sentence />
        <div className="steps">
          {[
            ["You invest", "In a 1BHK or 2BHK, as a full or half share."],
            ["We secure it", "In a handpicked building, on a 2–3 year renewable lease held by Esker."],
            ["We furnish it", "To the Esker standard: jacuzzi, PS4, projector, statement interiors. Live in 30 days."],
            ["You earn", "70% of the net profit, every month, with a full itemised report."],
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

/* ── What you own ───────────────────────────────────────────────────────── */

export function Own() {
  return (
    <section className="dark pad">
      <div className="wrap">
        <p className="eyebrow">What you own</p>
        <Reveal>
          <h2 className="serif h2" style={{ marginTop: 16, maxWidth: "14em" }}>
            This isn&apos;t a promise on paper. <em>It&apos;s furniture, fittings and an apartment that earns.</em>
          </h2>
        </Reveal>
        <div className="own-grid">
          {[
            ["A real asset", "Your investment buys real furniture and fittings in a real apartment. If you ever exit, you receive your share of it."],
            ["A lease we carry", "The tenancy is in Esker's name, on strict owner terms. You carry no landlord or tenant exposure."],
            ["A report every month", "Revenue, every expense itemised, net profit and your share. An actual report, not a WhatsApp message."],
          ].map(([h, p], i) => (
            <Reveal key={h} delay={(i + 1) as 1 | 2 | 3} className="own-item">
              <h4 className="serif">{h}</h4>
              <p>{p}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── What Esker handles ─────────────────────────────────────────────────── */

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

export function Handles() {
  return (
    <section className="pad">
      <div className="wrap">
        <p className="eyebrow">What Esker handles</p>
        <Reveal>
          <h2 className="serif h2" style={{ marginTop: 16 }}>Everything.</h2>
        </Reveal>
        <div className="handles">
          {HANDLES.map(([Icon, label], i) => (
            <Reveal key={label} delay={(i % 5) as 0 | 1 | 2 | 3 | 4} className="handle">
              <Icon size={22} strokeWidth={1.3} aria-hidden />
              <span>{label}</span>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className="serif your-part">
            Your part: invest, and <em>read your monthly report.</em>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Proof ──────────────────────────────────────────────────────────────── */

export function Proof({ photos }: { photos: (string | null)[] }) {
  return (
    <section className="dark-2 pad dark">
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
              <b>
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
              <div className="ph">{photos[i] ? <img className="cover" src={photos[i]!} alt={p.name} loading="lazy" decoding="async" /> : null}</div>
              <div className="bd">
                <div className="hd">
                  <span>Monthly statement</span>
                  <span className="num">{p.month}</span>
                </div>
                <h4 className="serif">{p.name}</h4>
                <p className="sub">{p.sub}</p>
                <div className="rev">
                  <span className="lbl">Revenue in one month</span>
                  <b>
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

/* ── Terms at a glance ──────────────────────────────────────────────────── */

export function Terms() {
  const pct = (r: number) => `${Math.round(r * 100)}%`;
  const rows: [string, string][] = [
    ["Your share", `${pct(TERMS.investorShare)} of net profit, every month`],
    ["Esker's share", `${pct(TERMS.eskerShare)} of net profit`],
    ["Stake", "50% or 100% of a single 1BHK or 2BHK"],
    ["Upfront lease cost", `${TERMS.advanceRentMonths} month's rent + ${TERMS.securityMonths} months' security`],
    ["Launch", `Live within ${TERMS.launchDays} days`],
    ["Lease", `${TERMS.leaseYears}, held by Esker on strict owner terms`],
    ["Exit", `${TERMS.exitNoticeDays} days' notice. You receive your share of the furniture`],
    ["Reporting", "Monthly, every expense itemised"],
    ["Buildings", "Handpicked only. We operate only in buildings we've vetted"],
    ["Company overheads", "Ads, staff and software are carried by Esker, never charged to the property"],
  ];
  return (
    <section className="pad">
      <div className="wrap">
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
    </section>
  );
}

export function Footer() {
  return (
    <footer className="dark foot">
      <div className="wrap">
        <p>{DISCLAIMER}</p>
      </div>
    </footer>
  );
}
