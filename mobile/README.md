# God's Chai Operations — Android shell

A native Android wrapper that puts the operations dashboard on a phone or tablet
home screen as an installable app, so a build can be handed to someone as a
single `.apk` file.

It is **not** part of the web app. It has its own `package.json`, and the root
app excludes this directory from its TypeScript and ESLint config, so nothing
here can affect what deploys to bolochai.com.

## What this actually is

A native WebView pointed at `https://www.bolochai.com`.

That is not laziness, it is the only shape available. The web app is
server-rendered — 21 files carry `"use server"`, auth runs through NextAuth,
every page reads Postgres through Prisma — so there is no static bundle that
could be placed inside an APK. `next export` is not an option for it.

Two consequences follow, and both matter more than the architecture does:

- **Shipping a change to the site reaches every installed copy immediately.**
  Nobody needs a new APK when the dashboard changes. A new APK is only needed
  if the app's name, icon, or target URL changes.
- **It needs a network connection.** There is no offline mode beyond the
  offline page the site's own service worker already serves. Offline data entry
  at the stall would be a much larger piece of work than a wrapper.

Because the site is already an installable PWA (`src/app/manifest.ts`,
`public/sw.js`), this APK's real advantage over "Add to Home Screen" is simply
that it is a file you can send someone.

## Building a release APK

Requires a JDK (21 works), the Android SDK with platform `android-34` and
build-tools, and `android/keystore.properties` (see below).

```sh
pnpm install
pnpm exec tsx scripts/gen-icons.mts   # only after changing the web app's icons
pnpm run apk:release
# → android/app/build/outputs/apk/release/app-release.apk
```

Point Gradle at the SDK with either `ANDROID_HOME` or
`android/local.properties` containing `sdk.dir=/path/to/android-sdk`.

## Signing

`android/keystore.properties` holds the key and its passwords and is **not in
git** (see `android/.gitignore`):

```properties
storeFile=/absolute/path/to/gco-release-keystore.jks
storePassword=…
keyAlias=godschai
keyPassword=…
```

Builds are signed as **release**, not debug, on purpose. A debug APK is signed
with the universally-known Android debug key and ships
`android:debuggable="true"`, which lets anything on the device attach to the
process. This app carries a live session to the business's books, so a debug
build is not something to pass around.

**The keystore is the one thing here that cannot be regenerated.** Android
refuses to install an update signed by a different key, so if it is lost every
installed copy has to be uninstalled before a new build will go on. Keep it and
its password in a password manager. Losing it is survivable — the app loads the
live site, so new APKs are rarely needed — but it is still a one-way door.

## Installing on a phone

These APKs are distributed by hand, not through Play, so the device has to be
told to allow it: on first open Android asks to permit installing unknown apps
from whatever app delivered the file (Drive, Gmail, Files). That prompt is
expected.

A plain WebView wrapper would be rejected by Play review under its minimum
functionality policy. That is not a problem for sharing a file directly, but it
does mean this is not a route to the Play Store as it stands.

## iOS

Not buildable here, and not buildable on Linux at all. An iOS app has to be
compiled on macOS with Xcode, and there is no equivalent of sideloading an APK:
every way of getting a build onto someone else's iPhone — TestFlight, ad-hoc
distribution — requires a paid Apple Developer account, with ad-hoc also
requiring each device registered by UDID.

Until that exists, iPhone users get the same thing by opening
`www.bolochai.com` in Safari and choosing **Share → Add to Home Screen**. The
manifest already declares `display: "standalone"`, so it launches without
browser chrome and opens on the dashboard — the same experience this APK
provides, without the file.
