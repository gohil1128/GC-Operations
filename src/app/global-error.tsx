"use client";
import * as React from "react";
import { APP_NAME } from "@/lib/brand";

// Catches errors thrown during SSR / in the root layout, where (app)/error.tsx
// cannot reach. Without this, a 500 on a direct URL load (bookmark, refresh,
// pasted link) rendered a completely blank white page. Must ship its own
// <html>/<body> and cannot rely on the app's CSS being applied.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Root error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(180deg,#2B1B12 0%,#1D120B 60%)",
          color: "#FCFCFB",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            background: "#2B1B12",
            border: "1px solid #4A3223",
            borderRadius: 24,
            padding: 40,
          }}
        >
          {/* On a cream plate, as in the app: the logo is brown, and brown on this
              dark brown would disappear. */}
          <span style={{ display: "inline-block", background: "#F7F9F8", borderRadius: 12, padding: "4px 10px", marginBottom: 24 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt={APP_NAME} style={{ height: 44, width: "auto", display: "block" }} />
          </span>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#A9ACA2", marginTop: 8, lineHeight: 1.5 }}>
            This page failed to load. Retrying often clears it.
          </p>
          {error.digest && (
            <p style={{ fontSize: 11, color: "#A9ACA2", marginTop: 12 }}>Reference {error.digest}</p>
          )}
          <div style={{ marginTop: 24, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                background: "#F2A93C", color: "#2B1B12", border: 0, borderRadius: 999,
                padding: "10px 18px", fontSize: 14, fontWeight: 500, cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/dashboard"
              style={{
                border: "1px solid #3A4430", color: "#FCFCFB", borderRadius: 999,
                padding: "10px 18px", fontSize: 14, fontWeight: 500, textDecoration: "none",
              }}
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
