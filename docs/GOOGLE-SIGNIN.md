# Continue with Google

The login and sign-up pages have a **Continue with Google** button under the
form. It is hidden until the two Google keys below are set, so nothing changes
until you turn it on.

## What it does

- A Google account whose email matches an existing user signs that user in.
- An email nobody has used **asks to join your business** as a waiting Staff member. They land on a
  "Waiting for approval" screen and can see nothing: no pages, no exports, no data. The owner sees them
  under **Settings → Users → "waiting to join"**, picks Staff or Manager, and presses **Approve** (they get
  every location), or **Decline**, which removes them. Nobody becomes an Owner this way.
- Which business they ask to join: the one set in `GOOGLE_JOIN_BUSINESS_ID` in Vercel, or if that is not set,
  the oldest business, which is the one this app was set up for. Nobody gets a business of their own through
  Google; a new business is made on the email-and-password sign-up page.
- **Google must have verified the email address.** Otherwise the sign-in is
  refused with a message. Without this check anyone could register a Google
  identity under someone else's address and be signed in as them.
- A Google user has no password they know. "Forgot password" still lets
  them set one if they want to sign in the other way too.
- Asking to join uses the same hourly limit as the sign-up page.

## Setup (about 5 minutes, using the Google app you made for Gmail)

1. Google Cloud Console → **APIs & Services → Credentials** → your OAuth client
   → **Authorized redirect URIs** → add, exactly:

   ```
   https://www.bolochai.com/api/auth/callback/google
   ```

   (Keep the Gmail one that is already there. `www` or not must match how the
   site is opened.)
2. The client's ID and secret are the same ones as for Gmail. In Vercel they
   must be set as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, which you
   already did for email invoices. Redeploy if you add them now.
3. **To let people outside your organisation sign in** (any Gmail or other Google account), the
   consent screen's user type must be **External**, not Internal. In Google Cloud: **Google Auth
   Platform → Audience** → *Make external*, then **Publish app**. An *Internal* app only accepts
   accounts from your own Google Workspace, whatever the app does. The app itself puts no limit on
   which Google accounts can sign in.
4. The sign-in only asks for the basic profile and email (no Gmail access).
   If the app's OAuth consent screen is still in *Testing*, only listed test
   users can sign in; **Publish app** so anyone can.

## When something looks wrong

| You see | It means |
|---|---|
| `redirect_uri_mismatch` on Google's page | The redirect URI in step 1 isn't added exactly as shown. |
| "Google hasn't verified that email address" | Google didn't mark the address verified. Verify it with Google, or use the password. |
| "Access blocked" / "app not verified" | The consent screen is in Testing, or the account isn't a listed test user. |
| No Google button | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` aren't set on the deployment you're looking at. |
