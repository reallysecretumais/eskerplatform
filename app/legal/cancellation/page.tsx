import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Cancellation & Refund Policy — Esker Stays" };

export default function CancellationPolicy() {
  return (
    <LegalPage title="Cancellation & Refund Policy" updated="29 June 2026">
      <p>
        We know plans change. This policy explains what happens to your advance if you cancel, and how refunds work. It applies to bookings made through the Esker Stays website.
      </p>

      <h2>Your advance</h2>
      <p>
        To secure a booking you pay an advance — <strong>25%</strong> of the total for standard stays, or <strong>50%</strong> for Esker Exclusive stays. The remaining balance is paid at or before check-in. Your advance goes toward the total cost of your stay.
      </p>

      <h2>If you cancel</h2>
      <ul>
        <li><strong>7 or more days before check-in:</strong> your advance is fully refunded (less any bank/transfer charges), or kept as Esker credit toward a future stay — your choice.</li>
        <li><strong>3 to 7 days before check-in:</strong> 50% of your advance is refunded; the rest is retained.</li>
        <li><strong>Less than 72 hours before check-in, or no-show:</strong> the advance is non-refundable.</li>
      </ul>
      <p>You are never charged the remaining balance if you cancel before check-in.</p>

      <h2>Date changes</h2>
      <p>
        Want to move your dates? Message us as early as possible — we&apos;ll do our best to shift your booking to new dates, subject to availability and any rate difference. One free date change is usually possible if requested 7+ days ahead.
      </p>

      <h2>If Esker cancels</h2>
      <p>
        If we ever have to cancel your confirmed booking (for example, an issue with the property), you&apos;ll receive a <strong>full refund of everything paid</strong>, and we&apos;ll help you find and move to a comparable stay wherever possible.
      </p>

      <h2>How refunds are paid</h2>
      <p>
        Refunds are sent back to your original payment method (or another method you provide) and are typically processed within 5–7 working days. Third-party transfer or gateway fees, where applicable, are not refundable.
      </p>

      <h2>Early departure</h2>
      <p>
        If you check out earlier than booked, nights already begun are not refundable. Talk to us — we&apos;ll always try to be fair.
      </p>
    </LegalPage>
  );
}
