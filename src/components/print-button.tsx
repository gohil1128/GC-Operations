"use client";
import * as React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

/*
  Print, which is also how a PDF gets made.

  Every browser offers "Save as PDF" as a print destination, so the print
  stylesheet in globals.css is the PDF export — without a rendering service,
  a second copy of the layout, or a library whose output would drift from
  what the page actually says.

  data-print="keep" so the print rules do not hide the button that started
  the print. It is still gone from the printed sheet: the toolbar around it
  carries data-print="hide", which wins by being an ancestor.

  An installed phone app often does nothing at all when asked to print (iOS
  never opens a print sheet from a home-screen app). So the button checks
  whether a print was actually started; if not, it hands the report to the
  share sheet as a standalone page, where Print and Save to Files are offered
  and the app is left exactly where it was.
*/
export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  const onPrint = React.useCallback(async () => {
    let started = false;
    const mark = () => { started = true; };
    window.addEventListener("beforeprint", mark, { once: true });
    try { window.print(); } catch { /* handled below */ }
    await new Promise((r) => setTimeout(r, 700));
    window.removeEventListener("beforeprint", mark);
    if (started) return;

    try {
      const main = document.getElementById("main");
      if (!main) throw new Error("nothing to print");
      const clone = main.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[data-print="hide"]').forEach((el) => el.remove());
      clone.querySelectorAll(".print-show[hidden]").forEach((el) => el.removeAttribute("hidden"));
      const head = [...document.querySelectorAll('link[rel="stylesheet"], style')]
        .map((el) => {
          if (el instanceof HTMLLinkElement) return `<link rel="stylesheet" href="${new URL(el.href, location.href).href}">`;
          return el.outerHTML;
        })
        .join("");
      const html = `<!doctype html><html class="${document.documentElement.className}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${document.title}</title>${head}</head><body>${clone.outerHTML}</body></html>`;
      const file = new File([html], `${(document.title || "report").replace(/[^\w-]+/g, "-")}.html`, { type: "text/html" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: document.title });
        return;
      }
      throw new Error("sharing is not available");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      toast({ title: "Couldn't open the print sheet", description: "Open this page in your browser and print from there.", variant: "destructive" });
    }
  }, []);

  return (
    <Button type="button" variant="outline" size="sm" data-print="keep" onClick={onPrint}>
      <Printer className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
