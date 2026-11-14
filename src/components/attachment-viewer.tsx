"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { X, Share, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  View an invoice's attached photo or PDF without leaving the app.

  The old links opened the file as a page of its own, and in the installed app
  that is a full-screen preview with no way back. This fetches the file and shows
  it over the page: a photo fitted to the screen (pinch to zoom), a PDF in the
  browser's own viewer. Close (X, Escape or the backdrop) puts you exactly where
  you were. Share hands the file to the phone's share sheet (Save to Files,
  Print, send) or downloads it on a computer.

  The file is fetched as a blob and shown from a local object URL, so the
  attachment route keeps its strict sandbox headers and nothing is re-served.
*/
/*
  The app's own attachment mark: two sheets, one tucked behind the other, a
  folded corner on the front one. Drawn once here so every "this invoice has a
  file" spot uses the same small sign (not a paperclip).
*/
export function AttachmentMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M7 3.5h5.5L16 7v8.5a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 15.5v-10A2 2 0 0 1 7 3.5Z" />
      <path d="M12.5 3.5V7H16" />
      <path d="M3.5 6.5v9.5a2.5 2.5 0 0 0 2.5 2.5h7" opacity={0.55} />
    </svg>
  );
}

type FileRef = { url: string; mime: string; name: string | null };

export function AttachmentViewer({
  invoiceId,
  label,
  title = "Invoice attachment",
  className,
  children,
}: {
  invoiceId: string;
  label?: string;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [files, setFiles] = React.useState<FileRef[] | null>(null);
  const [index, setIndex] = React.useState(0);
  const [file, setFile] = React.useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const swipe = React.useRef<{ x: number; y: number } | null>(null);

  // Opening: lock the page, listen for keys, and ask which files there are.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setIndex(0);
    fetch(`/api/purchasing/invoices/${invoiceId}/attachments`, { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Couldn't open the attachments.");
        const j = (await r.json()) as { files: FileRef[] };
        if (cancelled) return;
        if (!j.files.length) throw new Error("Nothing is attached to this invoice.");
        setFiles(j.files);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't open the attachments."));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      cancelled = true;
      document.body.style.overflow = prev;
      setFiles(null);
    };
  }, [open, invoiceId]);

  // The file on show, fetched as a blob so the route keeps its strict headers.
  React.useEffect(() => {
    if (!open || !files?.[index]) return;
    let cancelled = false;
    let made: string | null = null;
    setFile(null);
    fetch(files[index].url, { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Couldn't open this file.");
        const blob = await r.blob();
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setFile({ url: made, blob });
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't open this file."));
    return () => { cancelled = true; if (made) URL.revokeObjectURL(made); };
  }, [open, files, index]);

  const count = files?.length ?? 0;
  const go = React.useCallback((d: number) => setIndex((i) => Math.min(Math.max(i + d, 0), Math.max(count - 1, 0))), [count]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  const isPdf = file?.blob.type === "application/pdf";

  const share = async () => {
    if (!file) return;
    const name = `invoice${count > 1 ? `-${index + 1}` : ""}.${isPdf ? "pdf" : "jpg"}`;
    const f = new File([file.blob], name, { type: file.blob.type });
    if (window.matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f], title }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = file.url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className={cn(children ? "" : "lg-press inline-flex h-9 items-center gap-1.5 rounded-full bg-muted px-3.5 text-[13px] font-medium text-foreground hover:bg-muted/70", className)}
        aria-label={children ? label ?? "View attachment" : undefined}
      >
        {children ?? (<><AttachmentMark className="h-4 w-4" /> {label ?? "View attachment"}</>)}
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[90] flex flex-col bg-black text-white">
          <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
            <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <X className="h-5 w-5" />
            </button>
            <span className="min-w-0 truncate text-center text-sm font-medium">
              {title}
              {count > 1 && <span className="ml-2 text-white/60 tabular-nums">{index + 1} of {count}</span>}
            </span>
            <button type="button" onClick={share} disabled={!file} aria-label="Share or save" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40">
              <Share className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div
            className="relative min-h-0 flex-1 overflow-auto [touch-action:pinch-zoom_pan-x_pan-y]"
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
            // A sideways swipe moves between pages (images; a PDF keeps its own scrolling).
            onTouchStart={(e) => { if (e.touches.length === 1) swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
            onTouchEnd={(e) => {
              const s = swipe.current; swipe.current = null;
              if (!s || count < 2) return;
              const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
              if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
            }}
          >
            {error ? (
              <p className="grid h-full place-items-center px-6 text-center text-sm text-white/80">{error}</p>
            ) : !file ? (
              <div className="grid h-full place-items-center" role="status"><Loader2 className="h-6 w-6 animate-spin text-white/70" /><span className="sr-only">Loading</span></div>
            ) : isPdf ? (
              <iframe src={file.url} title={title} className="h-full w-full border-0 bg-white" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={file.url} alt={`${title}${count > 1 ? `, page ${index + 1} of ${count}` : ""}`} className="mx-auto h-full w-full object-contain" />
            )}
            {count > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous file" className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 disabled:opacity-0">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => go(1)} disabled={index >= count - 1} aria-label="Next file" className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 disabled:opacity-0">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
          {count > 1 && (
            <div className="flex justify-center gap-1.5 py-3" aria-hidden>
              {files!.map((_, i) => (
                <span key={i} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-white" : "w-1.5 bg-white/40")} />
              ))}
            </div>
          )}
          <div className="pb-[env(safe-area-inset-bottom,0px)]" />
        </div>,
        document.body,
      )}
    </>
  );
}
