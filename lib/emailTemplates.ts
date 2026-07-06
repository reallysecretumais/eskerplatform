import { brand } from "@/lib/brand";
import { support } from "@/lib/payments";

// Clean, premium, mobile-safe transactional emails (table layout + inline styles
// for broad client support). Ivory + gold, serif headings — matches the site.

export type BookingReceivedData = {
  guestName: string;
  propertyTitle: string;
  locationLabel: string;
  checkinLabel: string;
  checkoutLabel: string;
  nightsLabel: string;
  advanceLabel: string;
  balanceLabel: string;
  totalLabel: string;
  accountLink?: string | null; // one-tap link to view the booking + message us
};

const GOLD = "#9c7d2e";
const INK = "#211f1a";
const MUTED = "#6b675e";
const LINE = "#e7e2d8";

export function bookingReceivedEmail(d: BookingReceivedData): { subject: string; html: string; text: string } {
  const subject = `We've received your booking — ${d.propertyTitle}`;
  const waHref = `https://wa.me/${support.whatsapp}`;

  const row = (label: string, value: string, strong = false) =>
    `<tr>
      <td style="padding:8px 0;color:${MUTED};font-size:14px;">${label}</td>
      <td align="right" style="padding:8px 0;color:${INK};font-size:14px;${strong ? "font-weight:600;" : ""}">${value}</td>
    </tr>`;

  const html = `<!doctype html><html><body style="margin:0;background:#faf8f4;font-family:Inter,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f4;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden;">
        <tr><td style="height:4px;background:linear-gradient(90deg,#c9a84c,#9c7d2e);"></td></tr>
        <tr><td style="padding:28px 30px 0;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:${INK};letter-spacing:-0.01em;">${brand.name}</div>
          <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${INK};margin:18px 0 6px;font-weight:600;">Thank you, ${d.guestName.split(" ")[0] || "there"} — we've got your booking.</h1>
          <p style="color:${MUTED};font-size:15px;line-height:1.6;margin:0 0 18px;">Our team is verifying your payment now. You'll get a confirmation shortly — usually within a few hours. Here are your details:</p>
        </td></tr>
        <tr><td style="padding:0 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:12px;">
            <tr><td style="padding:14px 16px 4px;font-family:Georgia,serif;font-size:16px;color:${INK};font-weight:600;">${d.propertyTitle}</td></tr>
            <tr><td style="padding:0 16px 8px;color:${MUTED};font-size:13px;">${d.locationLabel}</td></tr>
            <tr><td style="padding:0 16px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};">
                ${row("Check-in", d.checkinLabel)}
                ${row("Check-out", d.checkoutLabel)}
                ${row("Length of stay", d.nightsLabel)}
                ${row("Total", d.totalLabel)}
              </table>
            </td></tr>
            <tr><td style="padding:10px 16px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f4;border-radius:10px;">
                <tr><td style="padding:12px 14px;">
                  ${row("Advance paid (securing your dates)", d.advanceLabel, true)}
                  ${row("Balance due at check-in", d.balanceLabel)}
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 30px;">
          <p style="color:${MUTED};font-size:13px;line-height:1.6;margin:0;">Your advance is held securely and goes toward your stay. If anything looks off, just reply to this email or message us on WhatsApp — we're happy to help.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 4px;"><tr>
            ${d.accountLink ? `<td style="border-radius:10px;background:${INK};"><a href="${d.accountLink}" style="display:inline-block;padding:11px 20px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">View your booking</a></td><td style="width:10px;"></td>` : ""}
            <td style="border-radius:10px;background:${GOLD};"><a href="${waHref}" style="display:inline-block;padding:11px 20px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">Chat with us on WhatsApp</a></td>
          </tr></table>
          ${d.accountLink ? `<p style="color:#9a958a;font-size:12px;line-height:1.6;margin:10px 0 0;">We've set up your Esker account so you can track this booking and message us anytime.</p>` : ""}
        </td></tr>
        <tr><td style="padding:16px 30px 26px;border-top:1px solid ${LINE};">
          <p style="color:#9a958a;font-size:12px;line-height:1.6;margin:0;">${brand.name} · ${brand.tagline}<br/>Support: <a href="${waHref}" style="color:${GOLD};text-decoration:none;">WhatsApp</a> · <a href="mailto:${support.email}" style="color:${GOLD};text-decoration:none;">${support.email}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;

  const text = [
    `${brand.name} — booking received`,
    ``,
    `Thank you, ${d.guestName} — we've got your booking and are verifying your payment now. You'll get a confirmation shortly.`,
    ``,
    `${d.propertyTitle} (${d.locationLabel})`,
    `Check-in: ${d.checkinLabel}`,
    `Check-out: ${d.checkoutLabel}`,
    `Stay: ${d.nightsLabel}`,
    `Total: ${d.totalLabel}`,
    `Advance paid: ${d.advanceLabel}`,
    `Balance due at check-in: ${d.balanceLabel}`,
    ``,
    `Questions? WhatsApp https://wa.me/${support.whatsapp} or email ${support.email}.`,
  ].join("\n");

  return { subject, html, text };
}

