-- AuditLog.userId was required with the default ON DELETE RESTRICT, which
-- meant deleting ANY user who had ever taken an action in the app (which is
-- effectively everyone, since almost every write is audited) was permanently
-- blocked -- regardless of the owner/manager permission checks in code,
-- which already allowed it. The audit trail has no viewer UI, so the row is
-- worth keeping after the actor is gone; only the FK needs to stop blocking.
-- Every other user-created record (invoices, expenses, purchase orders, cash
-- closes, inventory counts) is untouched here and stays required -- those
-- get reassigned to a successor instead of nulled, since real reporting
-- depends on them pointing at a real person.
ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
