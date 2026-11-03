/*
  Generates the Android launcher icons from the web app's own PNGs.

  Run with:  pnpm exec tsx scripts/gen-icons.ts   (from mobile/)

  Committed so the icons are reproducible rather than binaries someone dropped
  in once and nobody can regenerate.

  TWO SOURCES, NOT ONE, and the distinction is the whole reason this script
  exists rather than a single resize:

  - The legacy square icon (`ic_launcher`, `ic_launcher_round`) is full-bleed.
    It comes from icon-512, which already carries the cream plate edge to edge.

  - The adaptive icon's FOREGROUND is masked by the launcher into whatever
    shape the device uses — circle, squircle, rounded square — and the outer
    ~18% of each edge can be cropped. It therefore comes from
    icon-maskable-512, which is drawn with that safe zone already allowed for.
    Feeding the full-bleed icon in here would have the mark's edges shaved off
    on most phones.

  Every target is smaller than the 512px sources, so each is a downscale. That
  is deliberate: upscaling to reach the 1024px that icon generators usually ask
  for would invent detail and soften the mark.
*/
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const webPublic = join(here, "..", "..", "public");
const res = join(here, "..", "android", "app", "src", "main", "res");

/* Android's density buckets. The legacy icon is 48dp, the adaptive foreground
   108dp; both scale by the same per-bucket multiplier. */
const DENSITIES: { dir: string; scale: number }[] = [
  { dir: "mipmap-mdpi", scale: 1 },
  { dir: "mipmap-hdpi", scale: 1.5 },
  { dir: "mipmap-xhdpi", scale: 2 },
  { dir: "mipmap-xxhdpi", scale: 3 },
  { dir: "mipmap-xxxhdpi", scale: 4 },
];

const LEGACY_DP = 48;
const FOREGROUND_DP = 108;

async function emit(source: string, out: string, size: number) {
  const png = await sharp(source)
    .resize(size, size, { fit: "cover", kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(out, png);
  return png.length;
}

const square = join(webPublic, "icon-512.png");
const maskable = join(webPublic, "icon-maskable-512.png");

let total = 0;
for (const { dir, scale } of DENSITIES) {
  const target = join(res, dir);
  await mkdir(target, { recursive: true });

  const legacy = Math.round(LEGACY_DP * scale);
  const fore = Math.round(FOREGROUND_DP * scale);

  total += await emit(square, join(target, "ic_launcher.png"), legacy);
  total += await emit(square, join(target, "ic_launcher_round.png"), legacy);
  total += await emit(maskable, join(target, "ic_launcher_foreground.png"), fore);

  process.stderr.write(`${dir.padEnd(16)} launcher ${legacy}px  foreground ${fore}px\n`);
}

process.stderr.write(`\n15 icons, ${(total / 1024).toFixed(0)} KB total\n`);

/*
  A self-check worth having: confirm the foreground really is the maskable
  source and not the full-bleed one. They are both 512px squares, so a wrong
  wiring here produces icons that look fine in isolation and clipped on a
  phone — exactly the kind of mistake that ships.
*/
const [a, b] = await Promise.all([
  sharp(maskable).resize(32, 32).raw().toBuffer(),
  sharp(join(res, "mipmap-xxxhdpi", "ic_launcher_foreground.png")).resize(32, 32).raw().toBuffer(),
]);
const drift = a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;
if (drift > 12) throw new Error(`foreground does not match the maskable source (drift ${drift.toFixed(1)})`);
process.stderr.write(`foreground matches the maskable source (drift ${drift.toFixed(1)})\n`);
