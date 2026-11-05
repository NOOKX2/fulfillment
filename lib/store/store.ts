"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { nowISO } from "../clock";
import {
  assertInvariants,
  fail,
  nextId,
  SCANLOG_CAP,
  type Ctx,
  type Result,
} from "../domain/core";
import type { ErrorCode } from "../domain/errors";
import { errorText } from "../domain/format";
import { TransitionError } from "../domain/machines";
import type { AppState, ScanKind } from "../domain/types";
import { beepOk, buzzError, vibrate } from "../feedback/audio";
import { emptyState, SCHEMA_VERSION } from "./empty";
import { debouncedStorage, STORE_KEY } from "./persist";
import { useUi } from "./ui";

interface WmsState {
  data: AppState;
}

export const useWms = create<WmsState>()(
  persist(
    () => ({ data: emptyState() }),
    {
      name: STORE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => debouncedStorage),
      skipHydration: true,
      partialize: (s) => ({ data: s.data }),
      migrate: (persisted) => persisted as WmsState,
    },
  ),
);

export const getData = (): AppState => useWms.getState().data;

export interface RunOpts {
  /** Treat as a barcode scan: logs to scanLog, beeps and shows banner feedback. */
  scan?: { context: string; raw: string; kind?: ScanKind };
  /** Show an error banner on failure (default true). */
  notifyError?: boolean;
  /** Failure codes the UI handles inline (e.g. needs confirmation) - no banner or buzz. */
  silentCodes?: ErrorCode[];
  /** Show an info toast on success. */
  successText?: { th: string; en: string };
}

/**
 * Atomic action runner: clones the data, lets the domain function mutate the
 * clone and commits only when the result is ok (or explicitly asks to commit,
 * e.g. a pack mismatch that must be logged).
 */
export function run<T>(
  fn: (draft: AppState, ctx: Ctx) => Result<T>,
  opts: RunOpts = {},
): Result<T> {
  const cur = getData();
  const draft = structuredClone(cur);
  const ctx: Ctx = { now: nowISO() };
  let res: Result<T>;
  try {
    res = fn(draft, ctx);
  } catch (e) {
    if (e instanceof TransitionError) res = fail("INVALID_TRANSITION", e.message);
    else throw e;
  }

  const lang = draft.settings.lang;
  const sound = draft.settings.soundOn;

  if (opts.scan) {
    draft.scanLog.push({
      id: nextId(draft, "scn"),
      at: ctx.now,
      context: opts.scan.context,
      raw: opts.scan.raw,
      kind: opts.scan.kind ?? "unknown",
      ok: res.ok,
      code: res.ok ? undefined : res.code,
    });
    if (draft.scanLog.length > SCANLOG_CAP) {
      draft.scanLog.splice(0, draft.scanLog.length - SCANLOG_CAP);
    }
  }

  if (res.ok || res.commit) {
    if (process.env.NODE_ENV !== "production") {
      const errs = assertInvariants(draft);
      if (errs.length) console.error("WMS invariant violation", errs);
    }
    useWms.setState({ data: draft });
  } else if (opts.scan) {
    // Failed scan: keep the audit trail only, drop any other mutation.
    useWms.setState({ data: { ...cur, scanLog: draft.scanLog, seq: draft.seq } });
  }

  const ui = useUi.getState();
  if (!res.ok && opts.notifyError !== false && !opts.silentCodes?.includes(res.code)) {
    const text = errorText(draft, res.code, res.detail, lang);
    ui.notify({ kind: "error", text, beacon: res.code === "PACK_MISMATCH" });
    if (sound) buzzError();
    if (draft.settings.vibrateOn) vibrate([120, 60, 120]);
  } else if (res.ok) {
    if (opts.scan && sound) beepOk();
    if (opts.successText) ui.notify({ kind: "ok", text: opts.successText[lang] });
    else if (opts.scan) ui.notify({ kind: "ok", text: lang === "th" ? "สแกนสำเร็จ" : "Scan OK" });
  }
  return res;
}

/** Replace the whole dataset (seed / reset). */
export function replaceData(next: AppState): void {
  useWms.setState({ data: next });
}
