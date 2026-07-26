import Link from "next/link";
import { Phone, Mail, MessageCircle, MapPin, Clock } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { EskerLogo } from "@/components/EskerLogo";
import { getAccount } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { company, addressOneLine } from "@/lib/contact";
import { support } from "@/lib/payments";

export const metadata = {
  title: "Contact Esker — phone, WhatsApp, email & office address",
  description:
    "Reach Esker Rentals: call or WhatsApp +92 332 5977626, email admin@eskerrentals.com. Guest support 24/7. Registered office in DHA Phase 5, Islamabad.",
};

// Public contact page. Also carries the verifiable local address + callable
// number that payment gateways require to be visible on the site.
export default async function ContactPage() {
  const account = await getAccount();

  // Pretty-printed for display; the tel: link uses the raw E.164 value.
  const phoneDisplay = "+92 332 5977626";

  return (
    <main className="min-h-full">
      <SiteNav theme="light" account={account} />

      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Contact us</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Questions about a stay, a booking, or a payment? Our guest support runs{" "}
          <strong className="text-ink">24/7</strong> — call or WhatsApp and a real person will
          answer, usually within minutes.
        </p>

        {/* Primary contact methods */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a
            href={`tel:${company.phone}`}
            className="group rounded-2xl border border-line bg-surface p-5 transition hover:border-line-hi hover:shadow-sm"
          >
            <Phone size={18} className="text-gold" />
            <div className="mt-3 text-sm font-medium text-ink">Call us</div>
            <div className="mt-1 text-[15px] text-muted tnum group-hover:text-ink">
              {phoneDisplay}
            </div>
            <div className="mt-1 text-xs text-dim">{company.hours}</div>
          </a>

          <a
            href={`https://wa.me/${company.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl border border-line bg-surface p-5 transition hover:border-line-hi hover:shadow-sm"
          >
            <MessageCircle size={18} className="text-gold" />
            <div className="mt-3 text-sm font-medium text-ink">WhatsApp</div>
            <div className="mt-1 text-[15px] text-muted tnum group-hover:text-ink">
              {phoneDisplay}
            </div>
            <div className="mt-1 text-xs text-dim">Fastest way to reach us</div>
          </a>

          <a
            href={`mailto:${support.email}`}
            className="group rounded-2xl border border-line bg-surface p-5 transition hover:border-line-hi hover:shadow-sm"
          >
            <Mail size={18} className="text-gold" />
            <div className="mt-3 text-sm font-medium text-ink">Email</div>
            <div className="mt-1 text-[15px] text-muted group-hover:text-ink">{support.email}</div>
            <div className="mt-1 text-xs text-dim">We reply the same day</div>
          </a>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <Clock size={18} className="text-gold" />
            <div className="mt-3 text-sm font-medium text-ink">Check-in &amp; check-out</div>
            <div className="mt-1 text-[15px] text-muted tnum">
              {company.checkIn} / {company.checkOut}
            </div>
            <div className="mt-1 text-xs text-dim">
              Varies by property — please confirm for your stay
            </div>
          </div>
        </div>

        {/* Registered address — deliberately framed so no guest turns up here */}
        <div className="mt-8 rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-start gap-3">
            <MapPin size={18} className="mt-0.5 shrink-0 text-gold" />
            <div>
              <div className="text-sm font-medium text-ink">Registered office</div>
              <address className="mt-1 text-[15px] not-italic leading-relaxed text-muted">
                {company.legalName}
                <br />
                {company.address.line1}
                <br />
                {company.address.line2}
                <br />
                {company.address.city}, {company.address.country}
              </address>
              <p className="mt-3 rounded-lg bg-bg/50 px-3 py-2 text-xs leading-relaxed text-dim">
                This is our registered address for correspondence and business matters only —{" "}
                <strong className="text-muted">it is not a guest check-in location</strong>. Every
                stay takes place at its own property, and you receive that address with your
                check-in details the day before arrival. Please don&apos;t visit without arranging
                it with us first.
              </p>
            </div>
          </div>
        </div>

        {/* Service area */}
        <div className="mt-8">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
            Where we operate
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            We manage premium short-stay properties across{" "}
            <strong className="text-ink">{brand.launchCities.join(" and ")}</strong>, with{" "}
            {brand.expansionNote}.{" "}
            <Link href="/stays" className="text-gold-deep underline hover:no-underline">
              Browse all stays
            </Link>
            .
          </p>
        </div>

        {/* Policies */}
        <div className="mt-8 border-t border-line pt-6">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
            Policies
          </h2>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/legal/terms" className="text-gold-deep underline hover:no-underline">
              Terms of Service
            </Link>
            <Link href="/legal/privacy" className="text-gold-deep underline hover:no-underline">
              Privacy Policy
            </Link>
            <Link href="/legal/cancellation" className="text-gold-deep underline hover:no-underline">
              Cancellation &amp; Refund Policy
            </Link>
            <Link
              href="/legal/service-delivery"
              className="text-gold-deep underline hover:no-underline"
            >
              Service Delivery Policy
            </Link>
          </div>
        </div>
      </div>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-3xl px-6 py-8 text-sm text-muted">
          <EskerLogo className="text-ink" />
          <p className="mt-2 text-xs text-dim">
            {company.legalName} · {addressOneLine}
          </p>
        </div>
      </footer>
    </main>
  );
}
