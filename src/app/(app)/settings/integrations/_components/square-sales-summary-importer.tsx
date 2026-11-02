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
  day: { created: number; updated: number };
  totals: {
    netCents: number;
    taxCents: number;
    tipsCents: number;
    cashCents: number;
    cardCents: number;
    txnCount: number;
  };
  cashCloseTouched: boolean;
};

type Event = { id: string; name: string; color: string | null };

// Shared formatter so thousands separators match the rest of the app.
const money = (cents: number) => formatMoney(cents);

// First 8 digits in the filename look like YYYYMMDD.
function inferDateFromFilename(name: string): string | null {
  const cleaned = name.toLowerCase().replace(/[^0-9]/g, "");
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(cleaned);
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  if (y < 2020 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function SquareSalesSummaryImporter({
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
      const res = await fetch("/api/imports/square-sales-summary", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.detectedLabels?.length
            ? `${data.error}\n\nLabels we saw in your file:\n${data.detectedLabels.join(", ")}`
            : (data?.error ?? "Upload failed"),
        );
        toast({ title: "Import failed", description: data?.error ?? "Unknown error", variant: "destructive" });
        return;
      }
      setResult(data as Result);
      toast({
        title: "Sales summary imported",
        description: `${data.businessDate} · ${money(data.totals.netCents)} net · ${data.totals.txnCount} transactions`,
      });
      router.refresh();
    });
  };

  const selectedEvent = events.find((e) => e.id === eventId);

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="ss-file">Sales Summary CSV file</Label>
        <input
          id="ss-file"
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
        <Label htmlFor="ss-date">Business date</Label>
        <Input
          id="ss-date"
          type="date"
          value={businessDate}
          onChange={(e) => setBusinessDate(e.target.value)}
          required
        />
        <span className="text-2xs text-muted-foreground">
          Square&apos;s Sales Summary export has no Date column inside the file — pick the day it covers.
          Auto-guessed from the filename when possible.
        </span>
      </div>

      {events.length > 0 && (
        <div className="grid gap-1.5">
          <Label htmlFor="ss-event">Tag with an event (optional)</Label>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger id="ss-event">
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
        <Upload className="h-3.5 w-3.5" /> {pending ? "Uploading..." : "Upload Sales Summary CSV"}
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/25 bg-destructive-muted text-destructive p-2 text-xs whitespace-pre-wrap">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-md border bg-muted/30 p-2 text-xs space-y-2">
          <div className="flex items-center gap-1 text-success font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {result.businessDate} · {result.totals.txnCount} transactions
            {selectedEvent && <span className="text-muted-foreground"> · tagged &quot;{selectedEvent.name}&quot;</span>}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
            <span><span className="font-medium text-foreground">Net sales:</span> <span className="num">{money(result.totals.netCents)}</span></span>
            <span><span className="font-medium text-foreground">Tax:</span> <span className="num">{money(result.totals.taxCents)}</span></span>
            <span><span className="font-medium text-foreground">Tips:</span> <span className="num">{money(result.totals.tipsCents)}</span></span>
            <span><span className="font-medium text-foreground">Cash:</span> <span className="num">{money(result.totals.cashCents)}</span></span>
            <span><span className="font-medium text-foreground">Card:</span> <span className="num">{money(result.totals.cardCents)}</span></span>
            <span>
              <span className="font-medium text-foreground">Cash close:</span>{" "}
              {result.cashCloseTouched ? "pre-filled" : "no matching close to update"}
            </span>
          </div>
        </div>
      )}

      <div className="text-2xs text-muted-foreground">
        Tip: in Square Dashboard → Reports → <em>Sales summary</em> → set a single day → Export → choose CSV.
        This file is the vertical &quot;Summary&quot; export with rows like <code>Net sales</code>, <code>Tips</code>, <code>Cash</code>, <code>Card</code>.
      </div>
    </form>
  );
}
