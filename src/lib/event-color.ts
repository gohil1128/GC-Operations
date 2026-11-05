/*
  An event's colour as a dot.

  Very dark colours — the old espresso default most events still carry —
  vanish on a dark card and read as a hole on a light one, so those fall back
  to the brand marigold. Anything unparseable does too.
*/
export function markerColor(color: string | null | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(color ?? "");
  if (!m) return "hsl(var(--brand))";
  const n = parseInt(m[1], 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return lum < 0.06 ? "hsl(var(--brand))" : `#${m[1]}`;
}
