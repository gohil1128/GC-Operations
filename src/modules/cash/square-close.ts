import type { Prisma, PrismaClient } from "@prisma/client";
import { overShortCentsFor } from "./reconcile";

type Db = PrismaClient | Prisma.TransactionClient;

/*
  Fill in the parts of a day's cash close that Square actually knows.

  Shared by the Sales Summary CSV import and the live Square sync, so both
  treat a close the same way.

  Square is the authority on card takings (nobody counts those by hand) and on
  the day's net sales, which is what "expected" means on the close form. It is
  NOT the authority on the cash count: that includes the opening float and is
  short whatever was paid out of the drawer, and only the person who counted
  it knows the figure, so it is never touched. Over/short is then re-derived
  with overShortCentsFor, the same function the form and the cash actions use.

  Only an existing close is updated. Square cannot make one up: a close is a
  record that somebody counted a drawer.
*/
export async function applySquareToClose(
  db: Db,
  args: { locationId: string; businessDate: Date; netCents: number; cardCents: number },
): Promise<boolean> {
  const { locationId, businessDate, netCents, cardCents } = args;
  const close = await db.cashClose.findFirst({ where: { locationId, businessDate } });
  if (!close) return false;

  // Derived from the rows, the way the cash actions do it, rather than
  // trusting the totals cached on the close.
  const [deposits, payouts] = await Promise.all([
    db.deposit.findMany({ where: { locationId, businessDate } }),
    db.cashPayout.findMany({ where: { locationId, businessDate } }),
  ]);
  const depositCents = deposits.reduce((a, d) => a + d.amountCents, 0);
  const paidOutCents = payouts.reduce((a, p) => a + p.amountCents, 0);
  const expectedCents = netCents;
  const creditCents = cardCents > 0 ? cardCents : close.creditCents;
  const overShortCents = overShortCentsFor({
    cashCents: close.cashCents,
    creditCents,
    depositCents,
    paidOutCents,
    paidInCents: close.paidInCents,
    openingCents: close.openingCents,
    expectedCents,
  });
  await db.cashClose.update({
    where: { id: close.id },
    data: { creditCents, depositCents, paidOutCents, expectedCents, overShortCents },
  });
  return true;
}
