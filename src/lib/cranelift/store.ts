/**
 * IHMS CraneLift 3D — استور مرکزی (Zustand + persist روی localStorage)
 * -----------------------------------------------------------
 * تمام وضعیت برنامه: مرحله ویزارد، جرثقیل انتخابی، لودچارت‌های سفارشی،
 * ورودی‌های لیفت، نتیجه تحلیل و متادیتای پروژه.
 * اسکرین‌شات‌ها persist نمی‌شوند (حجم بالا).
 */

import { Capacitor } from "@capacitor/core";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AnalysisResult,
  Crane,
  GroundPoint,
  LiftInputs,
  LoadChart,
  ProjectMeta,
  SceneObjectInstance,
  TransferResult,
} from "./types";
import { makeSceneObjectId } from "./scene-objects";

export type { GroundPoint } from "./types";
import {
  consumeQuota,
  DEFAULT_LICENSE,
  freshUsage,
  todayKey,
  type LicenseState,
  type QuotaKind,
  type UsageCounters,
} from "./licensing";

/** ساخت شناسه یکتا برای جرثقیل سفارشی */
export function makeCustomCraneId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `custom-${slug || "crane"}-${Date.now().toString(36)}`;
}

/**
 * لودچارت اولیه برای جرثقیل سفارشی: گرید خالی (طول‌های بوم × شعاع‌ها)
 * بدون هیچ مقدار — کاربر باید مقادیر را از لودچارت رسمی وارد کند.
 */
export function seedCustomChart(crane: Crane): LoadChart {
  const s = crane.specs;
  const isTower = crane.type === "tower";
  const boomSteps = 3;
  const boomLens: number[] = [];
  for (let i = 0; i < boomSteps; i++) {
    const v = s.mainBoomMinM + ((s.mainBoomMaxM - s.mainBoomMinM) * i) / (boomSteps - 1);
    boomLens.push(Math.round(v * 10) / 10);
  }
  const radii: number[] = [];
  const step = Math.max(1, Math.round((s.maxRadiusM - s.minRadiusM) / 8));
  for (let r = s.minRadiusM; r <= s.maxRadiusM; r += step) {
    radii.push(Math.round(r * 10) / 10);
  }
  return {
    craneId: crane.id,
    source: "custom",
    updatedAt: new Date().toISOString(),
    sections: boomLens.map((boomLengthM) => ({ boomLengthM, points: [] })),
    pages: [
      {
        id: "main",
        label: `جدول اصلی${s.counterweightT ? ` — کانترویت ${s.counterweightT} تن` : ""}`,
        counterweightT: s.counterweightT,
        partsOfLinePct: 100,
        sections: boomLens.map((boomLengthM) => ({ boomLengthM, points: [] })),
        notes: isTower
          ? []
          : ["مقادیر جدول را از لودچارت رسمی سازنده وارد کنید (سلول خالی = غیرمجاز)."],
      },
    ],
    activePageId: "main",
  };
}

