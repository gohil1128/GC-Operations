import { z } from "zod";

export const cashCloseSchema = z.object({
  businessDate: z.string(),
  openingDollars: z.coerce.number().min(0),
  closingDollars: z.coerce.number().min(0),
  cashDollars: z.coerce.number().min(0).default(0),
  creditDollars: z.coerce.number().min(0).default(0),
  safeCountDollars: z.coerce.number().min(0).default(0),
  depositDollars: z.coerce.number().min(0).default(0),
  paidInDollars: z.coerce.number().min(0).default(0),
  expectedDollars: z.coerce.number().min(0),
  weather: z.string().optional().nullable(),
  specialEvents: z.string().optional().nullable(),
  eventId: z.string().optional().nullable(),
  checklist: z.array(z.object({ label: z.string(), done: z.boolean() })).default([]),
  notes: z.string().optional().nullable(),
});

export const depositSchema = z.object({
  businessDate: z.string(),
  amountDollars: z.coerce.number().positive(),
  sequence: z.coerce.number().int().optional().nullable(),
  bagCode: z.string().optional().nullable(),
  preparedBy: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const payoutSchema = z.object({
  businessDate: z.string(),
  amountDollars: z.coerce.number().positive(),
  kind: z.enum(["REIMBURSEMENT", "SUPPLIER", "OTHER"]).default("REIMBURSEMENT"),
  // Required, unlike a deposit's notes: cash out of the drawer with no stated
  // reason is the thing this record exists to stop.
  reason: z.string().trim().min(1, "Say what the money was for"),
  paidTo: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
});

/*
  The same payout, minus the day it belongs to. Editing corrects what was
  written down; it does not move cash from one drawer to another, which would
  mean re-balancing two closes.
*/
export const payoutEditSchema = payoutSchema.omit({ businessDate: true });

export const verifyCloseSchema = z.object({
  closeId: z.string(),
});
