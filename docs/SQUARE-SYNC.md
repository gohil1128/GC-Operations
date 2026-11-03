# Square sales sync

Every three hours the app reads your completed Square sales and files them as
daily sales and per-item sales. There's no Sales Summary or Item Sales CSV to
upload after a market any more. This page covers what it does, the one-time
setup, and what to check the first time.

**Read this first: it has not been run against a real Square account yet.**
The logic is tested against a real database with a fake Square account: how a
day's numbers are worked out, what it overwrites and what it leaves alone,
events, refunds, timezones, retries. Whether Square's live responses match what
the code expects can only be proven with your account. Do the first sync by
hand and compare one day against Square's own Sales Summary (steps at the end).

---

## What it does

- **Daily totals:** net sales, tax, tips and number of sales for each day,
  matching Square's Sales Summary. Net sales are after discounts and before tax
  and tips.
- **What sold:** one row per item per day, so the item breakdown and recipe
  costing fill in by themselves. New items get the category they have in
  Square. A category you've set in the app is kept.
- **Premix** is kept apart. Any line sold at $14.99 or $15.99 each (before tax) is filed as its own
  "Premix · <name>" item, or "Premix · Open amount $14.99" for an unnamed open amount, under the
  category **Premix**. The Sales page shows a Premix card and a Premix category. The day's totals are
  unchanged: it is the same money shown separately. To change the prices, edit `PREMIX_PRICES_CENTS`
  in `src/modules/square/premix.ts`. Any other item can be moved into Premix by hand in Settings →
  Integrations → Items & categories.
- **Refunds** count on the day they were made, the same as in Square's reports.
- **Events:** a day nobody has tagged is tagged to the event whose dates cover
  it, if exactly one does. A tag you've chosen is never changed.
- **Cash close:** if a close already exists for the day, it fills in the card
  takings and the expected total. It never touches the cash count, because
  only the person who counted the drawer knows it. It never creates a close.
- **Days are rebuilt whole** every time, never added to, so running it twice
  gives the same answer as running it once. A day you imported by CSV is
  replaced with Square's figures for that day.
- **Days you typed in by hand are left alone.** The card lists them and has a
  "Use Square's figures instead" button if you want Square to take over.
- A first connection brings in the **last 30 days**. "Bring in older sales"
  goes back up to a year, filling in over a few syncs.
- **Days follow the Square location's timezone**, so a market that runs past
  midnight UTC still counts on that evening.
- Sales in a currency other than the app's are left out and counted. They are
  never converted.
- **Catering invoices** sent through Square count as sales on the day they're
  paid.

**Read-only.** The permission asked of Square is `MERCHANT_PROFILE_READ`,
`ORDERS_READ`, `PAYMENTS_READ` and `ITEMS_READ`. The app can't take a payment,
issue a refund, or change a price or an item, whatever happens.

---

## Setup (about 15 minutes, once)

### 1. Square: create the app

1. Go to <https://developer.squareup.com/apps>, sign in with the Square
   account that runs the business, and click **+** to create an application
   (any name, for example "God's Chai Operations").
2. At the top, switch to **Production**.
3. Open **OAuth** in the left menu:
   - **Redirect URL:** set exactly
     ```
     https://www.bolochai.com/api/square/callback
     ```
     (`www` or not has to match how the site is opened.)
   - Copy the **Application ID** and the **Application secret**
     (click "Show").

You don't need to submit the app to the App Marketplace or wait for Square's
approval. An app that only connects your own account works straight away.

### 2. Vercel: add the settings

Project → **Settings → Environment Variables** → **Production**:

| Name | Value |
|---|---|
| `SQUARE_APPLICATION_ID` | from step 1 (starts `sq0idp-`) |
| `SQUARE_APPLICATION_SECRET` | from step 1 (starts `sq0csp-`) |
| `SQUARE_REDIRECT_URI` | `https://www.bolochai.com/api/square/callback` |

`MAIL_TOKEN_KEY` and `CRON_SECRET` are shared with the email-invoice feature.
If you already set those up from `docs/EMAIL-INVOICES.md`, there's nothing more
to add. If not, make them now:

```
openssl rand -base64 32     # → MAIL_TOKEN_KEY  (encrypts the stored Square and Gmail permissions)
openssl rand -hex 32        # → CRON_SECRET     (also add it as a GitHub repository secret)
```

Then **redeploy**. New variables only apply to new deployments. The deploy also
applies the database change for this feature (a `SquareConnection` table). It
only adds a table and changes nothing that already exists.

(Testing against Square's sandbox instead: use the sandbox app's ID and secret
and add `SQUARE_ENVIRONMENT=sandbox`.)

### 3. GitHub: the schedule

The three-hourly schedule is the same GitHub workflow as the invoice scan
(`.github/workflows/mail-invoices.yml`). It needs the `CRON_SECRET` repository
secret, and **only runs from `main`**, so it starts once this branch is merged.
Until then, use **Sync now**.

### 4. Connect, and check the first sync by hand

1. **Settings → Integrations → Square sales → Connect Square**, sign in, and
   allow access.
2. Press **Sync now** and read the result ("N orders read, N days updated").
3. Pick a recent market day. Compare the app's net sales, tips and item counts
   with **Square Dashboard → Reports → Sales summary** for the same day and
   location. They should match to the cent. If they don't, tell me which day
   and which figure. That's the check the tests can't make.
4. If the card lists days typed in by hand, look at them and choose.

---

## When something looks wrong

| You see | It means |
|---|---|
| **Needs reconnecting** | Square revoked the permission (for example someone removed the app in Square's dashboard). Press **Reconnect**. |
| A day's total differs from Square's | Tell me the day and the figure. Also check that the day wasn't typed in by hand (the card lists those), and whether a refund was made on a later day. |
| An event's day isn't tagged | Two events cover that day, or none does. Fix the event's dates in Settings and press **Sync now**: untagged days are tagged again on every sync. |
| "N sales in another currency were left out" | Those sales weren't in the app's currency, so they were skipped rather than converted. |
| GitHub Actions shows a yellow warning | `CRON_SECRET` isn't set on GitHub, or the app says Square isn't configured yet. |

**To stop it:** press **Disconnect**. This revokes the permission at Square;
sales already synced stay. You can also remove the app in Square's dashboard
under **Account & Settings → Apps**.

## Limits to know about

- One Square account per business. All of its active locations are synced
  into the location you were working in when you connected.
- Card takings on the cash close are what was charged to cards that day,
  before any later refund.
- Square's CSV importers are still on the page for anything the sync can't
  reach.

## Testing

- `pnpm run test`: how a day's numbers are worked out (refunds, tenders,
  timezones and DST, currency), the cron endpoint's authentication, and that
  the permission requested is read-only.
- `pnpm run test:integration` (needs a Postgres whose name contains "test"):
  the whole sync against a fake Square, covering hand-entered days, CSV days,
  events, categories, the cash close, paging, chunked history, a revoked
  grant, and two runs at once.
