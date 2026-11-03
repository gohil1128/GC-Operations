import { sectionLockSettings, isSectionUnlockedByPin } from "@/modules/section-lock/actions";
import { SectionLockButton } from "@/components/section-lock-button";
import { QuickPin } from "@/components/quick-pin";

/*
  The small lock control for the Profit & loss section, in whichever of its
  three states applies to THIS person:
    no PIN of theirs        -> a tiny open padlock that opens "Add a PIN"
    PIN, P&L not locked     -> a tiny open padlock that locks it in one tap
    PIN, P&L open via PIN   -> the existing re-lock button
  Nothing here changes what anyone else sees.
*/
export async function PnlLock({ userId }: { userId: string }) {
  const s = await sectionLockSettings(userId);
  if (!s.hasPin) return <QuickPin mode="set" />;
  if (!s.locked.includes("REPORTS")) return <QuickPin mode="lock" />;
  // Locked for them and we are rendering the page, so it is open because they entered the PIN.
  if (await isSectionUnlockedByPin(userId, "REPORTS")) return <SectionLockButton />;
  return null;
}
