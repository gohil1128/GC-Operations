/*
  Premix sales, kept apart.

  Premix is sold in bags at a fixed price, either as a named item (Original
  Masala, Rose, Cardamom) or rung through as an open amount, which Square
  records as an unnamed "Custom Amount" line. Open amounts can only be told
  apart by what they cost, so the rule is the price: a line whose UNIT price
  (before tax and discounts) is one of these is premix.

  Premix lines still count in the day's sales totals, exactly as before. What
  changes is that they get their own item rows, named so they cannot merge with
  a cup of the same flavour, and filed under the category "Premix", so the
  Sales page shows them as a section of their own.

  A refund of a premix line is recognised by the same price, so it nets out
  against the premix row instead of the cup of the same name.
*/

/** Unit prices, in cents, that mean "premix bag". Change here to add one. */
export const PREMIX_PRICES_CENTS: readonly number[] = [1499, 1599];

export const PREMIX_CATEGORY = "Premix";

export function isPremixPrice(unitCents: number): boolean {
  return PREMIX_PRICES_CENTS.includes(unitCents);
}

/**
 * The item row a premix line is filed under. A named item keeps its name, so
 * "Original Masala" at $14.99 is "Premix · Original Masala"; an unnamed open
 * amount keeps its price, so the two sizes stay distinguishable.
 */
export function premixItemName(name: string | null | undefined, unitCents: number): string {
  const n = (name ?? "").trim();
  return n ? `Premix · ${n}` : `Premix · Open amount $${(unitCents / 100).toFixed(2)}`;
}
