/*
  Generates the iOS app icon and launch image from the web app's own PNGs.

  Run with:  pnpm exec tsx scripts/gen-ios-assets.mts   (from mobile/)

  Companion to gen-icons.mts, which does the same for Android. Committed so the
  assets are reproducible rather than binaries nobody can regenerate.

  THE ALPHA CHANNEL IS THE WHOLE POINT OF THE FLATTEN BELOW. Both source PNGs
  are RGBA. Apple rejects an app icon containing transparency outright at
  submission, and before that it simply renders the transparent pixels black on
  the home screen — so a straight resize produces an icon that looks broken on
  the device and then fails review. The icon is therefore composited onto the
  brand cream and written with the alpha channel removed.

  THE ICON IS UPSCALED, and that is a compromise worth stating. iOS wants a
  single 1024x1024 master; the largest asset the web app has is 512x512, so
  this doubles it. For the flat mark that is acceptable, but if a larger master
  or a vector exists it should replace public/icon-512.png and this should be
  re-run — nothing else needs to change.
*/
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const webPublic = join(here, "..", "..", "public");
const assets = join(here, "..", "ios", "App", "App", "Assets.xcassets");

/* The web app's canvas: manifest.ts background_color, and the cream the
   stylesheet paints on body. Same value as Android's brandCanvas. */
const CREAM = { r: 0xf8, g: 0xf4, b: 0xec };

const ICON_PX = 1024;
const SPLASH_PX = 2732;
/* The mark on the launch screen, as a share of the canvas. A launch image is
   mostly empty space by design — this is the app settling, not a poster — and
   the storyboard scales it with scaleAspectFill, so anything large enough to
   fill the square gets cropped on non-square screens. */
const SPLASH_MARK_PX = 560;

await mkdir(join(assets, "AppIcon.appiconset"), { recursive: true });
await mkdir(join(assets, "Splash.imageset"), { recursive: true });

/* ---- App icon: 1024x1024, opaque ---- */
const iconBody = await sharp(join(webPublic, "icon-512.png"))
  .resize(ICON_PX, ICON_PX, { fit: "cover", kernel: "lanczos3" })
  .toBuffer();

const icon = await sharp({
  create: { width: ICON_PX, height: ICON_PX, channels: 3, background: CREAM },
})
  .composite([{ input: iconBody }])
  // removeAlpha after the composite: the source's transparent pixels have by
  // then been resolved against the cream, so this drops a now-uniform channel
  // rather than discarding information.
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toBuffer();

await writeFile(join(assets, "AppIcon.appiconset", "AppIcon-512@2x.png"), icon);

/* ---- Launch image: cream with the mark centred ---- */
const mark = await sharp(join(webPublic, "icon-maskable-512.png"))
  .resize(SPLASH_MARK_PX, SPLASH_MARK_PX, { fit: "contain", background: { ...CREAM, alpha: 0 } })
  .toBuffer();

const splash = await sharp({
  create: { width: SPLASH_PX, height: SPLASH_PX, channels: 3, background: CREAM },
})
  .composite([{ input: mark, gravity: "centre" }])
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toBuffer();

/*
  The same composition into all three scale slots, which is what the Capacitor
  template itself ships. The storyboard declares a 1366pt image and fills it
  with scaleAspectFill, so one square canvas large enough for the biggest iPad
  covers every device; giving the slots genuinely different pixel sizes would
  buy nothing and risks disagreeing with the storyboard's declared size.
*/
for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  await writeFile(join(assets, "Splash.imageset", name), splash);
}

process.stderr.write(
  `AppIcon-512@2x.png  ${ICON_PX}x${ICON_PX}  ${(icon.length / 1024).toFixed(0)} KB\n` +
    `Splash x3           ${SPLASH_PX}x${SPLASH_PX}  ${(splash.length / 1024).toFixed(0)} KB each\n`,
);

/*
  Self-checks. Both of these are failure modes that look fine in a file browser
  and only surface on a device or at submission.
*/
const iconMeta = await sharp(icon).metadata();
if (iconMeta.hasAlpha) throw new Error("app icon still has an alpha channel — iOS will reject it");
if (iconMeta.width !== ICON_PX || iconMeta.height !== ICON_PX) {
  throw new Error(`app icon is ${iconMeta.width}x${iconMeta.height}, expected ${ICON_PX} square`);
}

const splashMeta = await sharp(splash).metadata();
if (splashMeta.hasAlpha) throw new Error("launch image still has an alpha channel");

/* And confirm the icon's corner really is the cream rather than black, which
   is what a botched flatten actually produces. */
const corner = await sharp(icon).extract({ left: 0, top: 0, width: 8, height: 8 }).raw().toBuffer();
const [r, g, b] = [corner[0], corner[1], corner[2]];
if (Math.abs(r - CREAM.r) > 6 || Math.abs(g - CREAM.g) > 6 || Math.abs(b - CREAM.b) > 6) {
  throw new Error(`icon corner is rgb(${r},${g},${b}), expected the cream — the flatten did not take`);
}

process.stderr.write(`opaque, square, corner rgb(${r},${g},${b}) = the brand cream\n`);
