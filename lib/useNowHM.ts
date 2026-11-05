"use client";

import { useEffect, useState } from "react";
import { localHM, nowISO } from "./clock";

/** Warehouse-local "HH:MM", refreshed every 30 s. Empty until mounted (never read during prerender). */
export function useNowHM(): string {
  const [hm, setHm] = useState("");
  useEffect(() => {
    const tick = () => setHm(localHM(nowISO()));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  return hm;
}

export function minutesBetween(fromHM: string, toHM: string): number {
  const [fh, fm] = fromHM.split(":").map(Number);
  const [th, tm] = toHM.split(":").map(Number);
  return th * 60 + tm - (fh * 60 + fm);
}
