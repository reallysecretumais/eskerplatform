import { LegalPage } from "@/components/LegalPage";
import { support } from "@/lib/payments";

export const metadata = { title: "Privacy Policy — Esker Stays" };

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" updated="29 June 2026">
      <p>
        Esker Stays (operated by Esker Rentals, Islamabad/Rawalpindi, Pakistan) respects your privacy. This policy explains what we collect, why, and how we protect it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Contact details:</strong> your name, phone number, and email.</li>
        <li><strong>Identity document:</strong> a photo of your CNIC or passport, for first-time guests, to verify identity.</li>
        <li><strong>Payment proof:</strong> the screenshot of your advance payment.</li>
        <li><strong>Booking details:</strong> the property, dates, and any preferences you share.</li>
      </ul>

      <h2>Why we collect it</h2>
      <p>
        To verify who you are (for the safety of guests, hosts, and properties, and to meet legal requirements), to process and manage your booking, to communicate with you about your stay, and to comply with applicable law.
      </p>

      <h2>How your ID and documents are handled</h2>
      <p>
        Your CNIC/passport image and payment screenshots are stored in <strong>private, access-controlled storage</strong> and are viewable only by authorised Esker staff for verification. They are <strong>never sold</strong>, never used for marketing, and never shared publicly. We keep them only as long as needed for your booking and any legal or tax obligations, then remove them.
      </p>

      <h2>Who we share with</h2>
      <ul>
        <li>The host/caretaker of your booked property, only with what they need to host your stay.</li>
        <li>Trusted service providers (e.g. secure hosting and email delivery) under confidentiality obligations.</li>
        <li>Authorities, only where required by law.</li>
      </ul>
      <p>We do not sell your personal information to anyone.</p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit, sensitive files are kept in private storage, and database access is restricted by row-level security so the public website can never reach your personal data.
      </p>

      <h2>Your choices</h2>
      <p>
        You can ask us to access, correct, or delete your personal information (subject to records we must keep by law). Email{" "}
        <a href={`mailto:${support.email}`} className="text-gold-deep underline hover:no-underline">{support.email}</a> and we&apos;ll help.
      </p>
    </LegalPage>
  );
}
