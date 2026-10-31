import type { CapacitorConfig } from "@capacitor/cli";

/*
  The native shell for God's Chai Operations.

  WHY THIS LOADS A REMOTE URL rather than bundling the app.

  The web app is server-rendered: 21 files carry "use server", auth runs through
  NextAuth, and every page reads Postgres through Prisma. None of that can be
  turned into static files, so `next export` is not available and there is no
  bundle to place inside the APK. The shell therefore points a native WebView at
  the deployed site.

  That is not a workaround, and it has a property worth stating plainly: because
  the app is served, shipping a change to the site reaches every installed copy
  immediately. Nobody has to be sent a new APK when the dashboard changes. A new
  APK is only needed if something here — the name, the icon, the target URL —
  changes.

  The cost is equally plain: this shell needs a network connection. There is no
  offline mode beyond the service worker's offline page, which the site already
  serves. If offline data entry at the stall is wanted, that is a different and
  much larger piece of work than a wrapper.
*/

const config: CapacitorConfig = {
  appId: "com.godschai.ops",
  appName: "God's Chai",

  /*
    Required by the CLI even though it goes unused while `server.url` is set:
    the WebView loads the remote origin, not these files. It holds a single
    page that only appears if the shell is ever built without a server URL.
  */
  webDir: "www",

  server: {
    url: "https://www.bolochai.com",
    /*
      No cleartext, anywhere. The session cookie that this WebView carries is
      the whole of someone's access to the business's books; allowing a plain
      HTTP hop would put it on the wire in the clear on whatever café or market
      Wi-Fi the tablet is attached to.
    */
    cleartext: false,
    androidScheme: "https",
  },

  android: {
    allowMixedContent: false,
    // The site's own cream canvas, so a cold start does not flash white.
    backgroundColor: "#F8F4EC",
  },
};

export default config;
