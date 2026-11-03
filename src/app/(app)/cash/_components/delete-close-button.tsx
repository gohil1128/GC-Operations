"use client";
import { Trash2 } from "lucide-react";
import { DeleteButton } from "@/components/delete-button";
import { deleteCashCloseAction } from "@/modules/cash/actions";

/*
  Delete a cash close from the list, without opening the day first.

  Same action and same rules as the Delete entry button on the day's own page
  (deleteCashCloseAction): a verified close takes the verify capability to
  remove, so for anyone else the button is simply not offered. The deposits and
  payouts recorded on that day are NOT removed with it — they are separate
  entries, possibly made by someone else — and the confirmation says so.
*/
export function DeleteCloseRowButton({
  closeId, dateLabel, verified, canVerify, compact = false,
}: {
  closeId: string;
  dateLabel: string;
  verified: boolean;
  canVerify: boolean;
  compact?: boolean;
}) {
  if (verified && !canVerify) return null;
  return (
    <DeleteButton
      action={async () => {
        const res = await deleteCashCloseAction(closeId);
        // The action returns its error rather than throwing (production redacts thrown
        // server-action messages); throwing here, on the client, is what shows it.
        if ("error" in res) throw new Error(res.error);
      }}
      itemLabel="cash close"
      itemName={dateLabel}
      confirmText={
        `This removes the cash close for ${dateLabel}: the counts, the over/short and the notes. It can't be undone.` +
        " Any deposits and payouts recorded on that day stay; delete those from the day's entry if they were mistakes too." +
        (verified ? " This close has been verified." : "")
      }
      successMessage="Cash close deleted"
      size={compact ? "icon-sm" : "sm"}
      variant={compact ? "ghost" : "danger"}
    >
      {compact ? <Trash2 /> : (<><Trash2 /> Delete</>)}
    </DeleteButton>
  );
}
