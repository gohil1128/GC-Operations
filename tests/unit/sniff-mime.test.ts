import { describe, expect, it } from "vitest";
import { parseAttachment, sniffMime } from "@/modules/invoices/attachments";

/* Mail clients mislabel attachments; the bytes decide what a file is. */
const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("sniffMime", () => {
  it("reads a PDF sent as octet-stream", () => {
    expect(sniffMime(bytes(0x25, 0x50, 0x44, 0x46, 0x2d), "application/octet-stream")).toBe("application/pdf");
  });
  it("reads JPEG, PNG, GIF and WEBP from their headers", () => {
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0), "binary/octet-stream")).toBe("image/jpeg");
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "")).toBe("image/png");
    expect(sniffMime(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61), "")).toBe("image/gif");
    expect(sniffMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]), "")).toBe("image/webp");
  });
  it("reads an iPhone HEIC photo", () => {
    const heic = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    expect(sniffMime(heic, "application/octet-stream")).toBe("image/heic");
  });
  it("falls back to the label, mending image/jpg", () => {
    expect(sniffMime(new Uint8Array([1, 2, 3]), "image/jpg")).toBe("image/jpeg");
    expect(sniffMime(new Uint8Array([1, 2, 3]), "image/svg+xml")).toBe("image/svg+xml");
  });
  it("never lets SVG through the allowlist", () => {
    expect(() => parseAttachment("data:image/svg+xml;base64,PHN2Zz4=")).toThrow(/SVG/);
  });
  it("accepts image/jpg data URLs as JPEG", () => {
    expect(parseAttachment("data:image/jpg;base64,/9j/4AAQ")?.mime).toBe("image/jpeg");
  });
});
