"use client";
import * as React from "react";

/*
  Unfinished input that survives going back.

  useDraftState works like useState, but every change is also written to this
  device's localStorage under the form's key, and the saved value comes back the
  next time the form opens. clearDraft(key) forgets it once the form is saved.
  Drafts older than a week are dropped. Nothing leaves the device.

  The saved value is restored after mount, not during render, so the server and
  first client render agree.
*/
const WEEK = 7 * 24 * 60 * 60 * 1000;
type Store = { at: number; fields: Record<string, unknown> };

function read(key: string): Store | null {
  try {
    const raw = localStorage.getItem(`draft:${key}`);
    if (!raw) return null;
    const s = JSON.parse(raw) as Store;
    if (!s || Date.now() - s.at > WEEK) { localStorage.removeItem(`draft:${key}`); return null; }
    return s;
  } catch { return null; }
}

function write(key: string, field: string, value: unknown) {
  try {
    const s = read(key) ?? { at: Date.now(), fields: {} };
    s.at = Date.now();
    s.fields[field] = value;
    localStorage.setItem(`draft:${key}`, JSON.stringify(s));
  } catch { /* storage full or blocked: drafts are a convenience */ }
}

export function clearDraft(key: string) {
  try { localStorage.removeItem(`draft:${key}`); } catch { /* ignore */ }
}

export function useDraftState<T>(key: string | null, field: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = React.useState<T>(initial);
  const restored = React.useRef(false);
  React.useEffect(() => {
    if (!key || restored.current) return;
    restored.current = true;
    const s = read(key);
    if (s && field in s.fields) setValue(s.fields[field] as T);
  }, [key, field]);
  const set: React.Dispatch<React.SetStateAction<T>> = React.useCallback(
    (next) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        if (key) write(key, field, v);
        return v;
      });
    },
    [key, field],
  );
  return [value, set];
}
