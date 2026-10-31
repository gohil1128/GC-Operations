import type { PayoutKind } from "@prisma/client";

/*
  Shared between the entry form and the payouts list on /cash, so the two
  cannot end up calling the same kind different things.
*/
export const PAYOUT_KINDS: { value: PayoutKind; label: string; blurb: string }[] = [
  { value: "REIMBURSEMENT", label: "Reimbursement", blurb: "Someone paid for it themselves and took the cash back" },
  { value: "SUPPLIER", label: "Paid a supplier", blurb: "Paid in cash straight out of the till" },
  { value: "OTHER", label: "Other", blurb: "Anything else that left the drawer" },
];

export function payoutKindLabel(kind: PayoutKind | string): string {
  return PAYOUT_KINDS.find((k) => k.value === kind)?.label ?? String(kind);
}
