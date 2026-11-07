"use client";
import * as React from "react";
import { toast } from "@/components/ui/use-toast";

/*
  Keeps file downloads inside the app.

  Tapping a CSV link in an installed phone app navigates the whole window to
  the file, and on iOS that opens a full-screen preview with no way back to the
  app. So every link to /api/exports/... is fetched here instead: on a phone it
  goes through the share sheet (Save to Files, Open in Numbers, ...), which
  appears over the app and returns to it; elsewhere it is saved as a normal
  download. The page itself never navigates.
*/
function filenameOf(res: Response, url: string) {
  const cd = res.headers.get("content-disposition") ?? "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  if (m) { try { return decodeURIComponent(m[1]); } catch { return m[1]; } }
  return url.split("?")[0].split("/").pop() || "download.csv";
}

export function ExportInterceptor() {
  React.useEffect(() => {
    const onClick = async (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || !u.pathname.startsWith("/api/exports/")) return;
      e.preventDefault();
      try {
        const res = await fetch(u.pathname + u.search, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const name = filenameOf(res, u.pathname);
        const file = new File([blob], name, { type: blob.type || "text/csv" });
        const touch = window.matchMedia("(pointer: coarse)").matches;
        if (touch && navigator.canShare?.({ files: [file] })) {
          try { await navigator.share({ files: [file], title: name }); return; }
          catch (err) { if ((err as Error).name === "AbortError") return; /* else fall through to a download */ }
        }
        const href = URL.createObjectURL(blob);
        const dl = document.createElement("a");
        dl.href = href; dl.download = name;
        document.body.appendChild(dl); dl.click(); dl.remove();
        setTimeout(() => URL.revokeObjectURL(href), 10_000);
      } catch (err) {
        toast({ title: "Couldn't download the file", description: String((err as Error).message ?? err), variant: "destructive" });
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
