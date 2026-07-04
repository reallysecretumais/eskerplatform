import "server-only";

// AI vision ID check (CNIC / passport): confirms the upload is genuinely an ID
// document, reads the number + name + expiry, validates format, and rejects
// EXPIRED documents. This is the practical first line — real authenticity
// (national-database match) is a later NADRA Verisys integration that slots in
// after this extraction step (verify the extracted `number` against NADRA).

const MODEL = process.env.ESKER_AI_MODEL || "gpt-4.1-mini";

export type IdSide = "front" | "back";

// The front (CNIC front / passport data page) carries the photo, name and number.
// The CNIC BACK carries the address, date of issue and date of expiry — no number
// — so we verify it's a genuine, readable CNIC back and (still) not expired.
function systemFor(side: IdSide): string {
  const common = `Return ONLY JSON:
{
  "is_id": boolean,
  "doc_type": "cnic" | "passport" | "other",
  "readable": boolean,         // are the key fields legible?
  "id_number": string|null,    // CNIC (13 digits, dashes ok) or passport number, if visible
  "name": string|null,
  "expiry_date": string|null,  // ISO yyyy-mm-dd if an expiry / valid-until / date-of-expiry is visible, else null
  "notes": string
}
Be strict: a selfie, a random object, a screenshot of text, a blurry/cropped/partial image, or anything not a genuine-looking ID → is_id:false.`;
  if (side === "back") {
    return `You verify identity documents from a photo for a Pakistani short-stay booking site. This image should be the BACK of a Pakistani CNIC (national ID card) — it shows the holder's address, date of issue and date of expiry, and usually a barcode/QR. is_id is true ONLY if it clearly shows a genuine CNIC back; set doc_type to "cnic". The ID number is NOT on the back, so id_number may be null.\n${common}`;
  }
  return `You verify identity documents from a photo for a Pakistani short-stay booking site. The document must be the FRONT of a Pakistani CNIC (national ID card) or a passport data page.\n${common}`;
}

export type IdResult = {
  ok: boolean;
  message?: string;
  docType?: string;
  number?: string | null;
  name?: string | null;
  expiry?: string | null;
};

export async function verifyId(file: File, side: IdSide = "front"): Promise<IdResult> {
  const key = process.env.OPENAI_API_KEY;
  // Not configured → don't block the booking; the team verifies by eye.
  if (!key) return { ok: true, message: "skipped" };

  try {
    const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const today = new Date().toISOString().slice(0, 10);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemFor(side) },
          {
            role: "user",
            content: [
              { type: "text", text: `Today is ${today}. Read this ${side === "back" ? "CNIC back" : "ID document"}.` },
              { type: "image_url", image_url: { url: `data:${file.type || "image/jpeg"};base64,${b64}` } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);

    const data = await res.json();
    const r = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");

    if (side === "back") {
      if (!r.is_id || r.doc_type !== "cnic") {
        return { ok: false, message: "That doesn't look like the back of a CNIC — please upload a clear photo of the back." };
      }
      if (!r.readable) {
        return { ok: false, message: "We couldn't read the back of your CNIC. Please upload a sharp, well-lit photo." };
      }
      // Expiry (printed on the back) is still enforced below.
    } else {
      if (!r.is_id || r.doc_type === "other") {
        return { ok: false, message: "That doesn't look like a CNIC or passport — please upload a clear photo of your ID." };
      }
      if (!r.readable) {
        return { ok: false, message: "We couldn't read your ID clearly. Please upload a sharp, well-lit photo." };
      }
      if (r.doc_type === "cnic") {
        const digits = String(r.id_number ?? "").replace(/\D/g, "");
        if (digits.length !== 13) {
          return { ok: false, message: "That CNIC number didn't read correctly — please upload a clear photo of the front." };
        }
      }
    }
    const expiry = r.expiry_date && /^\d{4}-\d{2}-\d{2}$/.test(r.expiry_date) ? (r.expiry_date as string) : null;
    if (expiry && expiry < today) {
      return {
        ok: false,
        message: `Your ${r.doc_type === "passport" ? "passport" : "ID card"} appears to be expired (expired ${expiry}). Please use a valid, in-date document.`,
      };
    }

    return { ok: true, docType: r.doc_type, number: r.id_number ?? null, name: r.name ?? null, expiry };
  } catch (e) {
    // A transient AI error must not block a real booking — let it through; the
    // team still verifies the uploaded image manually.
    console.error("[idcheck] failed:", (e as Error).message);
    return { ok: true, message: "ai-error" };
  }
}
