/**
 * CraneLift Pro 3D — استور تنظیمات نمایش سه‌بعدی
 * -----------------------------------------------------------
 * خروجی‌های نمایشی (نه محاسباتی) صحنه: خطوط نیرو، منطقه ممنوعه و ...
 * در localStorage ذخیره نمی‌شود.
 */

import { create } from "zustand";

export interface View3DState {
  exclusion: boolean; // منطقه ممنوعه
  forces: boolean; // خطوط نیرو
  radiusLine: boolean; // خط شعاع کاری
  labels: boolean; // برچسب‌ها
  set: (patch: Partial<Omit<View3DState, "set">>) => void;
  toggle: (key: "exclusion" | "forces" | "radiusLine" | "labels") => void;
}

export const useView3D = create<View3DState>((set) => ({
  exclusion: true,
  forces: true,
  radiusLine: true,
  labels: true,
  set: (patch) => set(patch),
  toggle: (key) => set((s) => ({ [key]: !s[key] })),
}));