/** ورودی‌های پیش‌فرض لیفت */
export const DEFAULT_INPUTS: LiftInputs = {
  loadWeightT: 10,
  loadDims: { lengthM: 6, widthM: 2.4, heightM: 2.4 },
  hookBlockWeightT: 0.5,
  riggingWeightT: 0.2,
  rigging: { slingCount: 4, slingAngleDeg: 60, useSpreader: false },
  partsOfLine: 8,
  ropeOverrideMblT: null,
  radiusMode: "radius",
  radiusM: 12,
  boomAngleDeg: 60,
  boomLengthM: 24,
  useJib: false,
  jibLengthM: 12,
  jibAngleDeg: 30,
  requiredHookHeightM: 10,
  pickHeightM: 1.2,
  placeHeightM: 0,
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

  // ── جرثقیل‌های سفارشی کاربر ──
  customCranes: Crane[];
  addCustomCrane: (crane: Crane) => void; // + ساخت لودچارت خالی اولیه
  updateCustomCrane: (id: string, patch: Partial<Crane>) => void;
  removeCustomCrane: (id: string) => void;

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

  // ── پرچم‌های برداشت/جایگذاری (نقاط A و B) ──
  pickPoint: GroundPoint | null;
  placePoint: GroundPoint | null;
  setPickPoint: (p: GroundPoint) => void;
  setPlacePoint: (p: GroundPoint) => void;
  clearFlags: () => void;

  // ── موقعیت استقرار جرثقیل (جابه‌جایی جرثقیل در صحنه) ──
  cranePos: GroundPoint | null; // null = مرکز صحنه (۰،۰)
  setCranePos: (p: GroundPoint | null) => void;

  // ── تجهیزات محوطه (نیروگاه/پالایشگاه) ──
  sceneObjects: SceneObjectInstance[];
  addSceneObject: (type: SceneObjectInstance["type"], x: number, z: number) => void;
  updateSceneObject: (id: string, patch: Partial<SceneObjectInstance>) => void;
  removeSceneObject: (id: string) => void;
  clearSceneObjects: () => void;

  // ── لایسنس و سهمیه نسخه رایگان ──
  // فعال‌سازی فقط از نتیجه‌ی خریدِ واقعیِ تأییدشده توسطِ پلاگینِ نیتیوِ
  // BazaarBilling (کافه‌بازار/Poolakey) انجام می‌شود؛ هیچ کدِ دستی‌واردشونده‌ای
  // در این نسخه پذیرفته نیست.
  license: LicenseState;
  activatePro: (purchase: { purchaseToken: string; orderId?: string }) => void;
  deactivate: () => void;
  /** هم‌گام‌سازیِ وضعیتِ لایسنس با نتیجه‌ی queryPurchases() پلاگینِ نیتیو (منبعِ معتبر) */
  syncLicenseFromNative: (owned: boolean, purchaseToken?: string) => void;
  usage: UsageCounters;
  consume: (kind: QuotaKind) => void;

  // ── نتیجه شبیه‌سازی جابجایی دوعرچه‌ای ──
  transfer: TransferResult | null;
  setTransfer: (t: TransferResult | null) => void;

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

      // جرثقیل‌های سفارشی
      customCranes: [],
      addCustomCrane: (crane) => {
        const seed = seedCustomChart(crane);
        set({
          customCranes: [...get().customCranes, crane],
          customCharts: { ...get().customCharts, [crane.id]: seed },
          selectedCraneId: crane.id,
          result: null,
        });
      },
      updateCustomCrane: (id, patch) => {
        set({
          customCranes: get().customCranes.map((c) =>
            c.id === id ? { ...c, ...patch } : c
          ),
        });
      },
      removeCustomCrane: (id) => {
        const next = { ...get().customCharts };
        delete next[id];
        set({
          customCranes: get().customCranes.filter((c) => c.id !== id),
          customCharts: next,
          selectedCraneId: get().selectedCraneId === id ? null : get().selectedCraneId,
          result: null,
        });
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

      // پرچم‌ها — نقطه برداشت شعاع کاری را همزمان (نسبت به جرثقیل) به‌روز می‌کند
      pickPoint: null,
      placePoint: null,
      setPickPoint: (p) => {
        const o = get().cranePos ?? { x: 0, z: 0 };
        set({
          pickPoint: p,
          inputs: {
            ...get().inputs,
            radiusMode: "radius",
            radiusM: Math.round(Math.hypot(p.x - o.x, p.z - o.z) * 10) / 10,
          },
        });
      },
      setPlacePoint: (p) => set({ placePoint: p }),
      clearFlags: () => set({ pickPoint: null, placePoint: null }),

      // جابه‌جایی جرثقیل — شعاع کاری نسبت به موقعیت جدید بازمحاسبه می‌شود
      cranePos: null,
      setCranePos: (p) => {
        const st = get();
        const o = p ?? { x: 0, z: 0 };
        const patch: Partial<CraneLiftState> = { cranePos: p };
        if (st.pickPoint) {
          patch.inputs = {
            ...st.inputs,
            radiusM: Math.round(Math.hypot(st.pickPoint.x - o.x, st.pickPoint.z - o.z) * 10) / 10,
          };
        }
        set(patch as CraneLiftState);
      },

      // تجهیزات محوطه
      sceneObjects: [],
      addSceneObject: (type, x, z) =>
        set({
          sceneObjects: [
            ...get().sceneObjects,
            { id: makeSceneObjectId(type), type, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, rotDeg: 0, scale: 1 },
          ],
        }),
      updateSceneObject: (id, patch) =>
        set({
          sceneObjects: get().sceneObjects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
        }),
      removeSceneObject: (id) =>
        set({ sceneObjects: get().sceneObjects.filter((o) => o.id !== id) }),
      clearSceneObjects: () => set({ sceneObjects: [] }),

      // لایسنس
      license: DEFAULT_LICENSE,
      activatePro: ({ purchaseToken, orderId }) =>
        set({
          license: {
            plan: "pro",
            purchaseToken,
            activatedAt: new Date().toISOString(),
          },
        }),
      deactivate: () => set({ license: DEFAULT_LICENSE }),
      syncLicenseFromNative: (owned, purchaseToken) =>
        set((s) => {
          if (owned) {
            return {
              license: {
                plan: "pro",
                purchaseToken: purchaseToken ?? s.license.purchaseToken,
                activatedAt: s.license.activatedAt ?? new Date().toISOString(),
              },
            };
          }
          // کافه‌بازار مالکیتی گزارش نکرده (خرید نشده یا رفاند شده) — سمتِ
          // کلاینت هیچ وضعیتِ Pro‌ای معتبر نیست، صرف‌نظر از آنچه قبلاً در
          // localStorage ذخیره شده بود.
          return { license: DEFAULT_LICENSE };
        }),
      usage: freshUsage(),
      consume: (kind) => set({ usage: consumeQuota(get().license.plan, get().usage, kind) }),

      // شبیه‌سازی جابجایی
      transfer: null,
      setTransfer: (t) => set({ transfer: t }),

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
          customCranes: [],
          customCharts: {},
          inputs: DEFAULT_INPUTS,
          result: null,
          screenshot3D: null,
          chartImage: null,
          pickPoint: null,
          placePoint: null,
          cranePos: null,
          sceneObjects: [],
          transfer: null,
          usage: freshUsage(),
        }),
    }),
    {
      name: "cranelift-pro-v1",
      // روی اندرویدِ نیتیو (Capacitor) پروژه باید بینِ جلسات باقی بماند
      // (همان رفتارِ همیشگیِ نسخه‌ی خریداری‌شده) → localStorage. در مرورگر
      // (نسخه‌ی آزمایشیِ تعبیه‌شده در IHMS) طبقِ خواسته‌ی محصول، اطلاعاتِ
      // لیفت کاملاً موقتی‌اند و با بستنِ تب پاک می‌شوند → sessionStorage.
      storage: createJSONStorage(() =>
        Capacitor.isNativePlatform() ? window.localStorage : window.sessionStorage
      ),
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
    // rehydrate دستی + ادغام فیلدهای جدید با پیش‌فرض‌ها (سازگاری نسخه‌های قدیمی)
    void Promise.resolve(useLiftStore.persist.rehydrate()).then(() => {
      const st = useLiftStore.getState();
      useLiftStore.setState({
        inputs: { ...DEFAULT_INPUTS, ...(st.inputs ?? {}) },
        license: { ...DEFAULT_LICENSE, ...(st.license ?? {}) },
        usage: st.usage?.date === todayKey() ? st.usage : freshUsage(),
        transfer: st.transfer ?? null,
        pickPoint: st.pickPoint ?? null,
        placePoint: st.placePoint ?? null,
        cranePos: st.cranePos ?? null,
        sceneObjects: Array.isArray(st.sceneObjects) ? st.sceneObjects : [],
      });
      setHydrated(true);

      // هم‌گام‌سازیِ وضعیتِ Pro با نتیجه‌ی واقعیِ کافه‌بازار (فقط روی اندرویدِ
      // نیتیو اثر دارد). این تضمین می‌کند که وضعیتِ ذخیره‌شده در localStorage
      // صرفاً یک کَش است، نه منبعِ معتبرِ لایسنس — چون localStorage به‌تنهایی
      // توسطِ خودِ کاربر هم قابلِ‌ویرایش است.
      import("./bazaarBilling").then(({ isNativeBillingAvailable, queryProOwnership }) => {
        if (!isNativeBillingAvailable()) return;
        queryProOwnership().then((res) => {
          if (res) useLiftStore.getState().syncLicenseFromNative(res.owned, res.purchaseToken);
        });
      });
    });
  }
  return hydrated;
}
