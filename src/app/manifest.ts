import type { MetadataRoute } from "next";
import { APP_NAME, APP_SHORT_NAME, APP_DESCRIPTION } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    /*
      Not locked to portrait.

      Chrome enforces this field on an INSTALLED app, not just as a hint, so
      "portrait-primary" was holding every installed copy upright. On a phone
      that is merely opinionated; on the two devices this is actually used on
      it is wrong. A tablet lives in a stand at the stall, which is landscape,
      and an installed desktop window has no portrait to rotate to at all —
      both were being handed a layout the app does not need to force, when it
      already has breakpoints from the mobile tab bar up to the desktop rail.
    */
    orientation: "any",
    // Match the cream canvas so the splash and status bar don't flash slate.
    background_color: "#F8F4EC",
    theme_color: "#F8F4EC",
    categories: ["business", "productivity", "finance"],
    // Real square assets on the cream plate. Previously all three entries
    // pointed at one 300x290 transparent PNG, so the declared sizes were false
    // and the maskable variant overflowed Android's safe zone.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New invoice", short_name: "Invoice", url: "/purchasing/invoices/new" },
      { name: "New cash close", short_name: "Cash", url: "/cash/new" },
      { name: "Reports", short_name: "Reports", url: "/reports" },
    ],
  };
}
