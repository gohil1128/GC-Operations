// God's Chai Operations — service worker.
//
// SECURITY: authenticated HTML is NEVER cached. A previous build cached every
// navigation response, so a signed-out visitor (or the next user on a shared
// device) could be served the last user's rendered dashboard straight from
// cache. Only a static, data-free offline page and versioned static assets are
// stored now.
//
// Strategy:
//   - HTML navigations: network-only, falling back to the dedicated /offline
//     page. Never cached, never impersonating another route.
//   - Static assets (_next/static, images, fonts): cache-first.
//   - API/data: always network.

const CACHE = "gco-shell-v3";
// Data-free assets only. No authenticated route is precached.
const SHELL = ["/offline", "/logo.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => undefined)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The app posts this on sign-out so nothing survives a session change.
self.addEventListener("message", (event) => {
  if (event.data === "clear-cache") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/data/")) return;

  // Static assets: cache-first. These are content-hashed or public files.
  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?|ttf|css|js)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fresh = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(CACHE).then((c) => c.put(req, clone));
            }
            return res;
          })
          .catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  // HTML navigations: network-only. On failure show the neutral offline page
  // rather than another route's cached HTML.
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req).catch(async () => {
        const offline = await caches.match("/offline");
        return (
          offline ||
          new Response("<h1>Offline</h1><p>Reconnect to continue.</p>", {
            status: 503,
            headers: { "content-type": "text/html; charset=utf-8" },
          })
        );
      })
    );
  }
});

// ── Push notifications ───────────────────────────────────────────────────────
// For now one kind: "someone asked to join" (see src/modules/push). The payload
// is JSON from the server: { title, body, tag, url, actions, tokens, name }.

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { /* fall through to the default */ }
  event.waitUntil(
    self.registration.showNotification(d.title || "New notification", {
      body: d.body || "",
      tag: d.tag,
      icon: "/icon-192.png?v=2",
      badge: "/icon-192.png?v=2",
      // Action buttons show on Android and desktop. iPhone ignores them, which is
      // why tapping the notification itself opens the page where it can be answered.
      actions: d.actions || [],
      data: { url: d.url || "/dashboard", tokens: d.tokens || {}, name: d.name || "" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  const data = n.data || {};
  n.close();

  // Approve / Decline straight from the notification: post the signed ticket and say how it went.
  if ((event.action === "approve" || event.action === "decline") && data.tokens && data.tokens[event.action]) {
    event.waitUntil(
      fetch("/api/push/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: data.tokens[event.action] }),
      })
        .then((r) => r.json())
        .catch(() => ({ ok: false, message: "Couldn't reach the server. Open the app to answer." }))
        .then((r) =>
          self.registration.showNotification(r.ok ? "Done" : "Not done", {
            body: r.message,
            tag: n.tag,
            icon: "/icon-192.png?v=2",
          })
        )
    );
    return;
  }

  // Tapping the notification itself: open (or focus) the app on the Users page.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
      for (const c of all) {
        if ("focus" in c) {
          if ("navigate" in c) c.navigate(data.url);
          return c.focus();
        }
      }
      return self.clients.openWindow(data.url || "/dashboard");
    })
  );
});
