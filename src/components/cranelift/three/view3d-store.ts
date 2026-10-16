"use client";

/**
 * IHMS CraneLift 3D — استور تنظیمات نمایش سه‌بعدی
 * -----------------------------------------------------------
 * خروجی‌های نمایشی (نه محاسباتی) صحنه: خطوط نیرو، منطقه ممنوعه،
 * حالت کلیک روی زمین (پرچم A/B، جابه‌جایی جرثقیل، افزودن تجهیز)
 * و تجهیز انتخاب‌شده. در localStorage ذخیره نمی‌شود.
 */

import { create } from "zustand";
import type { SceneObjectType } from "@/lib/cranelift/types";

/** حالت کلیک روی زمین صحنه */
export type FlagMode = "off" | "pick" | "place" | "moveCrane" | "object";

export interface View3DState {
  exclusion: boolean; // منطقه ممنوعه
  forces: boolean; // خطوط نیرو
  radiusLine: boolean; // خط شعاع کاری
  labels: boolean; // برچسب‌ها
  flagMode: FlagMode; // حالت فعال برای کلیک روی زمین
  pendingObjectType: SceneObjectType | null; // نوع تجهیز برای افزودن
  selectedObjectId: string | null; // تجهیز انتخاب‌شده در صحنه
  set: (patch: Partial<Omit<View3DState, "set" | "toggle" | "setFlagMode" | "startObjectMode" | "clearMode">>) => void;
  toggle: (key: "exclusion" | "forces" | "radiusLine" | "labels") => void;
  setFlagMode: (m: FlagMode) => void;
  /** شروع حالت افزودن تجهیز */
  startObjectMode: (t: SceneObjectType) => void;
  /** خروج از هر حالت کلیک */
  clearMode: () => void;
}

export const useView3D = create<View3DState>((set) => ({
  exclusion: true,
  forces: true,
  radiusLine: true,
  labels: true,
  flagMode: "off",
  pendingObjectType: null,
  selectedObjectId: null,
  set: (patch) => set(patch),
  toggle: (key) => set((s) => ({ [key]: !s[key] })),
  setFlagMode: (m) => set({ flagMode: m }),
  startObjectMode: (t) => set({ flagMode: "object", pendingObjectType: t, selectedObjectId: null }),
  clearMode: () => set({ flagMode: "off", pendingObjectType: null }),
}));
