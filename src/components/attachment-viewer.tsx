"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { X, Share, Loader2 } from "lucide-react";
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
  const [file, setFile] = React.useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let made: string | null = null;
    setError(null);
    fetch(`/api/purchasing/invoices/${invoiceId}/photo`, { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Nothing is attached to this invoice." : "Couldn't open the attachment.");
        const blob = await r.blob();
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setFile({ url: made, blob });
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't open the attachment."));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      if (made) URL.revokeObjectURL(made);
      setFile(null);
    };
  }, [open, invoiceId]);

  const isPdf = file?.blob.type === "application/pdf";

  const share = async () => {
    if (!file) return;
    const name = `invoice.${isPdf ? "pdf" : "jpg"}`;
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
        <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[90] flex flex-col bg-black/90 text-white">
          <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
            <span className="min-w-0 truncate text-sm font-medium">{title}</span>
            <button
              type="button"
              onClick={share}
              disabled={!file}
              aria-label="Share or save"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40"
            >
              <Share className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div className="relative min-h-0 flex-1 overflow-auto [touch-action:pinch-zoom_pan-x_pan-y]" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
            {error ? (
              <p className="grid h-full place-items-center px-6 text-center text-sm text-white/80">{error}</p>
            ) : !file ? (
              <div className="grid h-full place-items-center" role="status"><Loader2 className="h-6 w-6 animate-spin text-white/70" /><span className="sr-only">Loading</span></div>
            ) : isPdf ? (
              <iframe src={file.url} title={title} className="h-full w-full border-0 bg-white" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={file.url} alt={title} className="mx-auto h-full w-full object-contain" />
            )}
          </div>
          <div className="pb-[env(safe-area-inset-bottom,0px)]" />
        </div>,
        document.body,
      )}
    </>
  );
}
