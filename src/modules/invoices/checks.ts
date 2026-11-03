/*
  What a bill cannot say.

  Four live invoices had a total below their own subtotal — the paperwork
  claiming the business paid less than the goods on it came to, with no
  discount line to explain the difference. It happens because the total is
  never typed: it is subtotal + GST + PST + shipping − rebate, and a rebate
  entered into the wrong box, or a whole bill amount typed into the rebate
  field, drags the total under the subtotal without anything on the screen
  objecting. Those invoices then flow straight into cost of goods, where a
  wrong figure is indistinguishable from a right one.

  Two different things are wrong here, and they deserve different answers.

  A rebate bigger than everything else on the bill would make the total
  negative — the supplier paying the business to take the goods. That is not
  a bill, so it is refused outright.

  A total merely below the subtotal is a discount, and discounts are real: a
  case price, a loyalty credit, a damaged-box allowance. Refusing those would
  make the app wrong about a bill the operator is holding in their hand. So
  it is flagged and left alone, prominently enough that the four already in
  the data get looked at, quietly enough that a genuine discount can be saved.

  Pure and dependency-free: the server action refuses on it, and two screens
  render it.
*/

export type InvoiceAmounts = {
  subtotalCents: number;
  gstCents: number;
  pstCents: number;
  shippingCents: number;
  rebateCents: number;
};

export function invoiceTotalCents(a: InvoiceAmounts): number {
  return a.subtotalCents + a.gstCents + a.pstCents + a.shippingCents - a.rebateCents;
}

/*
  The refusal, or null. Returns a sentence to show the operator rather than a
  code: there is one rule, and the number that broke it is the useful part.
*/
export function impossibleInvoiceReason(a: InvoiceAmounts): string | null {
  const total = invoiceTotalCents(a);
  if (total < 0) {
    const rest = a.subtotalCents + a.gstCents + a.pstCents + a.shippingCents;
    return (
      `A rebate of ${dollars(a.rebateCents)} is more than the ${dollars(rest)} on the rest of ` +
      `the bill, which would make the invoice total ${dollars(total)}. Check the rebate — a ` +
      `credit note larger than the order is its own invoice, not a line on this one.`
    );
  }
  return null;
}

/*
  The flag, or null. A saved invoice whose total came out under its subtotal —
  worth a second look, not worth blocking.
*/
export function invoiceDiscountWarning(a: Pick<InvoiceAmounts, "subtotalCents"> & { totalCents: number }): string | null {
  if (a.totalCents >= a.subtotalCents) return null;
  return (
    `The total (${dollars(a.totalCents)}) is under the amount before tax ` +
    `(${dollars(a.subtotalCents)}), so the rebate is larger than the tax and shipping put ` +
    `together. That is right for a discounted bill and wrong for a mistyped rebate.`
  );
}

export function isBelowSubtotal(a: { subtotalCents: number; totalCents: number }): boolean {
  return a.totalCents < a.subtotalCents;
}

/*
  Local rather than lib/money's formatMoney: this file is imported by a server
  action, a server component and a client component, and the message has to
  read the same in all three. Cents in, plain dollars out, no locale.
*/
function dollars(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}
