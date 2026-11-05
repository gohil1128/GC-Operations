"use client";
import * as React from "react";
import { formatMoney } from "@/lib/money";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

type Result = {
  businessDate: string;
  day: { created: number; updated: number; netCents: number; taxCents: number };
  items: { created: number; updated: number; total: number };
  totalQty: number;
  detected: Record<string, string | null>;
  errors: { row: number; reason: string }[];
};

type Event = { id: string; name: string; color: string | null };

// Shared formatter so thousands separators match the rest of the app.
const money = (cents: number) => formatMoney(cents);

// Best-effort parse of the date range from the Square filename:
//   item-sales-summary-2026-06-06-2026-06-06.csv
//   itemsalessummary2026060620260606.csv
// We use the start date as the default for the import field.
function inferDateFromFilename(name: string): string | null {
  const cleaned = name.toLowerCase().replace(/[^0-9]/g, "");
  // first 8 digits look like YYYYMMDD
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(cleaned);
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  if (y < 2020 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function SquareItemSummaryImporter({
  events,
  defaultEventId,
}: {
  events: Event[];
  defaultEventId?: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<Result | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [eventId, setEventId] = React.useState<string>(defaultEventId ?? "none");
  const [businessDate, setBusinessDate] = React.useState<string>("");
  const [fileName, setFileName] = React.useState<string>("");

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    // Pre-fill the business date from the filename if we recognize the pattern.
    if (!businessDate) {
      const guess = inferDateFromFilename(f.name);
      if (guess) setBusinessDate(guess);
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!(fd.get("file") instanceof File)) return;
    if (!businessDate) {
      setError("Pick the business date for this report — the file has no Date column.");
      return;
    }
    fd.set("eventId", eventId);
    fd.set("businessDate", businessDate);
    setError(null);
    setResult(null);
    start(async () => {
      const res = await fetch("/api/imports/square-item-summary", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Upload failed");
        if (data?.detectedColumns) {
          setError(`${data.error}\n\nColumns we saw in your file:\n${data.detectedColumns.join(", ")}`);
        }
        toast({ title: "Import failed", description: data?.error ?? "Unknown error", variant: "destructive" });
        return;
      }
      setResult(data as Result);
      toast({
        title: "Item summary imported",
        description: `${data.items.total} items · ${money(data.day.netCents)} net · ${data.businessDate}`,
      });
      router.refresh();
    });
  };

  const selectedEvent = events.find((e) => e.id === eventId);

  return (
    <form onSubmit={onSubmit} className="grid min-w-0 gap-3 [&>*]:min-w-0">
      <div className="grid gap-1.5">
        <Label htmlFor="sis-file">CSV file</Label>
        <input
          id="sis-file"
          type="file"
          name="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="text-sm"
          required
        />
        {fileName && <span className="text-2xs text-muted-foreground">{fileName}</span>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="sis-date">Business date</Label>
        <Input
          id="sis-date"
          type="date"
          value={businessDate}
          onChange={(e) => setBusinessDate(e.target.value)}
          required
        />
        <span className="text-2xs text-muted-foreground">
          This file has no Date column — pick the date the items were sold on.
          If your Square export covers a range, run one import per day.
        </span>
      </div>

      {events.length > 0 && (
        <div className="grid gap-1.5">
          <Label htmlFor="sis-event">Tag with an event (optional)</Label>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger id="sis-event">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No event tag</SelectItem>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-foreground/25" style={{ backgroundColor: e.color ?? "hsl(var(--muted-foreground))" }} />
                    {e.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button type="submit" size="sm" variant="brand" disabled={pending}>
        <Upload className="h-3.5 w-3.5" /> {pending ? "Uploading..." : "Upload Item Summary CSV"}
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/25 bg-destructive-muted text-destructive p-2 text-xs whitespace-pre-wrap">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-md border bg-muted/30 p-2 text-xs space-y-1">
          <div className="flex items-center gap-1 text-success font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {result.businessDate} · {result.items.total} item line{result.items.total === 1 ? "" : "s"} · {money(result.day.netCents)} net · {result.totalQty.toLocaleString()} units sold
            {selectedEvent && <span className="text-muted-foreground"> · tagged &quot;{selectedEvent.name}&quot;</span>}
          </div>
          <div className="text-muted-foreground">
            <span className="font-medium">Detected columns:</span>{" "}
            Item: <code>{result.detected.itemCol ?? "—"}</code>,{" "}
            Qty: <code>{result.detected.qtyCol ?? "—"}</code>,{" "}
            Net: <code>{result.detected.netCol ?? result.detected.grossCol ?? "—"}</code>,{" "}
            Tax: <code>{result.detected.taxCol ?? "—"}</code>
          </div>
          {result.errors?.length > 0 && (
            <div className="text-destructive">
              <span className="font-medium">{result.errors.length} error{result.errors.length === 1 ? "" : "s"}:</span>
              <ul className="list-disc list-inside">
                {result.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>Row {e.row}: {e.reason}</li>
                ))}
                {result.errors.length > 5 && <li>...and {result.errors.length - 5} more</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="text-2xs text-muted-foreground">
        Tip: in Square Dashboard → Reports → Items → <em>Item Sales</em> → set the date range → Export. This is the report with columns
        like <code>Item Name, Category, Items Sold, Net Sales</code>. For a single day, the file is fully usable. For multi-day ranges,
        Square sums everything across the range so you should either run one import per day or just stash the whole range under one date.
      </div>
    </form>
  );
}
