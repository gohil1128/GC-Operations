"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/*
  Print, which is also how a PDF gets made.

  Every browser offers "Save as PDF" as a print destination, so the print
  stylesheet in globals.css is the PDF export — without a rendering service,
  a second copy of the layout, or a library whose output would drift from
  what the page actually says.

  data-print="keep" so the print rules do not hide the button that started
  the print. It is still gone from the printed sheet: the toolbar around it
  carries data-print="hide", which wins by being an ancestor.
*/
export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-print="keep"
      onClick={() => window.print()}
    >
      <Printer className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
