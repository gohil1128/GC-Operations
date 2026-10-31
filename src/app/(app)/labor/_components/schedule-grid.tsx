"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { dayKeyInZone, timeInZone, businessDayFromIso, isoFromBusinessDay, fmtBusinessDate } from "@/lib/date";
import { Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createShiftAction, deleteShiftAction } from "@/modules/labor/actions";
import { toast } from "@/components/ui/use-toast";

type Employee = { id: string; name: string; position: string; rateCents: number };
type Shift = {
  id: string; employeeId: string; employeeName: string; position: string;
  start: string; end: string; scheduledMinutes: number; actualMinutes: number | null;
};

export function ScheduleGrid({
  weekStart, employees, shifts, timezone,
}: {
  weekStart: string; employees: Employee[]; shifts: Shift[];
  /*
    The zone the business trades in. Shifts are bucketed and their times printed
    in it, not in whatever zone the process happens to be in.

    Without this the server rendered the grid in UTC and the browser re-rendered
    it in the viewer's zone: React reported a hydration mismatch, and a 7pm
    Vancouver shift sat under the NEXT day's column on the server before jumping
    back a column once the client took over.
  */
  timezone: string;
}) {
  /*
    The seven columns are plain calendar dates (YYYY-MM-DD), stepped in UTC from
    weekStart so the same string is produced on the server and in the browser.
    Shifts are bucketed to the calendar date they fall on IN THE BUSINESS'S
    ZONE — the same kind of value — so the two line up.

    Previously both sides were Date objects formatted with date-fns, which reads
    the process timezone: the server said "Mon Sep 14" and a Vancouver browser
    said "Sun Sep 13" for the same column.
  */
  const startMs = businessDayFromIso(weekStart.slice(0, 10)).getTime();
  const days = Array.from({ length: 7 }, (_, i) =>
    isoFromBusinessDay(new Date(startMs + i * 86_400_000)),
  );
  const router = useRouter();

  const [open, setOpen] = React.useState<{ day: string; employeeId?: string } | null>(null);
  const [pending, startTx] = React.useTransition();

  const shiftsByCell = React.useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const s of shifts) {
      const day = dayKeyInZone(s.start, timezone);
      const key = `${s.employeeId}__${day}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    return m;
  }, [shifts, timezone]);

  const totalsByEmployee = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const s of shifts) m.set(s.employeeId, (m.get(s.employeeId) ?? 0) + s.scheduledMinutes);
    return m;
  }, [shifts]);

  const totalsByDay = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const s of shifts) {
      const k = dayKeyInZone(s.start, timezone);
      m.set(k, (m.get(k) ?? 0) + s.scheduledMinutes);
    }
    return m;
  }, [shifts, timezone]);

  const totalScheduled = shifts.reduce((a, s) => a + s.scheduledMinutes, 0);
  const totalCostCents = shifts.reduce((a, s) => {
    const emp = employees.find((e) => e.id === s.employeeId);
    if (!emp) return a;
    return a + Math.round((s.scheduledMinutes / 60) * emp.rateCents);
  }, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span><span className="text-muted-foreground">Scheduled hrs:</span> <span className="num font-semibold">{(totalScheduled / 60).toFixed(1)}</span></span>
        <span><span className="text-muted-foreground">Scheduled cost:</span> <span className="num font-semibold">${(totalCostCents / 100).toFixed(0)}</span></span>
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left p-2 sticky left-0 bg-muted/30 z-10 min-w-[160px]">Employee</th>
              {days.map((d) => (
                <th key={d} className="text-left p-2 min-w-[120px]">
                  <div className="font-medium">{fmtBusinessDate(d, "EEE")}</div>
                  <div className="text-2xs text-muted-foreground">{fmtBusinessDate(d, "MMM d")}</div>
                  <div className="text-2xs text-muted-foreground mt-1">{((totalsByDay.get(d) ?? 0) / 60).toFixed(1)}h</div>
                </th>
              ))}
              <th className="text-right p-2">Week</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-t">
                <td className="p-2 sticky left-0 bg-card z-10">
                  <div className="font-medium text-sm">{emp.name}</div>
                  <div className="text-2xs text-muted-foreground">{emp.position} · ${(emp.rateCents / 100).toFixed(2)}/hr</div>
                </td>
                {days.map((d) => {
                  const key = `${emp.id}__${d}`;
                  const cellShifts = shiftsByCell.get(key) ?? [];
                  return (
                    <td key={d} className="p-1 align-top">
                      <div className="flex flex-col gap-1">
                        {cellShifts.map((s) => (
                          <div key={s.id} className="group relative rounded border bg-secondary/50 px-1.5 py-1">
                            <div className="font-medium num">{timeInZone(s.start, timezone)}–{timeInZone(s.end, timezone)}</div>
                            <div className="text-2xs text-muted-foreground">{(s.scheduledMinutes / 60).toFixed(1)}h · {s.position}</div>
                            {s.actualMinutes !== null && (
                              <div className={cn("text-2xs num", Math.abs(s.actualMinutes - s.scheduledMinutes) > 10 ? "text-warning" : "text-success")}>
                                actual {(s.actualMinutes / 60).toFixed(1)}h
                              </div>
                            )}
                            <button
                              onClick={() => startTx(async () => {
                                try {
                                  await deleteShiftAction(s.id);
                                  toast({ title: "Shift removed" });
                                  router.refresh();
                                } catch (err: any) { toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" }); }
                              })}
                              className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setOpen({ day: d, employeeId: emp.id })}
                          className="flex items-center justify-center rounded border border-dashed text-muted-foreground hover:bg-secondary/50 px-1.5 py-1 text-2xs"
                          aria-label="Add shift"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  );
                })}
                <td className="p-2 text-right num">{((totalsByEmployee.get(emp.id) ?? 0) / 60).toFixed(1)}h</td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr><td colSpan={9} className="text-center text-sm text-muted-foreground py-8">No active employees. Add one in Employees.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add shift {open ? `on ${fmtBusinessDate(open.day, "EEE MMM d")}` : ""}</DialogTitle>
          </DialogHeader>
          {open && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const date = open.day;
                const startTime = String(fd.get("startTime"));
                const endTime = String(fd.get("endTime"));
                const employeeId = String(fd.get("employeeId"));
                const position = String(fd.get("position"));
                startTx(async () => {
                  try {
                    await createShiftAction({
                      employeeId,
                      position,
                      start: `${date}T${startTime}`,
                      end: `${date}T${endTime}`,
                      notes: null,
                    });
                    toast({ title: "Shift added" });
                    setOpen(null);
                    router.refresh();
                  } catch (err: any) { toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" }); }
                });
              }}
              className="grid gap-3"
            >
              <div className="grid gap-1.5">
                <Label>Employee</Label>
                <Select name="employeeId" defaultValue={open.employeeId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} — {e.position}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="position">Position</Label>
                <Input id="position" name="position" defaultValue={employees.find((e) => e.id === open.employeeId)?.position ?? ""} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label htmlFor="startTime">Start</Label><Input id="startTime" name="startTime" type="time" defaultValue="09:00" required /></div>
                <div className="grid gap-1.5"><Label htmlFor="endTime">End</Label><Input id="endTime" name="endTime" type="time" defaultValue="17:00" required /></div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(null)}>Cancel</Button>
                <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Add shift"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
