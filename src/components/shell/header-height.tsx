"use client";
import * as React from "react";

/*
  Publishes the sticky app header's height as --app-header-h.

  Anything that wants to stick just below the header needs to know how tall it
  is, and it is not a constant: 57px on desktop, 61px on a phone where the
  brand mark shows, plus whatever the safe-area inset adds on a notched device.
  Hard-coding it would be wrong on at least one of those and would rot the
  first time the header's contents change.
*/
export function HeaderHeightVar() {
  React.useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const apply = () => {
      document.documentElement.style.setProperty(
        "--app-header-h",
        `${Math.round(header.getBoundingClientRect().height)}px`,
      );
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);
  return null;
}
