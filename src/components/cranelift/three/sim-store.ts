"use client";

/**
 * IHMS CraneLift 3D — استور اجرای شبیه‌سازی حرکت (دو پرچم A → B)
 * -----------------------------------------------------------
 * وضعیت زنده انیمیشن: فاز جاری، پوز جرثقیل (چرخش/بوم/قلاب/بار)،
 * سرعت پخش و نمایش نتیجه نهایی. در localStorage ذخیره نمی‌شود.
 */

import { create } from "zustand";
import type { SimPose } from "@/lib/cranelift/simulation";

interface SimState {
  active: boolean; // انیمیشن در حال اجرا
  speed: number; // ضریب سرعت پخش
  pose: SimPose | null; // آخرین پوز (پس از پایان، پوز پایانی)
  showVerdict: boolean; // کارت نتیجه پس از پایان نمایش داده شود؟
  setPose: (p: SimPose | null) => void;
  start: () => void;
  finish: (final: SimPose | null) => void;
  reset: () => void;
  setSpeed: (s: number) => void;
}

export const useSim = create<SimState>((set) => ({
  active: false,
  speed: 1,
  pose: null,
  showVerdict: false,
  setPose: (p) => set({ pose: p }),
  start: () => set({ active: true, showVerdict: false, pose: null }),
  finish: (final) => set({ active: false, showVerdict: true, pose: final }),
  reset: () => set({ active: false, showVerdict: false, pose: null }),
  setSpeed: (s) => set({ speed: s }),
}));
