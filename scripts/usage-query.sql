-- God's Chai Operations — what has actually been used?
-- READ ONLY. Two SELECTs. Nothing is written, changed or deleted.
-- Run both in the Neon SQL editor and send back the output.

-- ============================================================
-- QUERY 1 of 2 — every action the app can record, and whether
-- it ever has. A row with times_used = 0 is a feature that has
-- never been used by anybody, ever.
-- ============================================================
WITH known(action) AS (
  VALUES
    ('business.cost.classes'),
    ('business.overview.cards'),
    ('business.signup'),
    ('business.update'),
    ('business.wipe'),
    ('capital.create'),
    ('capital.delete'),
    ('capital.update'),
    ('cash.close'),
    ('cash.close.delete'),
    ('count.create'),
    ('deposit.add'),
    ('deposit.delete'),
    ('employee.create'),
    ('employee.delete'),
    ('event.create'),
    ('event.delete'),
    ('event.update'),
    ('expense.create'),
    ('expense.delete'),
    ('expense.update'),
    ('import.delete_all'),
    ('import.delete_day'),
    ('import.delete_event_data'),
    ('ingredient.create'),
    ('ingredient.delete'),
    ('ingredient.quick_create'),
    ('ingredient.update'),
    ('invoice.create'),
    ('invoice.delete'),
    ('invoice.item.add'),
    ('invoice.item.remove'),
    ('invoice.set_category'),
    ('invoice.set_event'),
    ('invoice.update'),
    ('item.delete_sales'),
    ('item.set_category'),
    ('item.set_recipe'),
    ('location.create'),
    ('location.delete'),
    ('location.update'),
    ('payout.add'),
    ('payout.delete'),
    ('payout.update'),
    ('po.create'),
    ('po.delete'),
    ('po.receive'),
    ('po.status'),
    ('recipe.bom.update'),
    ('recipe.create'),
    ('recipe.delete'),
    ('recipe.update'),
    ('sections.locked.set'),
    ('sections.pin.remove'),
    ('sections.pin.set'),
    ('sections.unlock'),
    ('sections.unlock.failed'),
    ('shift.create'),
    ('shift.delete'),
    ('square.item_summary.import'),
    ('square.sales_summary.import'),
    ('supplier.create'),
    ('supplier.delete'),
    ('supplier.quick_create'),
    ('user.delete'),
    ('user.invite'),
    ('user.password_change'),
    ('user.password_reset'),
    ('user.reassign_records'),
    ('user.reset_link'),
    ('user.role_change'),
    ('vendor.create'),
    ('vendor.delete'),
    ('vendor.incentive'),
    ('vendor.pay'),
    ('vendor.update'),
    ('waste.record')
)
SELECT
  k.action,
  COUNT(a.id)                       AS times_used,
  MIN(a."createdAt")::date          AS first_used,
  MAX(a."createdAt")::date          AS last_used
FROM known k
LEFT JOIN "AuditLog" a ON a.action = k.action
GROUP BY k.action
ORDER BY times_used ASC, k.action ASC;


-- ============================================================
-- QUERY 2 of 2 — how much data each feature actually holds.
-- This is the signal for the READ-ONLY screens (Profit & loss,
-- Sales, Variance, Labor report), which record no audit rows at
-- all. A screen whose table is empty has nothing to show, so it
-- is clutter in the nav whether or not anyone ever clicked it.
-- ============================================================
SELECT 'CapitalAsset'         AS feature_table, COUNT(*) AS rows FROM "CapitalAsset"
UNION ALL SELECT 'CashClose'            AS feature_table, COUNT(*) AS rows FROM "CashClose"
UNION ALL SELECT 'CashPayout'           AS feature_table, COUNT(*) AS rows FROM "CashPayout"
UNION ALL SELECT 'DailySales'           AS feature_table, COUNT(*) AS rows FROM "DailySales"
UNION ALL SELECT 'Deposit'              AS feature_table, COUNT(*) AS rows FROM "Deposit"
UNION ALL SELECT 'Employee'             AS feature_table, COUNT(*) AS rows FROM "Employee"
UNION ALL SELECT 'Event'                AS feature_table, COUNT(*) AS rows FROM "Event"
UNION ALL SELECT 'Expense'              AS feature_table, COUNT(*) AS rows FROM "Expense"
UNION ALL SELECT 'Ingredient'           AS feature_table, COUNT(*) AS rows FROM "Ingredient"
UNION ALL SELECT 'InventoryCount'       AS feature_table, COUNT(*) AS rows FROM "InventoryCount"
UNION ALL SELECT 'InventoryCountLine'   AS feature_table, COUNT(*) AS rows FROM "InventoryCountLine"
UNION ALL SELECT 'InventoryMovement'    AS feature_table, COUNT(*) AS rows FROM "InventoryMovement"
UNION ALL SELECT 'Invoice'              AS feature_table, COUNT(*) AS rows FROM "Invoice"
UNION ALL SELECT 'InvoiceItem'          AS feature_table, COUNT(*) AS rows FROM "InvoiceItem"
UNION ALL SELECT 'ItemRecipeLink'       AS feature_table, COUNT(*) AS rows FROM "ItemRecipeLink"
UNION ALL SELECT 'PurchaseOrder'        AS feature_table, COUNT(*) AS rows FROM "PurchaseOrder"
UNION ALL SELECT 'PurchaseOrderItem'    AS feature_table, COUNT(*) AS rows FROM "PurchaseOrderItem"
UNION ALL SELECT 'Recipe'               AS feature_table, COUNT(*) AS rows FROM "Recipe"
UNION ALL SELECT 'RecipeIngredient'     AS feature_table, COUNT(*) AS rows FROM "RecipeIngredient"
UNION ALL SELECT 'SalesItem'            AS feature_table, COUNT(*) AS rows FROM "SalesItem"
UNION ALL SELECT 'Shift'                AS feature_table, COUNT(*) AS rows FROM "Shift"
UNION ALL SELECT 'Supplier'             AS feature_table, COUNT(*) AS rows FROM "Supplier"
UNION ALL SELECT 'TimeEntry'            AS feature_table, COUNT(*) AS rows FROM "TimeEntry"
UNION ALL SELECT 'Vendor'               AS feature_table, COUNT(*) AS rows FROM "Vendor"
ORDER BY rows ASC, feature_table ASC;
