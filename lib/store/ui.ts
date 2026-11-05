"use client";

import { create } from "zustand";

export interface FeedbackMessage {
  id: number;
  kind: "ok" | "error" | "info";
  text: string;
  beacon?: boolean;
}

interface UiState {
  hydrated: boolean;
  feedback: FeedbackMessage | null;
  storageFull: boolean;
  setHydrated: (v: boolean) => void;
  setStorageFull: (v: boolean) => void;
  notify: (m: Omit<FeedbackMessage, "id">) => void;
  clearFeedback: () => void;
}

let counter = 0;

export const useUi = create<UiState>((set) => ({
  hydrated: false,
  feedback: null,
  storageFull: false,
  setHydrated: (hydrated) => set({ hydrated }),
  setStorageFull: (storageFull) => set({ storageFull }),
  notify: (m) => set({ feedback: { id: ++counter, ...m } }),
  clearFeedback: () => set({ feedback: null }),
}));

export const useHydrated = () => useUi((s) => s.hydrated);
