import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Terms of Service — Esker Stays" };

export default function TermsOfService() {
  return (
    <LegalPage title="Terms of Service" updated="29 June 2026">
      <p>
        These terms govern bookings made through the Esker Stays website, operated by Esker Rentals in Islamabad and Rawalpindi, Pakistan. By booking, you agree to them.
      </p>

      <h2>Bookings</h2>
      <p>
        A booking is requested when you submit the form and pay your advance. It is <strong>confirmed once our team verifies your payment</strong> — you&apos;ll receive a confirmation. We may decline or cancel a booking (for example, if payment can&apos;t be verified or a property becomes unavailable); in that case any amount paid is refunded in full.
      </p>

      <h2>Payment</h2>
      <p>
        We take an advance to secure your booking — 25% of the total for standard stays, 50% for Esker Exclusive — with the balance due at or before check-in. Payment is made by bank transfer, Easypaisa, JazzCash, or SadaPay and verified from your uploaded screenshot. Your advance is held and applied to your stay. Refunds follow our{" "}
        <a href="/legal/cancellation" className="text-gold-deep underline hover:no-underline">Cancellation &amp; Refund Policy</a>.
      </p>

      <h2>Identity verification</h2>
      <p>
        First-time guests provide a valid CNIC or passport. We may decline a booking if identity can&apos;t be verified or the document is invalid/expired. Documents are handled per our{" "}
        <a href="/legal/privacy" className="text-gold-deep underline hover:no-underline">Privacy Policy</a>.
      </p>

      <h2>Your stay</h2>
      <ul>
        <li>Guest numbers must not exceed the property&apos;s stated capacity.</li>
        <li>Please respect the property, neighbours, and any house rules shared with you.</li>
        <li>You are responsible for damage caused during your stay beyond normal wear.</li>
        <li>Check-in/check-out times are as communicated for each property.</li>
      </ul>

      <h2>Liability</h2>
      <p>
        We work hard to ensure every stay is as described and to a good standard, and Esker Exclusive stays are managed by us directly. To the extent permitted by law, Esker&apos;s liability is limited to the amount you paid for the booking. We aren&apos;t liable for events outside our reasonable control (force majeure).
      </p>

      <h2>Changes & governing law</h2>
      <p>
        We may update these terms; the version shown at the time of your booking applies. These terms are governed by the laws of Pakistan.
      </p>
    </LegalPage>
  );
}
