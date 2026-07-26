import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { company } from "@/lib/contact";
import { support } from "@/lib/payments";

export const metadata = {
  title: "Service Delivery Policy — Esker Stays",
  description:
    "How and when Esker delivers your booking: confirmation, invoice, check-in details, and check-in/check-out times.",
};

// The "shipping policy" equivalent for a service business. Payment gateways
// require a page that states plainly WHAT the customer receives and WHEN, since
// nothing is physically shipped.
export default function ServiceDeliveryPolicy() {
  return (
    <LegalPage title="Service Delivery Policy" updated="26 July 2026">
      <p>
        Esker provides short-stay accommodation — a service, not a physical product. Nothing is
        shipped or posted to you. This page explains exactly what you receive when you book, and
        when you receive it.
      </p>

      <h2>What you are buying</h2>
      <p>
        A stay at a specific property, for specific dates, at the nightly rate shown at the time of
        booking. Each listing states what is included. Some stays are managed directly by Esker
        (marked <strong>Esker Exclusive</strong>); others are properties we manage or represent on
        behalf of their owners. Either way, your booking is with Esker.
      </p>

      <h2>How your booking is delivered</h2>
      <ul>
        <li>
          <strong>Immediately after you pay your advance</strong> — you receive your booking
          confirmation and invoice by email and WhatsApp. This is your proof of booking.
        </li>
        <li>
          <strong>Once our team verifies your payment</strong> — your booking moves from
          &ldquo;requested&rdquo; to <strong>confirmed</strong>. Verification is usually within
          minutes during the day. If we cannot verify your payment, we contact you and nothing is
          charged.
        </li>
        <li>
          <strong>The day before your arrival</strong> — we send your check-in details: the exact
          address, directions, the caretaker&apos;s contact number, and access instructions.
        </li>
        <li>
          <strong>On arrival</strong> — the property caretaker meets you and hands over the
          property.
        </li>
      </ul>
      <p>
        We deliberately send the full address and access details the day before arrival rather than
        at the time of booking, for the security of the property and of guests already staying.
      </p>

      <h2>Check-in and check-out times</h2>
      <p>
        Standard check-in is <strong>{company.checkIn}</strong> and check-out is{" "}
        <strong>{company.checkOut}</strong>. These vary by property, so{" "}
        <strong>please confirm the times for your specific stay with us</strong> when you book —
        they are stated in your confirmation. Early check-in or late check-out is often possible on
        request, subject to availability.
      </p>

      <h2>Service area</h2>
      <p>
        We currently operate in <strong>Islamabad and Rawalpindi, Pakistan</strong>, with more
        cities being added. Every stay takes place at the property you booked. Our registered
        office is a correspondence address only — guests do not check in there.
      </p>

      <h2>Payment for your stay</h2>
      <p>
        You pay an advance to secure the booking (25% of the total for standard stays, 50% for Esker
        Exclusive), and the balance at or before check-in. Full terms are in our{" "}
        <Link href="/legal/terms" className="text-gold-deep underline hover:no-underline">
          Terms of Service
        </Link>
        .
      </p>

      <h2>If something goes wrong</h2>
      <p>
        If the property is not as described, or anything about your stay isn&apos;t right, contact us
        immediately — our guest support runs 24/7. We will put it right, move you to a comparable
        stay, or refund you. Cancellations and refunds are covered by our{" "}
        <Link href="/legal/cancellation" className="text-gold-deep underline hover:no-underline">
          Cancellation &amp; Refund Policy
        </Link>
        .
      </p>

      <h2>Reaching us</h2>
      <p>
        Call or WhatsApp{" "}
        <a href={`tel:${company.phone}`} className="text-gold-deep underline hover:no-underline">
          {company.phone}
        </a>
        , email{" "}
        <a href={`mailto:${support.email}`} className="text-gold-deep underline hover:no-underline">
          {support.email}
        </a>
        , or see our{" "}
        <Link href="/contact" className="text-gold-deep underline hover:no-underline">
          contact page
        </Link>
        .
      </p>
    </LegalPage>
  );
}
