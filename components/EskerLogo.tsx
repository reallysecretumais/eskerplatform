// The Esker Rentals lockup: the open frame, ESKER, RENTALS — drawn as geometry,
// never retyped text, so it never depends on a font having loaded.
//
// ⚠️ SANCTIONED COPY of `esker-platform-app/src/brand/logoGeometry.ts` (itself
// generated from the founder's canvas by that repo's scripts/build-logo.py).
// The two apps ship separately and share no code; if the mark ever changes,
// regenerate there and paste the paths here.
//
// Monochrome via `currentColor`: warm white on black or Esker Blue, black or
// Esker Blue on warm white (BUILD_REFERENCE "Logo"). Stroke weights are the
// board's own optical sizes — a mark drawn small needs heavier strokes.

const WORD = [
  { d: "M170 219.5 H104 C52 219.5 18.5 262 18.5 315.5 C18.5 369 52 411.5 104 411.5 H170", bar: false },
  { d: "M48 318 H136", bar: true },
  { d: "M346 219.5 H262 C228 219.5 203.5 240 203.5 268 C203.5 298 236 316 276 333 C314 349 331 370 331 395 V426", bar: false },
  { d: "M402.5 205 V426", bar: false },
  { d: "M614 219.5 H545 C522 219.5 506 228 492 243 L442 297 C437 302 435 307 435 313 V327 C435 333 437 338 442 343 L492 397 C506 412 522 411.5 545 411.5 H614", bar: false },
  { d: "M492 318 H585", bar: true },
  { d: "M681 205 V426", bar: false },
  { d: "M681 219.5 H738 C772 219.5 790 245 790 273 C790 302 768 322 735 322 H709", bar: false },
  { d: "M750 331 L805 426", bar: false },
] as const;

const RENTALS =
  "M173.02 532V470.08H198.05Q198.95 470.08 200.28 470.14Q201.62 470.21 202.82 470.42Q207.98 471.24 211.44 473.95Q214.9 476.66 216.62 480.79Q218.34 484.92 218.34 489.9Q218.34 497.3 214.56 502.65Q210.77 508.01 203.21 509.34L199.55 509.77H182.01V532ZM209.23 532 197.01 506.8 206.09 504.48 219.5 532ZM182.01 501.25H197.7Q198.56 501.25 199.62 501.17Q200.67 501.08 201.62 500.87Q204.37 500.22 206.04 498.48Q207.72 496.74 208.45 494.46Q209.18 492.18 209.18 489.9Q209.18 487.62 208.45 485.37Q207.72 483.11 206.04 481.37Q204.37 479.63 201.62 478.98Q200.67 478.72 199.62 478.64Q198.56 478.55 197.7 478.55H182.01ZM243.31 532V470.08H282.87V478.55H252.3V495.92H277.71V504.39H252.3V523.53H282.87V532ZM307.54 532V470.08H316.65L347.14 516.09V470.08H356.25V532H347.14L316.65 485.95V532ZM398.07 532V478.55H377.48V470.08H427.66V478.55H407.06V532ZM442.86 532 462.99 470.08H475.93L496.05 532H486.72L468.19 475.5H470.51L452.19 532ZM453.31 518.02V509.6H485.65V518.02ZM519 532V470.08H527.98V523.53H556.02V532ZM600.12 533.29Q593.46 533.29 588.1 530.99Q582.75 528.69 579.29 524.41Q575.83 520.13 574.79 514.24L584.17 512.82Q585.59 518.5 590.1 521.66Q594.62 524.82 600.64 524.82Q604.38 524.82 607.52 523.64Q610.66 522.45 612.57 520.24Q614.48 518.02 614.48 514.93Q614.48 513.25 613.9 511.96Q613.32 510.67 612.31 509.7Q611.3 508.74 609.86 508.03Q608.42 507.32 606.7 506.8L590.83 502.12Q588.51 501.43 586.1 500.33Q583.7 499.23 581.7 497.45Q579.7 495.67 578.45 493.02Q577.2 490.38 577.2 486.59Q577.2 480.87 580.15 476.9Q583.09 472.92 588.12 470.88Q593.16 468.83 599.39 468.83Q605.67 468.92 610.64 471.07Q615.6 473.22 618.89 477.24Q622.18 481.26 623.43 486.98L613.8 488.61Q613.15 485.13 611.04 482.61Q608.94 480.1 605.88 478.74Q602.83 477.39 599.26 477.35Q595.82 477.26 592.96 478.38Q590.1 479.5 588.4 481.52Q586.71 483.54 586.71 486.16Q586.71 488.74 588.21 490.33Q589.72 491.92 591.93 492.85Q594.14 493.77 596.34 494.38L607.78 497.6Q609.93 498.2 612.66 499.21Q615.39 500.22 617.95 502.03Q620.5 503.83 622.18 506.82Q623.86 509.81 623.86 514.33Q623.86 519.01 621.97 522.56Q620.07 526.11 616.78 528.5Q613.49 530.88 609.19 532.09Q604.89 533.29 600.12 533.29Z";

const FRAME = "M57 152 V16 H776 V152 M776 466 V658 H57 V466";
const RULE = "M110 139 H712";

/** The board's sizes: nav 70px wide, footer 84px. Below 64px the spec says use the E-mark. */
const SIZES = {
  nav: { width: 70, stem: 31, bar: 21, frame: 20, rule: 10 },
  footer: { width: 84, stem: 30, bar: 20, frame: 18, rule: 9 },
} as const;

export function EskerLogo({ size = "nav", className = "" }: { size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  return (
    <svg
      viewBox="0 0 823 673"
      width={s.width}
      height={Math.round((s.width * 673) / 823)}
      fill="none"
      stroke="currentColor"
      role="img"
      aria-label="Esker Rentals"
      className={`block shrink-0 ${className}`}
    >
      <path d={FRAME} strokeWidth={s.frame} />
      <path d={RULE} strokeWidth={s.rule} />
      {WORD.map((p) => (
        <path key={p.d} d={p.d} strokeWidth={p.bar ? s.bar : s.stem} />
      ))}
      <path d={RENTALS} fill="currentColor" stroke="none" />
    </svg>
  );
}
