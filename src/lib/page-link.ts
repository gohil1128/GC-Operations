/*
  Which clicks start a page navigation (and so deserve the progress line).

  Pure so it can be tested: it takes what it needs from the event and the
  anchor rather than reading the DOM. Returns the "/path?query" being opened,
  or null when the click is not a page change — a new tab, a download, a file
  or API link, a jump within the page, or a link to where you already are.
*/

export type ClickFacts = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

export type AnchorFacts = { href: string; target: string; download: boolean };

export function pageNavigationTarget(a: AnchorFacts, e: ClickFacts, here: URL): string | null {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  if (a.download) return null;
  if (a.target && a.target !== "_self") return null;
  let url: URL;
  try {
    url = new URL(a.href, here);
  } catch {
    return null;
  }
  if (url.origin !== here.origin) return null;
  // Files and endpoints (CSV exports, the print sheet) are not screens.
  if (url.pathname.startsWith("/api/")) return null;
  const to = url.pathname + url.search;
  // A hash on this very page is a jump, and the same page again is nothing to wait for.
  if (to === here.pathname + here.search) return null;
  return to;
}
