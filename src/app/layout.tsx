import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { GlassDensityScript } from "@/components/glass-density";
import { APP_NAME, APP_SHORT_NAME } from "@/lib/brand";

// Self-hosted variable fonts, committed in ./fonts (SIL OFL, see the
// LICENSE files there). No build-time fetch from Google Fonts: the
// next/font/google loader crashed fresh Vercel builds with
// "Cannot read properties of null (reading '1')" in
// nextFontGoogleFontLoader when the fetched CSS yielded a font URL
// without a recognised extension, and a cached build was the only thing
// masking it. The variable names below are unchanged, so they still feed
// --font-display / --font-sans in globals.css, and the weight ranges
// cover every weight the app used before (400-700 display, 400-600 sans).
const display = localFont({
  src: "./fonts/bricolage-grotesque-latin-standard-normal.woff2",
  weight: "200 800",
  variable: "--font-display-src",
  display: "swap",
});
const sans = localFont({
  src: "./fonts/dm-sans-latin-standard-normal.woff2",
  weight: "100 1000",
  variable: "--font-sans-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Restaurant operations platform — inventory, labor, cash, reporting.",
  applicationName: APP_NAME,
  // `capable: true` emits both apple-mobile-web-app-capable and the modern
  // mobile-web-app-capable, so older iOS web clips launch without Safari chrome.
  appleWebApp: {
    capable: true,
    title: APP_SHORT_NAME,
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192.png?v=2",
    // Opaque and square: iOS renders alpha as black and does not scale
    // non-square art gracefully.
    apple: [{ url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" }],
    shortcut: "/icon-192.png?v=2",
  },
};

export const viewport: Viewport = {
  /* One value, the dark base. The app opens dark regardless of the OS setting
     now, so keying the status bar off prefers-color-scheme would paint a cream
     bar over a near-black page for everyone whose phone is in light mode. */
  themeColor: "#283018",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${sans.variable}`}>
      <head>
        {/* Before the first paint. As an effect it would run after the page
            had already been painted with the full material, so anyone who
            asked for Solid would watch the glass appear and be taken away
            again on every navigation. */}
        <GlassDensityScript />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
