/**
 * CraneLift Pro 3D — استور تنظیمات نمایش سه‌بعدی
 * -----------------------------------------------------------
 * خروجی‌های نمایشی (نه محاسباتی) صحنه: خطوط نیرو، منطقه ممنوعه و ...
 * در localStorage ذخیره نمی‌شود.
 */

import { create } from "zustand";

/** حالت قرار دادن پرچم روی زمین */
export type FlagMode = "off" | "pick" | "place";

export interface View3DState {
  exclusion: boolean; // منطقه ممنوعه
  forces: boolean; // خطوط نیرو
  radiusLine: boolean; // خط شعاع کاری
  labels: boolean; // برچسب‌ها
  flagMode: FlagMode; // پرچم فعال برای کلیک روی زمین
  set: (patch: Partial<Omit<View3DState, "set" | "toggle" | "setFlagMode">>) => void;
  toggle: (key: "exclusion" | "forces" | "radiusLine" | "labels") => void;
  setFlagMode: (m: FlagMode) => void;
}

export const useView3D = create<View3DState>((set) => ({
  exclusion: true,
  forces: true,
  radiusLine: true,
  labels: true,
  flagMode: "off",
  set: (patch) => set(patch),
  toggle: (key) => set((s) => ({ [key]: !s[key] })),
  setFlagMode: (m) => set({ flagMode: m }),
}));
