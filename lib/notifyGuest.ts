import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { bookingReceivedEmail } from "@/lib/emailTemplates";

// Fan-out for a new website booking: guest email (now), guest WhatsApp (queued
// for the CRM's inbox sender to deliver natively when WA is live), and an
// in-app team alert. Everything is best-effort and never throws — guest comms
// must never break a booking.

type BookingReceived = {
  bookingId: string;
  guestId: string;
  guestName: string;
  email?: string;
  phone: string;
  propertyId: string;
  propertyTitle: string;
  area?: string | null;
  category?: string | null;
  checkin: string;
  checkout: string;
  nights: number;
  total: number;
  advance: number;
  balance: number;
};

const pkr = (n: number) => `₨${Math.round(n).toLocaleString("en-PK")}`;
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export async function notifyBookingReceived(b: BookingReceived): Promise<void> {
  const admin = createAdminClient();
  const locationLabel = [b.category, b.area].filter(Boolean).join(" · ") || "Esker stay";
  const nightsLabel = `${b.nights} ${b.nights === 1 ? "night" : "nights"}`;

  // 1. Guest email (immediate)
  try {
    if (b.email) {
      const mail = bookingReceivedEmail({
        guestName: b.guestName,
        propertyTitle: b.propertyTitle,
        locationLabel,
        checkinLabel: fmtDate(b.checkin),
        checkoutLabel: fmtDate(b.checkout),
        nightsLabel,
        advanceLabel: pkr(b.advance),
        balanceLabel: pkr(b.balance),
        totalLabel: pkr(b.total),
      });
      const r = await sendEmail({ to: b.email, subject: mail.subject, html: mail.html, text: mail.text });
      await admin.from("guest_messages").insert({
        booking_id: b.bookingId,
        channel: "email",
        event: "booking_received",
        recipient: b.email,
        status: r.ok ? "sent" : "failed",
        error: r.ok ? null : r.error ?? null,
        sent_at: r.ok ? new Date().toISOString() : null,
        payload: { subject: mail.subject },
      });
    }
  } catch {
    /* best-effort */
  }

  // 2. Guest WhatsApp — queued for the CRM inbox sender (native conversation +
  //    approved 'booking_received' template) once the WA API is live.
  try {
    await admin.from("guest_messages").insert({
      booking_id: b.bookingId,
      channel: "whatsapp",
      event: "booking_received",
      recipient: b.phone,
      status: "pending",
      payload: {
        template: "booking_received",
        guest_id: b.guestId,
        property_id: b.propertyId,
        vars: {
          guest_name: b.guestName,
          property: b.propertyTitle,
          checkin: fmtDate(b.checkin),
          checkout: fmtDate(b.checkout),
          advance: pkr(b.advance),
          balance: pkr(b.balance),
          total: pkr(b.total),
        },
      },
    });
  } catch {
    /* best-effort */
  }

  // 3. Internal team alert (in-app CRM notification for every active staff member)
  try {
    const { data: staff } = await admin.from("users").select("id").eq("active", true);
    const rows = (staff ?? []).map((u: { id: string }) => ({
      user_id: u.id,
      type: "booking",
      title: `New website booking — ${b.propertyTitle}`,
      body: `${b.guestName} · ${fmtDate(b.checkin)} → ${fmtDate(b.checkout)} · advance ${pkr(b.advance)} (verify payment)`,
      link: `/bookings/${b.bookingId}`,
    }));
    if (rows.length) await admin.from("notifications").insert(rows);
  } catch {
    /* best-effort */
  }
}
