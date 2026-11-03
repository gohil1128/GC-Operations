/*
  The logo, for whichever theme is showing.

  The mark is roast brown and rust. Bare on the dark canvas the brown falls to
  1.2:1 and the wordmark vanishes, which is why dark mode used to put the logo
  on a cream plate. A plate is a white tile on a dark page, and reads as a
  sticker. This draws the same artwork in the dark theme's own colours (see
  scripts/gen-logo-dark.py), so the logo sits straight on the page in both.

  Both images are in the markup and the theme class picks one: this is a class
  theme rather than a media query, so <picture> cannot make the choice.
*/
export function BrandLogo({
  alt,
  className,
  onError,
}: {
  alt: string;
  className?: string;
  onError?: () => void;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt={alt} className={`${className ?? ""} dark:hidden`} onError={onError} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-dark.png" alt={alt} className={`${className ?? ""} hidden dark:block`} onError={onError} />
    </>
  );
}
