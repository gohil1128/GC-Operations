"use client";
import * as React from "react";
import { Camera, FileText, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Attach a photo or a PDF — one button that opens into a small arc of choices.

  It used to be three labelled buttons in a row (Take photo, Choose from
  gallery, Upload PDF), which on a phone wrapped onto a second line and made
  attaching a bill look like the main event of the form. Now it is one 44px
  icon; a tap fans the sources out around it, a tap on one of them opens the
  chooser, and the whole thing folds away.

    camera   — input with `capture`, which opens the camera on phones
    gallery  — plain file input: the photo library on a phone, a file dialog
               on a computer
    PDF      — file dialog filtered to PDFs (only when allowPdf)

  Props are unchanged, so the three places that use it needed no edits.

  THE FILE CHOOSER HAS TO OPEN INSIDE THE TAP. Browsers refuse to open one
  from anything that is not a direct user gesture, so choosing an item calls
  `.click()` on its hidden input synchronously in the click handler and only
  THEN closes the fan. Closing first, or waiting for the animation, would
  make it silently do nothing on some phones.

  The motion is in globals.css (.fan, .fan-item), as transitions rather than
  keyframes so a second tap mid-animation reverses smoothly from wherever it
  is. The icons are unlabelled circles, which is a deliberate trade: they are
  three of the most recognisable glyphs there are, the user asked for it
  compact, and every one carries an accessible name and a tooltip.
*/

export const FAN_RADIUS = 64; // px from the trigger's centre to each choice's centre
export const FAN_SIZE = 44; // px, the circles — the smallest comfortable touch target
// Angles in degrees, 0 = straight right, negative = up. Spread so that
// neighbouring circles keep a gap (the chord at these angles is ~56px for 44px circles).
const ANGLES: Record<number, number[]> = { 1: [0], 2: [-28, 28], 3: [-52, 0, 52] };

/** Where each choice comes to rest, as an offset from the trigger's centre. */
export function fanPositions(count: number): { x: number; y: number }[] {
  return (ANGLES[count] ?? []).map((deg) => {
    const a = (deg * Math.PI) / 180;
    return { x: Math.round(Math.cos(a) * FAN_RADIUS), y: Math.round(Math.sin(a) * FAN_RADIUS) };
  });
}

type Source = "camera" | "gallery" | "pdf";

export function PhotoInput({
  onPick,
  disabled,
  allowPdf = false,
  className,
}: {
  onPick: (file: File) => void;
  disabled?: boolean;
  allowPdf?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const itemRefs = React.useRef<Record<Source, HTMLButtonElement | null>>({ camera: null, gallery: null, pdf: null });
  const inputs = {
    camera: React.useRef<HTMLInputElement>(null),
    gallery: React.useRef<HTMLInputElement>(null),
    pdf: React.useRef<HTMLInputElement>(null),
  };
  const menuId = React.useId();

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onPick(f);
    e.target.value = ""; // allow re-picking the same file
  };

  const sources: { key: Source; label: string; Icon: typeof Camera }[] = [
    { key: "camera", label: "Take photo", Icon: Camera },
    { key: "gallery", label: "Choose from gallery", Icon: ImageIcon },
    ...(allowPdf ? [{ key: "pdf" as const, label: "Upload PDF", Icon: FileText }] : []),
  ];
  const spots = fanPositions(sources.length);
  const isOpen = open && !disabled;

  // Escape closes it, and so does a click anywhere outside. Listeners exist only
  // while it is open.
  //
  // Outside is a CLICK, not a pointerdown. The dim behind the fan is the normal
  // way to dismiss it, and that is only safe to do on click: closing at
  // pointerdown would switch the dim's pointer-events off before the click
  // landed, so the click would fall through and press whatever was underneath.
  React.useEffect(() => {
    if (!isOpen) return;
    const away = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("click", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", away);
      document.removeEventListener("keydown", esc);
    };
  }, [isOpen]);

  const toggle = (e: React.MouseEvent) => {
    const next = !isOpen;
    setOpen(next);
    // detail === 0 means the click came from the keyboard. Then move focus onto
    // the first choice, since a keyboard user cannot see where the fan landed.
    if (next && e.detail === 0) requestAnimationFrame(() => itemRefs.current[sources[0].key]?.focus());
  };

  const choose = (key: Source) => {
    inputs[key].current?.click(); // synchronously, inside the gesture — see above
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      data-open={isOpen}
      className={cn("fan relative inline-block h-11 w-11 shrink-0", isOpen ? "z-30" : "z-10", className)}
    >
      <input ref={inputs.camera} type="file" accept="image/*" capture="environment" onChange={handle} className="hidden" tabIndex={-1} />
      <input ref={inputs.gallery} type="file" accept="image/*" onChange={handle} className="hidden" tabIndex={-1} />
      {allowPdf && <input ref={inputs.pdf} type="file" accept="application/pdf,.pdf" onChange={handle} className="hidden" tabIndex={-1} />}

      {/* The dim. Inside the root so a click on it counts as "this component's", which is what
          lets it swallow the tap rather than pass it to the page underneath. */}
      <span aria-hidden onClick={() => setOpen(false)} className="fan-scrim fixed inset-0 -z-10 bg-background/50" />

      {/* inert while closed: invisible buttons must not be reachable by Tab or a screen reader. */}
      <div id={menuId} role="group" aria-label="Attach from" inert={!isOpen}>
        {sources.map(({ key, label, Icon }, i) => {
          return (
            <button
              key={key}
              ref={(el) => { itemRefs.current[key] = el; }}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => choose(key)}
              style={
                {
                  "--tx": `${spots[i].x}px`,
                  "--ty": `${spots[i].y}px`,
                  "--i": i,
                  // Closing unfurls in reverse so the last to appear is the first to go.
                  "--out": sources.length - 1 - i,
                } as React.CSSProperties
              }
              className={cn(
                "fan-item absolute left-0 top-0 grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-brand-ink",
                "shadow-[0_8px_18px_-8px_hsl(var(--shadow-color)/0.65)] hover:bg-accent",
              )}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </button>
          );
        })}
      </div>

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label="Attach a photo or PDF"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={toggle}
        className={cn(
          "relative z-10 grid h-11 w-11 place-items-center rounded-full border transition-colors duration-150",
          "disabled:pointer-events-none disabled:opacity-50",
          isOpen
            ? "border-transparent bg-highlight text-highlight-foreground"
            : "border-border bg-card text-brand-ink hover:bg-accent",
        )}
      >
        <Paperclip className="fan-glyph fan-glyph-shut absolute h-5 w-5" aria-hidden />
        <X className="fan-glyph fan-glyph-open absolute h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
