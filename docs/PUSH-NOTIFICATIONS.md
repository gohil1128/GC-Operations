# Join-request notifications

When someone signs in with Google and asks to join, the owner gets a phone (or
computer) notification, and on most devices can **approve or decline it from the
notification itself**.

## What you'll see

- **Android and desktop (Chrome, Edge):** a notification "Wendy wants to join" with **Approve** and
  **Decline** buttons. Approve always makes them **Staff** (there's nowhere on a notification to pick a
  role); change their role afterwards in Settings → Users.
- **iPhone / iPad:** a notification, but **Apple doesn't show action buttons**, so tapping it opens
  Settings → Users, where you approve or decline and pick the role. iPhone only allows notifications from
  an app added to the Home Screen (iOS 16.4 or later), so add the app first, open it from the Home Screen,
  then turn notifications on.
- Only **owners** are notified, and only on devices where they turned it on.

## Setup (about 3 minutes, once)

1. Make a key pair. In any terminal:

   ```
   npx web-push generate-vapid-keys
   ```

   It prints a **Public Key** and a **Private Key**.
2. In Vercel → Settings → Environment Variables → Production, add:

   | Name | Value |
   |---|---|
   | `VAPID_PUBLIC_KEY` | the Public Key |
   | `VAPID_PRIVATE_KEY` | the Private Key (keep it secret) |
   | `VAPID_SUBJECT` | `mailto:you@yourdomain.com` (or your site's https address) |

3. Redeploy.
4. Open **Settings → Users** on each device you want alerts on and press **Turn on**.

Until the keys exist, that page says notifications aren't set up. Nothing else depends on them.

## How the buttons stay safe

The Approve / Decline buttons can't use your login (they run in the phone's background), so each
notification carries two signed tickets: one for "approve this one person", one for "decline this one
person", issued to you, valid for 3 days. A ticket can only do that single thing, only for someone who is
still waiting, only if you are still an owner, and only as Staff. Anyone who sees the notification on your
lock screen can use the buttons, as they could with your phone unlocked, so keep notifications hidden on the
lock screen if that matters to you.

## When something looks wrong

| You see | It means |
|---|---|
| "needs adding in Vercel" on the Users page | The VAPID keys or subject aren't set on this deployment. |
| "Notifications are blocked" | Allow notifications for the site in the browser or phone settings. |
| Turned on but nothing arrives | The device was removed by its push service, or notifications are off at the OS level. Turn it off and on again. |
| "That link has expired" | The notification is over 3 days old, or the person was already answered. Use Settings → Users. |
