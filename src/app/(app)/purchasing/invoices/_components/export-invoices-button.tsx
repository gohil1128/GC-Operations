"use client";

import { useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Downloads the invoice list as CSV. Carries the page's active filters through
// to the export route so the file matches exactly what's on screen — a
// filtered view downloads the filtered rows, not the whole table.
const FILTER_KEYS = ["supplier", "event", "status", "number", "from", "to", "untagged"] as const;

export function ExportInvoicesButton({ count }: { count: number }) {
  const searchParams = useSearchParams();

  const hrefFor = (report: "invoices" | "invoice-items") => {
    const params = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return `/api/exports/${report}${qs ? `?${qs}` : ""}`;
  };

  const disabled = count === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="h-3.5 w-3.5" />
          Download CSV
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-2xs font-normal text-muted-foreground">
          Exporting {count} invoice{count === 1 ? "" : "s"} (current filters)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          {/* download attribute keeps the file save in-tab rather than
              navigating away from the list. */}
          <a href={hrefFor("invoices")} download>
            <FileSpreadsheet className="h-4 w-4" />
            <div className="flex flex-col">
              <span>Invoice summary</span>
              <span className="text-2xs text-muted-foreground">One row per invoice, with tax breakdown</span>
            </div>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={hrefFor("invoice-items")} download>
            <ListTree className="h-4 w-4" />
            <div className="flex flex-col">
              <span>Line items</span>
              <span className="text-2xs text-muted-foreground">One row per item, for pivoting</span>
            </div>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
