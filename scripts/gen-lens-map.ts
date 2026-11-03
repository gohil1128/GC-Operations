/*
  Generates the displacement map that gives Liquid Glass its refraction.

  Blur alone is frosted plastic. What makes glass read as glass is LENSING:
  near the rim the material is curved, so it bends what is behind it, and the
  background appears pulled and compressed toward the edge. That bending is
  what an feDisplacementMap does — it reads a per-pixel offset out of an image
  and moves the source by it.

  The map encodes the offset in two channels: red carries x, green carries y,
  and 128 means "do not move". So a flat grey #808000-ish field is a pane of
  perfectly flat glass, and every departure from 128 is curvature.

  The profile here is a rounded-rectangle bevel. Walking in from any edge:

      distance 0 .............. rim ............. flat centre
      strong outward offset  →  falls off  →     exactly 128

  The falloff is smoothstep rather than linear, because a linear ramp produces
  a visible crease where the bevel meets the flat — the same artefact you get
  sharpening a photograph too hard. Smoothstep lands tangent to the flat and
  the join disappears.

  Emitted as a PNG because SVG gradients cannot express a rounded-rect distance
  field, and because a raster map is what feImage handles most reliably across
  engines. Written with a hand-rolled encoder — a 24 KB uncompressed-deflate
  PNG writer is less weight than taking an image dependency for one build-time
  asset.

  Run with:  pnpm exec tsx scripts/gen-lens-map.ts
  Writes:    public/lens-map.png
*/

import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

/* The map is square and the filter stretches it to whatever it is applied to.
   256 is plenty: it is only ever sampled as a smooth gradient, and the bevel
   is many pixels wide at every size we use it at. */
const SIZE = 256;

/* How far in from the edge the bevel reaches, as a fraction of the map. The
   rim of a glass panel is a small part of its area — past about an eighth it
   stops reading as an edge and starts reading as a fisheye over the whole
   surface. */
const BEVEL = 0.11;

/* Corner radius of the shape the bevel follows, as a fraction of the map.
   Matched to the --lg-r scale: our panels are generously rounded, and a bevel
   that follows a squarer rectangle than the panel it sits on produces bright
   corners where the two disagree. */
const RADIUS = 0.22;

/** Distance from (x, y) to the edge of a rounded rectangle, normalised 0..1. */
function distanceToEdge(x: number, y: number): number {
  // Work from the centre out, in half-extent units, so the shape is symmetric.
  const px = Math.abs(x - 0.5);
  const py = Math.abs(y - 0.5);
  const half = 0.5;
  const r = RADIUS;

  // Signed distance to a rounded box, the standard formulation: collapse to
  // the corner quadrant, then it is a circle problem.
  const qx = px - (half - r);
  const qy = py - (half - r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  const signed = outside + inside - r;

  // signed is <= 0 inside the shape; -signed is how deep in we are.
  return -signed;
}

/** 0 at the edge, 1 once fully inside the flat. Tangent at both ends. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/* ── Build the RGBA buffer ──────────────────────────────────────────────── */

const rgba = Buffer.alloc(SIZE * SIZE * 4);

for (let j = 0; j < SIZE; j++) {
  for (let i = 0; i < SIZE; i++) {
    const x = (i + 0.5) / SIZE;
    const y = (j + 0.5) / SIZE;

    const depth = distanceToEdge(x, y);
    // 1 at the very edge, 0 once past the bevel into the flat interior.
    const strength = 1 - smoothstep(0, BEVEL, depth);

    /*
      Direction: straight out from the centre. Normalised so a corner displaces
      diagonally by the same magnitude an edge displaces straight — otherwise
      corners get sqrt(2) times the refraction and bloom.
    */
    let dx = x - 0.5;
    let dy = y - 0.5;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;

    /*
      Outside the shape entirely (the map's own corners, beyond the rounding)
      must stay neutral: displacing there would smear content in from outside
      the panel, which looks like a rendering fault rather than like glass.
    */
    const inShape = depth > 0 ? 1 : 0;
    const amount = strength * inShape;

    const r = Math.round(128 + dx * amount * 127);
    const g = Math.round(128 + dy * amount * 127);

    const o = (j * SIZE + i) * 4;
    rgba[o] = Math.min(255, Math.max(0, r));
    rgba[o + 1] = Math.min(255, Math.max(0, g));
    // Blue is unused by the filter; alpha must be opaque or feImage premultiplies
    // the offsets away and the whole map collapses toward neutral.
    rgba[o + 2] = 0;
    rgba[o + 3] = 255;
  }
}

/* ── Encode as PNG ──────────────────────────────────────────────────────── */

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

// PNG wants each scanline prefixed with its filter type; 0 is "none", which is
// right here — the deflate pass handles a smooth gradient perfectly well and
// filtering would only add a step to get wrong.
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let j = 0; j < SIZE; j++) {
  raw[j * (SIZE * 4 + 1)] = 0;
  rgba.copy(raw, j * (SIZE * 4 + 1) + 1, j * SIZE * 4, (j + 1) * SIZE * 4);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type: RGBA
ihdr[10] = 0; // deflate
ihdr[11] = 0; // adaptive filtering
ihdr[12] = 0; // no interlace

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync("public/lens-map.png", png);

/* A self-check, so a bad profile is caught here rather than discovered as a
   smeared panel in the browser. */
const at = (x: number, y: number) => {
  const i = Math.floor(x * SIZE);
  const j = Math.floor(y * SIZE);
  const o = (j * SIZE + i) * 4;
  return [rgba[o], rgba[o + 1]];
};
const [cr, cg] = at(0.5, 0.5);
const [lr] = at(0.004, 0.5);
const [, tg] = at(0.5, 0.004);
process.stderr.write(
  `public/lens-map.png  ${SIZE}x${SIZE}  ${(png.length / 1024).toFixed(1)} KB\n` +
    `  centre      ${cr},${cg}   (must be 128,128 — flat)\n` +
    `  left edge   r=${lr}       (must be well under 128 — pulls left)\n` +
    `  top edge    g=${tg}       (must be well under 128 — pulls up)\n`,
);
if (cr !== 128 || cg !== 128) throw new Error("centre of the lens map is not neutral");
if (lr > 100) throw new Error("left edge barely displaces — bevel is too weak or too narrow");
