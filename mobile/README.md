# God's Chai Operations — native shells

Native Android and iOS wrappers that put the operations dashboard on a home
screen as an installable app, so a build can be handed to someone as a file.

It is **not** part of the web app. It has its own `package.json`, and the root
app excludes this directory from its TypeScript and ESLint config, so nothing
here can affect what deploys to bolochai.com.

## What these actually are

A native WebView pointed at `https://www.bolochai.com`.

That is not laziness, it is the only shape available. The web app is
server-rendered — 21 files carry `"use server"`, auth runs through NextAuth,
every page reads Postgres through Prisma — so there is no static bundle that
could be placed inside an APK or an IPA. `next export` is not an option for it.

Two consequences follow, and both matter more than the architecture does:

- **Shipping a change to the site reaches every installed copy immediately.**
  Nobody needs a new build when the dashboard changes. A new build is only
  needed if the app's name, icon, or target URL changes.
- **They need a network connection.** There is no offline mode beyond the
  offline page the site's own service worker already serves. Offline data entry
  at the stall would be a much larger piece of work than a wrapper.

Because the site is already an installable PWA (`src/app/manifest.ts`,
`public/sw.js`), these builds' real advantage over "Add to Home Screen" is
simply that they are files you can send someone.

## Platform coverage

| Target | How |
| --- | --- |
| Android phone | this APK |
| Android tablet | the same APK — the activity sets no `screenOrientation` and lists `orientation\|screenSize` in `configChanges`, so it rotates freely |
| Desktop (Win/macOS/Linux) | no build needed: Chrome and Edge install the site as a desktop app from the address bar |
| iPhone / iPad | the Xcode project here, but it must be built on a Mac — see below |

## Android

Requires a JDK (21 works), the Android SDK with platform `android-34` and
build-tools, and `android/keystore.properties`.

```sh
pnpm install
pnpm exec tsx scripts/gen-icons.mts      # only after changing the web app's icons
pnpm run apk:release
# → android/app/build/outputs/apk/release/app-release.apk
```

Point Gradle at the SDK with either `ANDROID_HOME` or
`android/local.properties` containing `sdk.dir=/path/to/android-sdk`.

### Signing

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
its password in a password manager.

### Installing on a phone

These APKs are distributed by hand, not through Play, so the device has to be
told to allow it: on first open Android asks to permit installing unknown apps
from whatever app delivered the file. That prompt is expected.

A plain WebView wrapper would be rejected by Play review under its minimum
functionality policy. That is not a problem for sharing a file directly, but it
does mean this is not a route to the Play Store as it stands.

## iOS

The Xcode project is here and configured — bundle id `com.godschai.ops`,
display name "God's Chai", deployment target 13.0, automatic signing, icon and
launch image generated from the web app's assets. What it has **never been is
built**: an iOS binary can only be compiled on macOS with Xcode, and this
project was scaffolded on Linux, so treat everything below as prepared rather
than proven.

### On a Mac

```sh
cd mobile
pnpm install
npx cap sync ios          # DO NOT SKIP — see the Podfile note
cd ios/App && pod install
open App.xcworkspace
```

**The `cap sync` step is not optional.** The committed `ios/App/Podfile`
references Capacitor through pnpm's content-addressed store, e.g.
`node_modules/.pnpm/@capacitor+ios@6.2.0_@capacitor+core@6.2.0/node_modules/@capacitor/ios`.
That path encodes the exact dependency versions, so it breaks the moment
Capacitor is upgraded, and it does not exist at all under npm or Yarn.
`cap sync` regenerates it for whatever layout that machine actually has.

In Xcode, set the signing team on the App target, then **Product → Archive** and
distribute.

### Getting it onto someone else's iPhone

There is no sideloading on iOS — no equivalent of handing over an APK. Every
route requires the **Apple Developer Program at $99/yr**:

- **TestFlight** — up to 100 internal testers with no App Store review, which
  is the sane choice for a handful of founders. Testers install the TestFlight
  app and accept an invite; builds expire after 90 days.
- **Ad-hoc** — an `.ipa` installable on up to 100 devices per year, but each
  device's UDID has to be registered in the developer portal first, which is
  more friction than TestFlight for fewer benefits.

Submitting to the public App Store is a different matter: like Play, Apple's
guidelines reject apps that are simply a website in a WebView, so the store is
not a route for this as it stands. TestFlight does not apply those rules to
internal testers.

### Until then

iPhone and iPad users get the same thing by opening `www.bolochai.com` in
Safari and choosing **Share → Add to Home Screen**. The manifest declares
`display: "standalone"`, so it launches without browser chrome and opens on the
dashboard — the same experience these builds provide, without the file.

## Desktop

Nothing to build. Chrome and Edge install the site as a genuine desktop app —
its own window with no browser chrome, its own icon in the Start menu or Dock —
from the install button in the address bar, on Windows, macOS and Linux alike.
The site already meets the requirements for that: a manifest with
`display: "standalone"` and 192/512 icons, and a service worker with a `fetch`
handler, served over HTTPS.

An Electron or Tauri installer was considered and is not here on purpose. It
would add a second runtime to maintain for no capability the installed PWA
lacks, and unsigned installers trip SmartScreen and Gatekeeper — so it also
means buying a Windows signing certificate and notarising on macOS, to ship
something the browser already does for free.

## Assets

Both generators read the web app's own PNGs in `public/`, and both are
committed so the assets are reproducible rather than binaries nobody can
regenerate:

```sh
pnpm exec tsx scripts/gen-icons.mts        # Android launcher icons
pnpm exec tsx scripts/gen-ios-assets.mts   # iOS app icon + launch image
```

Two details they handle that are easy to get wrong:

- **Android adaptive icons** use `icon-maskable-512.png`, not the full-bleed
  square, because launchers crop the outer ~18% of the foreground and the
  full-bleed mark loses its edges. The script fails if that is ever rewired.
- **The iOS icon is flattened onto the cream and written without an alpha
  channel.** Both source PNGs are RGBA, and Apple rejects an app icon
  containing transparency — before that, it renders the transparent pixels
  black on the home screen.

The iOS icon is **upscaled** from 512 to the 1024 Apple wants, because 512 is
the largest master the web app has. For a flat mark that is acceptable; if a
larger master or a vector turns up, replace `public/icon-512.png` and re-run.
