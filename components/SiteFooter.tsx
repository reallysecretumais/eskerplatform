import Link from "next/link";
import { brand } from "@/lib/brand";
import { company } from "@/lib/contact";
import { guestPaymentMethods } from "@/lib/payments";
import { isSafepayConfigured } from "@/lib/safepay";
import { EskerLogo } from "@/components/EskerLogo";

// The site footer, from the Website board: the lockup and the brand line, the
// STAYS and HELP columns, and a bottom line of live cities and the payment
// methods that actually work. One footer for every public page, so the legal
// links (which payment gateways require to be visible) can never go missing
// from one of them.
//
// The registered address is deliberately NOT here: it lives on /contact only
// (founder's correction, ce3e421).

const col = "flex flex-col gap-3";
const head = "label text-[11px] text-ash-label";
const link = "text-warm transition-colors hover:text-ice";

export function SiteFooter({
  cities = [],
  categories = [],
}: {
  /** Cities with live stays, in market order (lib/geo liveCities). */
  cities?: string[];
  /** Categories with live stays, for quick links (plural labels). */
  categories?: string[];
}) {
  return (
    <footer className="bg-ink text-warm">
      <div className="mx-auto flex max-w-[1248px] flex-col gap-11 px-5 pb-10 pt-16 sm:px-6">
        <div className="flex flex-wrap justify-between gap-10">
          <div className="flex max-w-[420px] flex-col gap-[18px]">
            <EskerLogo size="footer" />
            <p className="headline text-[26px] leading-[1.05] tracking-[-0.015em]">
              Premium short stays, <span className="text-ice">beautifully managed.</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-x-14 gap-y-8 text-[15px]">
            <div className={col}>
              <span className={head}>Stays</span>
              <Link href="/stays" className={link}>Browse all</Link>
              <Link href="/stays?tier=exclusive" className={link}>{brand.exclusiveTier}</Link>
              {categories.slice(0, 3).map((c) => (
                <Link key={c} href={`/stays?category=${encodeURIComponent(c)}`} className={link}>
                  {c}
                </Link>
              ))}
            </div>
            <div className={col}>
              <span className={head}>Help</span>
              <a href={`https://wa.me/${company.whatsapp}`} target="_blank" rel="noopener noreferrer" className={link}>
                WhatsApp <span className="tnum">{company.phoneDisplay}</span>
              </a>
              <Link href="/contact" className={link}>Contact</Link>
              <Link href="/host" className={link}>For property owners</Link>
            </div>
            <div className={col}>
              <span className={head}>Policies</span>
              <Link href="/legal/cancellation" className={link}>Cancellation &amp; refunds</Link>
              <Link href="/legal/terms" className={link}>Terms</Link>
              <Link href="/legal/privacy" className={link}>Privacy</Link>
              <Link href="/legal/service-delivery" className={link}>Service delivery</Link>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-4 pt-[22px] text-[13px] text-ash-label shadow-[0_-1px_0_var(--color-dark-line)]">
          <span>{(cities.length ? cities : brand.launchCities).join(" · ")}</span>
          <span>{guestPaymentMethods(isSafepayConfigured()).join(" · ")}</span>
        </div>
      </div>
    </footer>
  );
}
