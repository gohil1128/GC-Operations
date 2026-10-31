/*
  What this deployment is called.

  The product name was written into nine files: the PWA manifest, the document
  title, the iOS web-clip title, the sidebar's accessible label, the alt text on
  every logo, and the subject line of the password-reset email. A second
  customer installing the app got one named "God's Chai" on their home screen.

  These are per-ORIGIN facts, not per-user ones. A manifest is fetched once for
  the whole site with credentials omitted, so it cannot know who is looking —
  which means there are two ways to sell this, and they need different things:

    One deployment per customer (white label). Set these three variables per
    deployment and replace the four files in /public, and the customer gets an
    app that is theirs down to the home-screen icon.

    One deployment, many customers. Set these once to the PRODUCT's name. Each
    business still sees its own name inside the app — the shell reads it from
    the Business row — but the installed app, the tab title and the icons are
    the product's, the way they are for any SaaS.

  Defaulted to the current values so the live site is unchanged by this commit;
  a different deployment is a variable, not a patch.
*/
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "God's Chai Operations";
export const APP_SHORT_NAME = process.env.NEXT_PUBLIC_APP_SHORT_NAME || "God's Chai";
export const APP_DESCRIPTION =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION ||
  "Sales, invoices, cash and labour for every event.";
