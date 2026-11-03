/*
  What the drawer should reconcile to.

    counted (cash + credit) + banked + paid out − paid in − opening − expected

  Paid-out and paid-in used to be missing from this. Both were collected and
  stored and then left out of the arithmetic, so every legitimate payout —
  reimbursing someone who bought supplies with their own card — came back as a
  shortage of exactly that amount, and the only way to make a day balance was
  not to record it at all. Money that left the till with a receipt is accounted
  for, not missing; money put in that did not come from sales is not a surplus.

  Lives outside actions.ts because that file is "use server", where every
  export has to be an async Server Action — and this is a pure function the
  entry form also runs client-side to show the same number before saving.
*/
export function overShortCentsFor(args: {
  cashCents: number;
  creditCents: number;
  depositCents: number;
  paidOutCents: number;
  paidInCents: number;
  openingCents: number;
  expectedCents: number;
}) {
  return (
    args.cashCents +
    args.creditCents +
    args.depositCents +
    args.paidOutCents -
    args.paidInCents -
    args.openingCents -
    args.expectedCents
  );
}
