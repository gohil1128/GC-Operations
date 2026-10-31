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
          background: "linear-gradient(135deg,#F8F4EC 0%,#F2ECE2 55%,#F7EADA 100%)",
          color: "#2A1A10",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            background: "#FCFAF6",
            border: "1px solid #EADFD2",
            borderRadius: 24,
            padding: 40,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={APP_NAME} style={{ height: 48, width: "auto", marginBottom: 24 }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#6B5C4E", marginTop: 8, lineHeight: 1.5 }}>
            This page failed to load. Retrying often clears it.
          </p>
          {error.digest && (
            <p style={{ fontSize: 11, color: "#6B5C4E", marginTop: 12 }}>Reference {error.digest}</p>
          )}
          <div style={{ marginTop: 24, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                background: "#3A2415", color: "#F8F1E6", border: 0, borderRadius: 999,
                padding: "10px 18px", fontSize: 14, fontWeight: 500, cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/dashboard"
              style={{
                border: "1px solid #EADFD2", color: "#2A1A10", borderRadius: 999,
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
