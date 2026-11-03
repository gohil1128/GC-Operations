import { redirect } from "next/navigation";

/*
  /inventory/new did not exist, and somebody went looking for it.

  Fair enough: /cash/new, /purchasing/new and /purchasing/invoices/new are
  all real pages, so the app teaches that pattern and then 404s on the one
  place it does not hold. Adding an ingredient is a dialog on the inventory
  page rather than a page of its own, which is the right shape for six fields
  — but that is an implementation detail nobody typing a URL can know.

  So the URL exists and opens the dialog. No page of its own to keep in step
  with the one that does the work.
*/
export default function NewIngredientRedirect() {
  redirect("/inventory?new=1");
}
