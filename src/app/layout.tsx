import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { GlassDensityScript } from "@/components/glass-density";
import { APP_NAME, APP_SHORT_NAME } from "@/lib/brand";

// Self-hosted at build time and exposed as CSS variables that feed
// --font-display / --font-sans in globals.css.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display-src",
  display: "swap",
});
const sans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
    icon: "/icon-192.png",
    // Opaque and square: iOS renders alpha as black and does not scale
    // non-square art gracefully.
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f4ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0a07" },
  ],
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
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
