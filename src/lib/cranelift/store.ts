/**
 * CraneLift Pro 3D — استور مرکزی (Zustand + persist روی localStorage)
 * -----------------------------------------------------------
 * تمام وضعیت برنامه: مرحله ویزارد، جرثقیل انتخابی، لودچارت‌های سفارشی،
 * ورودی‌های لیفت، نتیجه تحلیل و متادیتای پروژه.
 * اسکرین‌شات‌ها persist نمی‌شوند (حجم بالا).
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AnalysisResult,
  LiftInputs,
  LoadChart,
  ProjectMeta,
} from "./types";

/** ورودی‌های پیش‌فرض لیفت */
export const DEFAULT_INPUTS: LiftInputs = {
  loadWeightT: 10,
  loadDims: { lengthM: 6, widthM: 2.4, heightM: 2.4 },
  hookBlockWeightT: 0.5,
  riggingWeightT: 0.2,
  rigging: { slingCount: 4, slingAngleDeg: 60, useSpreader: false },
  radiusMode: "radius",
  radiusM: 12,
  boomAngleDeg: 60,
  boomLengthM: 24,
  useJib: false,
  jibLengthM: 12,
  jibAngleDeg: 30,
  requiredHookHeightM: 10,
  slewAngleDeg: 45,
  windSpeedMs: 6,
  windGust: false,
  groundSlopeDeg: 0,
  safetyFactor: 1.1,
  obstacle: { enabled: false, xM: 18, zM: 8, heightM: 10, widthM: 4 },
  notes: "",
};

/** متادیتای پیش‌فرض پروژه */
function defaultMeta(): ProjectMeta {
  return {
    projectId: `CLP-${Date.now().toString(36).toUpperCase()}`,
    projectName: "پروژه لیفت جدید",
    location: "",
    engineerName: "",
    companyName: "",
    date: new Date().toISOString(),
  };
}

interface CraneLiftState {
  // ── ویزارد ──
  step: number; // 0..5
  setStep: (n: number) => void;
  next: () => void;
  prev: () => void;

  // ── پروژه ──
  meta: ProjectMeta;
  setMeta: (patch: Partial<ProjectMeta>) => void;

  // ── جرثقیل ──
  selectedCraneId: string | null;
  selectCrane: (id: string | null) => void;

  // ── لودچارت سفارشی ──
  customCharts: Record<string, LoadChart>;
  setCustomChart: (craneId: string, chart: LoadChart) => void;
  resetChart: (craneId: string) => void;

  // ── ورودی‌های لیفت ──
  inputs: LiftInputs;
  setInputs: (patch: Partial<LiftInputs>) => void;
  setRigging: (patch: Partial<LiftInputs["rigging"]>) => void;
  setDims: (patch: Partial<LiftInputs["loadDims"]>) => void;
  setObstacle: (patch: Partial<LiftInputs["obstacle"]>) => void;

  // ── نتیجه تحلیل ──
  result: AnalysisResult | null;
  setResult: (r: AnalysisResult | null) => void;

  // ── تصاویر (persist نمی‌شوند) ──
  screenshot3D: string | null;
  setScreenshot3D: (s: string | null) => void;
  chartImage: string | null;
  setChartImage: (s: string | null) => void;

  // ── عمومی ──
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  resetAll: () => void;
}

export const useLiftStore = create<CraneLiftState>()(
  persist(
    (set, get) => ({
      // ویزارد
      step: 0,
      setStep: (n) => set({ step: Math.max(0, Math.min(5, n)) }),
      next: () => set({ step: Math.min(5, get().step + 1) }),
      prev: () => set({ step: Math.max(0, get().step - 1) }),

      // پروژه
      meta: defaultMeta(),
      setMeta: (patch) => set({ meta: { ...get().meta, ...patch } }),

      // جرثقیل
      selectedCraneId: null,
      selectCrane: (id) => {
        set({ selectedCraneId: id, result: null });
      },

      // لودچارت
      customCharts: {},
      setCustomChart: (craneId, chart) =>
        set({ customCharts: { ...get().customCharts, [craneId]: chart } }),
      resetChart: (craneId) => {
        const next = { ...get().customCharts };
        delete next[craneId];
        set({ customCharts: next });
      },

      // ورودی‌ها
      inputs: DEFAULT_INPUTS,
      setInputs: (patch) => set({ inputs: { ...get().inputs, ...patch } }),
      setRigging: (patch) =>
        set({
          inputs: {
            ...get().inputs,
            rigging: { ...get().inputs.rigging, ...patch },
          },
        }),
      setDims: (patch) =>
        set({
          inputs: {
            ...get().inputs,
            loadDims: { ...get().inputs.loadDims, ...patch },
          },
        }),
      setObstacle: (patch) =>
        set({
          inputs: {
            ...get().inputs,
            obstacle: { ...get().inputs.obstacle, ...patch },
          },
        }),

      // نتیجه
      result: null,
      setResult: (r) => set({ result: r }),

      // تصاویر
      screenshot3D: null,
      setScreenshot3D: (s) => set({ screenshot3D: s }),
      chartImage: null,
      setChartImage: (s) => set({ chartImage: s }),

      // عمومی
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
      resetAll: () =>
        set({
          step: 0,
          meta: defaultMeta(),
          selectedCraneId: null,
          customCharts: {},
          inputs: DEFAULT_INPUTS,
          result: null,
          screenshot3D: null,
          chartImage: null,
        }),
    }),
    {
      name: "cranelift-pro-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true, // برای جلوگیری از mismatch — دستی rehydrate می‌کنیم
      partialize: (state) => {
        // تصاویر و پرچم hydrate ذخیره نمی‌شوند
        const { screenshot3D: _s, chartImage: _c, hydrated: _h, ...rest } = state;
        return rest as CraneLiftState;
      },
    }
  )
);

/**
 * هوک هیدراته‌کردن استور (یک‌بار در ریشه اپ)
 */
export function useHydrateLiftStore(): boolean {
  const hydrated = useLiftStore((s) => s.hydrated);
  const setHydrated = useLiftStore((s) => s.setHydrated);
  if (typeof window !== "undefined" && !hydrated && !useLiftStore.persist.hasHydrated()) {
    // rehydrate دستی
    void Promise.resolve(useLiftStore.persist.rehydrate()).then(() =>
      setHydrated(true)
    );
  }
  return hydrated;
}
