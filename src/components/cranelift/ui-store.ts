"use client";

/**
 * CraneLift Pro 3D — استور دیالوگ‌های سراسری (بدون persist)
 * هر کامپوننتی می‌تواند محاسبه‌گر سیم بکسل یا دیالوگ ارتقا را باز کند.
 */

import { create } from "zustand";

interface UiState {
  ropeOpen: boolean;
  upgradeOpen: boolean;
  setRopeOpen: (v: boolean) => void;
  setUpgradeOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  ropeOpen: false,
  upgradeOpen: false,
  setRopeOpen: (v) => set({ ropeOpen: v }),
  setUpgradeOpen: (v) => set({ upgradeOpen: v }),
}));
