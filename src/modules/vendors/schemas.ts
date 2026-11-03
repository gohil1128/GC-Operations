import { z } from "zod";

export const vendorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  monthlyFeeDollars: z.coerce.number().min(0).default(0),
  currency: z.string().default("CAD"),
  defaultCategory: z
    .enum(["RENT", "UTILITIES", "MARKETING", "CONTRACTOR", "INSURANCE", "EQUIPMENT", "REPAIRS", "ADMIN", "OTHER"])
    .default("CONTRACTOR"),
  isFlatFee: z.coerce.boolean().default(true),
  notes: z.string().optional().nullable(),
  isActive: z.coerce.boolean().default(true),
});

export const payVendorSchema = z.object({
  vendorId: z.string(),
  businessDate: z.string().min(1),
  amountDollars: z.coerce.number().positive(),
  description: z.string().optional().nullable(),
});

export const incentiveSchema = payVendorSchema.extend({
  performanceNote: z.string().optional().nullable(),
});
