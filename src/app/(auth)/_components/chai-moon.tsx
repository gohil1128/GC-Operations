/*
  The chai moon: a close shot of the foam on a cup of chai, cut to a circle and
  lit like a moon rising behind the page. Decorative only (aria-hidden, no alt),
  and sits behind everything on the sign-in and sign-up pages.
  Three sizes from one picture: "panel" is the big one in the brand panel on
  desktop, "page" is the half-moon peeking over the top of the form on a phone,
  and "hero" is the massive, centered moon that is itself the hero of the login
  page — about min(90%, 720px) wide on desktop and min(118vw, 640px) wide on a
  phone, where most of it is visible. "background" is the full-screen moon
  behind the mobile login form — about 180vmax wide and centered, so it fills
  the whole phone screen. The panel, page, and hero styling is unchanged,
  so the sign-up page and the desktop brand panel are unaffected. The photograph
  turns very slowly (a full turn in two minutes) so the page is alive without
  anything to look at; reduced motion stops it.
*/
export function ChaiMoon({ variant }: { variant: "panel" | "page" | "hero" | "background" | "massive" }) {
  const panel = variant === "panel";
  const hero = variant === "hero";
  const background = variant === "background";
  // "massive": the desktop login panel's moon — a huge circle that fills the lower
  // two thirds of the panel, cropped by its right and bottom edges.
  const massive = variant === "massive";
  return (
    <div
      aria-hidden
      className={
        massive
          ? "pointer-events-none absolute -right-[62%] top-[41%] aspect-square w-[185%]"
          : background
            ? "pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[180vmax] -translate-x-1/2 -translate-y-1/2"
            : hero
            ? "pointer-events-none relative left-1/2 aspect-square w-[min(118vw,640px)] -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:w-[min(90%,720px)]"
            : panel
              ? "pointer-events-none absolute -right-[16%] top-[12%] aspect-square w-[76%]"
              : "pointer-events-none absolute left-1/2 aspect-square -translate-x-1/2 lg:hidden"
      }
      // On a phone only the lower third of the moon shows, curving in from the top
      // edge. --moon is its diameter; the page below it is pushed down to match.
      // The hero variant is in the normal flow and is centered with left-1/2
      // plus -translate-x-1/2 on a phone, so its wider-than-the-screen diameter
      // is clipped equally on both sides; on desktop that offset is cancelled
      // and its flex wrapper centers it instead.
      // The background variant is absolutely centered (left-1/2, top-1/2 with
      // -translate-x-1/2 and -translate-y-1/2) at 180vmax, so it fills the whole
      // phone screen behind the login form; its wrapper clips the overflow and
      // hides it on desktop (lg:hidden).
      style={hero || panel || background || massive ? undefined : { width: "var(--moon)", top: "calc(var(--moon) * -0.64)" }}
    >
      {/* The glow it throws on the page around it. */}
      <div className="absolute -inset-[12%] rounded-full bg-[radial-gradient(closest-side,rgba(236,150,40,0.34),rgba(236,150,40,0.10)_55%,transparent_72%)]" />
      <div className="chai-moon absolute inset-0 overflow-hidden rounded-full shadow-[0_0_80px_-10px_rgba(236,150,40,0.45)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/chai-moon.jpg" alt="" width={900} height={900} decoding="async" className="chai-moon-photo h-full w-full object-cover" />
        {/* The terminator: one side of the moon falls into shadow, which is what
            makes a round photograph read as a moon and not as a button. */}
        <div
          className={
            panel || hero || massive
              ? "absolute inset-0 bg-[radial-gradient(circle_at_30%_28%,transparent_38%,rgba(14,18,10,0.55)_78%,rgba(14,18,10,0.86)_100%)]"
              : "absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,transparent_30%,rgba(14,18,10,0.5)_72%,rgba(14,18,10,0.85)_100%)]"
          }
        />
        <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" />
      </div>
    </div>
  );
}
