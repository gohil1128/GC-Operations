/*
  What may be attached to an invoice, and served back.

  The check used to be `startsWith("data:image/")`, which accepts
  `data:image/svg+xml`. The photo route then served those bytes from the app's
  own origin with Content-Type: image/svg+xml and Content-Disposition: inline —
  and an SVG is a document that can carry <script>. Anyone opening that
  invoice's photo ran the uploader's JavaScript on the app origin, with the
  session cookie attached to every request it chose to make. There is no CSP on
  this app to blunt it.

  So the rule is an allowlist of raster formats plus PDF, applied on the way in
  AND on the way out — rows predating this fix may already hold an SVG, and the
  serving route must not trust what is in the column.
*/

/** Raster images and PDF. Deliberately no SVG: it is script-capable. */
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export const MAX_IMAGE_DATAURL_CHARS = 3_500_000; // ~2.6MB decoded
export const MAX_PDF_DATAURL_CHARS = 5_500_000; // ~4MB decoded

const DATA_URL = /^data:([a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i;

export type Attachment = { mime: string; base64: string };

/**
 * Parse a data URL and accept it only if the type is on the allowlist.
 * Returns null for empty input; throws with a message meant for the user.
 */
export function parseAttachment(raw: unknown): Attachment | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;

  const m = DATA_URL.exec(s);
  if (!m) throw new Error("Attachment must be an image or a PDF");

  const mime = m[1].toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    // Named explicitly: someone attaching a logo as SVG should be told why it
    // was refused rather than left guessing at a generic failure.
    throw new Error(
      mime === "image/svg+xml"
        ? "SVG attachments are not allowed — save the invoice as a PNG, JPEG or PDF"
        : "Attachment must be a PNG, JPEG, WEBP, GIF, HEIC or PDF",
    );
  }

  const limit = mime === "application/pdf" ? MAX_PDF_DATAURL_CHARS : MAX_IMAGE_DATAURL_CHARS;
  if (s.length > limit) {
    throw new Error(
      mime === "application/pdf"
        ? "PDF too large — keep it under 4 MB"
        : "Image too large — retake or crop the photo",
    );
  }

  return { mime, base64: m[2].replace(/\s+/g, "") };
}

/** The validated data URL to store, or null. */
export function validateImageDataUrl(raw: unknown): string | null {
  const a = parseAttachment(raw);
  return a ? `data:${a.mime};base64,${a.base64}` : null;
}

/**
 * Re-check on the way out. A row written before the allowlist existed can still
 * hold an SVG, and this is the last point before those bytes reach a browser.
 */
export function readableAttachment(stored: string | null | undefined): Attachment | null {
  if (!stored) return null;
  const m = DATA_URL.exec(stored.trim());
  if (!m) return null;
  const mime = m[1].toLowerCase();
  if (!ALLOWED_MIME.has(mime)) return null;
  return { mime, base64: m[2].replace(/\s+/g, "") };
}
