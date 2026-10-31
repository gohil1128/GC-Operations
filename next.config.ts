import type { NextConfig } from "next";

/*
  Security headers. The app shipped with none of these.

  No CSP is set globally on purpose. Next injects inline scripts for hydration
  and the app uses inline styles for chart geometry, so a strict policy needs
  nonces threaded through the document — worth doing, but it is a change that
  breaks the app quietly if it is wrong, and it belongs on its own. The headers
  below are the ones that carry no such risk. The invoice photo route, which
  serves user-supplied bytes, sets its own strict CSP.
*/
const securityHeaders = [
  // Never let a browser second-guess a Content-Type. Half of the attachment
  // problem was a response being interpreted as something executable.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // This app is never framed; clickjacking a cash-close form is a real risk.
  { key: "X-Frame-Options", value: "DENY" },
  // Do not leak invoice or event ids to third parties through the Referer.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here needs a camera, microphone or location.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // HSTS. Vercel serves HTTPS only; this stops a downgrade on the first hop.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
