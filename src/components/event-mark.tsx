import { cn } from "@/lib/utils";

/*
  An event's identifier: a small monogram tile (its initials) in a colour drawn
  from a fixed palette by the event's name. It replaces the plain colour dot,
  which was not an identifier at all: most events share a colour, so a dot told
  you nothing about which event a row belonged to. The same name always gives
  the same tile, on every screen, so an event is recognisable at a glance.
*/
const PALETTE = [
  "#F2A93C", "#FF7A66", "#F5BD1C", "#8FB573", "#6FA8C9", "#A98BD1",
  "#E58CB0", "#C98F5A", "#5BB8A6", "#D96B4A", "#9BA84A", "#7C8FE0",
];
const SKIP = new Set(["the", "of", "and", "at", "in", "a", "an", "for", "&", "with"]);

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function eventInitials(name: string) {
  const words = name.replace(/[()]/g, " ").split(/\s+/).filter(Boolean);
  const keep = words.filter((w) => !SKIP.has(w.toLowerCase()));
  const w = keep.length ? keep : words;
  if (w.length === 0) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[1][0]).toUpperCase();
}

export function eventMarkColor(name: string) {
  return PALETTE[hash(name.trim().toLowerCase()) % PALETTE.length];
}

const SIZES = {
  xs: "h-[18px] min-w-[18px] rounded-md px-0.5 text-[9px]",
  sm: "h-6 min-w-6 rounded-lg px-1 text-[10px]",
  md: "h-8 min-w-8 rounded-[10px] px-1 text-xs",
  lg: "h-11 min-w-11 rounded-xl px-1 text-base",
} as const;

export function EventMark({ name, size = "xs", className }: { name: string; size?: keyof typeof SIZES; className?: string }) {
  const c = eventMarkColor(name);
  return (
    <span
      aria-hidden
      className={cn("inline-grid shrink-0 place-items-center font-semibold leading-none tracking-tight text-foreground", SIZES[size], className)}
      style={{ backgroundColor: `color-mix(in srgb, ${c} 28%, transparent)`, boxShadow: `inset 0 0 0 1px ${c}` }}
    >
      {eventInitials(name)}
    </span>
  );
}
