import { NextResponse } from "next/server";
import { scopeFor } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { readableAttachment } from "@/modules/invoices/attachments";

// Serves an invoice's attached photo as a real image URL. Browsers block
// opening data: URLs in a new tab, so every "view photo" link goes through
// here instead.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await scopeFor("purchasing");
  if (!scope) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const inv = await prisma.invoice.findFirst({
    where: { id, locationId: scope.locationId },
    select: { imageDataUrl: true },
  });
  if (!inv?.imageDataUrl) {
    return NextResponse.json({ error: "No photo attached" }, { status: 404 });
  }
  /*
    Re-checked against the allowlist on the way out, not just on upload.

    The old check here accepted any image/* subtype, which includes
    image/svg+xml — a scriptable document, served inline from this app's own
    origin. Uploading one and getting a colleague to open the invoice photo ran
    the uploader's JavaScript with the viewer's session. Rows written before the
    upload allowlist existed can still hold one, so the column is not trusted.
  */
  const file = readableAttachment(inv.imageDataUrl);
  if (!file) {
    return NextResponse.json(
      { error: "Stored attachment is not a supported image or PDF" },
      { status: 415 },
    );
  }

  const isPdf = file.mime === "application/pdf";
  return new NextResponse(Buffer.from(file.base64, "base64"), {
    headers: {
      "Content-Type": file.mime,
      // inline → browsers render the PDF/image in the tab instead of downloading
      "Content-Disposition": `inline; filename="invoice.${isPdf ? "pdf" : "jpg"}"`,
      "Cache-Control": "private, max-age=300",
      // Belt and braces around the same class of bug: never let a browser
      // re-interpret these bytes as something executable, and give the response
      // no privileges of its own even if one slips through the allowlist.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; object-src 'none'; sandbox",
    },
  });
}
