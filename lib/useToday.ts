"use client";

import { useState } from "react";
import { localDate, nowISO } from "./clock";

/**
 * Warehouse-local date, captured once when a client view mounts.
 * Only call from components rendered behind <Hydrated> (never prerendered).
 */
export function useToday(): string {
  const [today] = useState(() => localDate(nowISO()));
  return today;
}
