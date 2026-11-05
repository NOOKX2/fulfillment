"use client";

import type { StateStorage } from "zustand/middleware";
import { useUi } from "./ui";

export const STORE_KEY = "wms:v1";
export const SIGNATURE_KEY = "wms:signatures";

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: { name: string; value: string } | null = null;

function flush() {
  if (!pending) return;
  const { name, value } = pending;
  pending = null;
  try {
    localStorage.setItem(name, value);
    if (useUi.getState().storageFull) useUi.getState().setStorageFull(false);
  } catch {
    useUi.getState().setStorageFull(true);
  }
}

/** localStorage with debounced writes; flushes when the tab hides or unloads. */
export const debouncedStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    pending = { name, value };
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 250);
  },
  removeItem: (name) => {
    pending = null;
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export function installFlushHandlers(): () => void {
  const onHide = () => flush();
  const onVisibility = () => {
    if (document.visibilityState === "hidden") flush();
  };
  window.addEventListener("beforeunload", onHide);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("beforeunload", onHide);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

/* ---- signatures live under a separate key to keep the main blob small ---- */
function readSignatures(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SIGNATURE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveSignature(key: string, dataUrl: string): boolean {
  try {
    const all = readSignatures();
    all[key] = dataUrl;
    localStorage.setItem(SIGNATURE_KEY, JSON.stringify(all));
    return true;
  } catch {
    useUi.getState().setStorageFull(true);
    return false;
  }
}

export function loadSignature(key: string): string | undefined {
  return readSignatures()[key];
}

export function clearSignatures(): void {
  try {
    localStorage.removeItem(SIGNATURE_KEY);
  } catch {
    /* ignore */
  }
}