// ── Post-stay review request ─────────────────────────────────────────────────

export type ReviewRequestData = {
  guestName: string;
  propertyTitle: string;
  locationLabel: string;
  reviewLink: string; // deep link to the booking's "Rate your stay" card
};

export function reviewRequestEmail(d: ReviewRequestData): { subject: string; html: string; text: string } {
  const subject = `How was your stay at ${d.propertyTitle}?`;
  const first = d.guestName.split(" ")[0] || "there";
  // A row of gold stars as a warm, on-brand visual cue (inline, email-safe).
  const stars = Array.from({ length: 5 })
    .map(() => `<span style="color:${GOLD};font-size:26px;line-height:1;">★</span>`)
    .join("&nbsp;");

  const html = `<!doctype html><html><body style="margin:0;background:#faf8f4;font-family:Inter,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f4;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden;">
        <tr><td style="height:4px;background:linear-gradient(90deg,#c9a84c,#9c7d2e);"></td></tr>
        <tr><td style="padding:30px 30px 0;text-align:center;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:${INK};letter-spacing:-0.01em;">${brand.name}</div>
          <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${INK};margin:18px 0 6px;font-weight:600;">Thanks for staying with us, ${first}.</h1>
          <p style="color:${MUTED};font-size:15px;line-height:1.6;margin:0 0 16px;">We hope <strong style="color:${INK};">${d.propertyTitle}</strong> in ${d.locationLabel} felt like home. Would you take a moment to rate your stay? It helps other guests — and takes about 20 seconds.</p>
          <div style="margin:6px 0 18px;">${stars}</div>
        </td></tr>
        <tr><td style="padding:0 30px 8px;text-align:center;">
          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;"><tr>
            <td style="border-radius:10px;background:${INK};"><a href="${d.reviewLink}" style="display:inline-block;padding:12px 26px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">Rate your stay</a></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:16px 30px 26px;border-top:1px solid ${LINE};margin-top:16px;">
          <p style="color:#9a958a;font-size:12px;line-height:1.6;margin:0;text-align:center;">${brand.name} · ${brand.tagline}<br/>Not up to scratch? Reply or <a href="https://wa.me/${support.whatsapp}" style="color:${GOLD};text-decoration:none;">WhatsApp us</a> — we'll make it right.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;

  const text = [
    `${brand.name}`,
    ``,
    `Thanks for staying with us, ${first}.`,
    `We hope ${d.propertyTitle} (${d.locationLabel}) felt like home. Would you rate your stay? It only takes about 20 seconds:`,
    d.reviewLink,
    ``,
    `Not up to scratch? Reply or WhatsApp https://wa.me/${support.whatsapp} — we'll make it right.`,
  ].join("\n");

  return { subject, html, text };
}
