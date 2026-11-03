import { describe, it, expect } from "vitest";
import {
  parseAttachment, validateImageDataUrl, readableAttachment,
} from "@/modules/invoices/attachments";

/*
  Invoice attachments. The old check was startsWith("data:image/"), which let an
  SVG through — and the photo route served it inline, from the app's own origin,
  as image/svg+xml. An SVG can carry <script>, so opening a colleague's invoice
  photo ran their JavaScript with your session.
*/

const png = "data:image/png;base64,iVBORw0KGgo=";
const jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
const pdf = "data:application/pdf;base64,JVBERi0xLjQK";
const svg =
  "data:image/svg+xml;base64," +
  Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64");

describe("what may be attached", () => {
  it("accepts the raster formats a phone camera produces", () => {
    for (const ok of [png, jpeg, "data:image/webp;base64,UklGRg==",
                      "data:image/gif;base64,R0lGODdh", "data:image/heic;base64,AAAA"]) {
      expect(parseAttachment(ok), ok.slice(0, 24)).not.toBeNull();
    }
  });

  it("accepts a PDF", () => {
    expect(parseAttachment(pdf)?.mime).toBe("application/pdf");
  });

  it("treats empty input as no attachment rather than an error", () => {
    for (const empty of ["", "   ", null, undefined]) {
      expect(parseAttachment(empty as any)).toBeNull();
    }
  });
});

describe("SVG is refused", () => {
  it("rejects it, with a reason a person can act on", () => {
    expect(() => parseAttachment(svg)).toThrow(/SVG attachments are not allowed/);
  });

  it("rejects it however the type is cased or spaced", () => {
    expect(() => parseAttachment("data:IMAGE/SVG+XML;base64,PHN2Zz4=")).toThrow();
  });

  it("is not smuggled past by a nested or trailing type", () => {
    for (const attempt of [
      "data:image/svg+xml;base64,PHN2Zz4=",
      "data:image/png;base64,PHN2Zz4=,data:image/svg+xml;base64,PHN2Zz4=",
      "data:text/html;base64,PGgxPmhpPC9oMT4=",
      "data:application/javascript;base64,YWxlcnQoMSk=",
      "javascript:alert(1)",
      "data:image/png,<svg onload=alert(1)>",
    ]) {
      expect(() => parseAttachment(attempt), attempt.slice(0, 40)).toThrow();
    }
  });
});

describe("size limits", () => {
  it("refuses an oversized image", () => {
    expect(() => parseAttachment("data:image/png;base64," + "A".repeat(4_000_000)))
      .toThrow(/Image too large/);
  });

  it("refuses an oversized PDF", () => {
    expect(() => parseAttachment("data:application/pdf;base64," + "A".repeat(6_000_000)))
      .toThrow(/PDF too large/);
  });
});

describe("readableAttachment, the check on the way out", () => {
  it("returns a stored raster image", () => {
    expect(readableAttachment(png)?.mime).toBe("image/png");
  });

  /*
    The reason this exists separately from the upload check: rows written before
    the allowlist can still hold an SVG, and the serving route is the last point
    before those bytes reach a browser.
  */
  it("refuses a stored SVG rather than serving it", () => {
    expect(readableAttachment(svg)).toBeNull();
  });

  it("refuses anything unparseable, without throwing in the request path", () => {
    for (const bad of [null, undefined, "", "not a data url", "data:;base64,AAAA"]) {
      expect(() => readableAttachment(bad as any)).not.toThrow();
      expect(readableAttachment(bad as any)).toBeNull();
    }
  });
});

describe("validateImageDataUrl normalises what gets stored", () => {
  it("strips whitespace out of the payload", () => {
    const stored = validateImageDataUrl("data:image/png;base64,iVBO\n Rw0K Ggo=");
    expect(stored).toBe("data:image/png;base64,iVBORw0KGgo=");
  });

  it("lowercases the type so the allowlist cannot be dodged by casing", () => {
    expect(validateImageDataUrl("data:IMAGE/PNG;base64,iVBORw0KGgo="))
      .toBe("data:image/png;base64,iVBORw0KGgo=");
  });
});
