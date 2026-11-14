import { NextResponse } from "next/server";
import { scopeFor } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { readableAttachment } from "@/modules/invoices/attachments";

/*
  Every file attached to an invoice, as a list of addresses: the main one, then
  the further pages in the order they were added. Types only, never the bytes;
  each file is fetched from the photo route when it is shown.
*/
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await scopeFor("purchasing");
  if (!scope) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const inv = await prisma.invoice.findFirst({
    where: { id, locationId: scope.locationId },
    select: { imageDataUrl: true, attachments: { orderBy: { createdAt: "asc" }, select: { id: true, dataUrl: true, name: true } } },
  });
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
  const base = `/api/purchasing/invoices/${id}/photo`;
  const files: { url: string; mime: string; name: string | null }[] = [];
  const main = readableAttachment(inv.imageDataUrl);
  if (main) files.push({ url: base, mime: main.mime, name: null });
  for (const a of inv.attachments) {
    const f = readableAttachment(a.dataUrl);
    if (f) files.push({ url: `${base}?a=${a.id}`, mime: f.mime, name: a.name });
  }
  return NextResponse.json({ files }, { headers: { "Cache-Control": "private, no-store" } });
}
