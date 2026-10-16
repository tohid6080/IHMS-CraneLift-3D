/**
 * IHMS CraneLift 3D — کاتالوگ تجهیزات محوطه (نیروگاه / پالایشگاه)
 * -----------------------------------------------------------
 * هر تجهیز: برچسب فارسی، ابعاد پایه (متر)، ارتفاع و رنگ پیش‌فرض.
 * ابعاد در ساخت مدل سه‌بعدی (CraneScene) و جدول تجهیزات گزارش PDF استفاده می‌شود.
 */

import type { SceneObjectType } from "./types";

export interface SceneObjectMeta {
  label: string; // برچسب فارسی
  w: number; // طول در راستای X محلی (متر)
  d: number; // عمق در راستای Z محلی (متر)
  h: number; // ارتفاع (متر)
  color: string; // رنگ HEX بدنه
  edge: string; // رنگ لبه‌ها
}

export const SCENE_OBJECT_CATALOG: Record<SceneObjectType, SceneObjectMeta> = {
  foundation: {
    label: "فونداسیون بتنی",
    w: 8,
    d: 8,
    h: 1.4,
    color: "#9ca3af",
    edge: "#6b7280",
  },
  structure: {
    label: "سازه فولادی",
    w: 12,
    d: 8,
    h: 14,
    color: "#64748b",
    edge: "#334155",
  },
  column: {
    label: "برج فرآیندی (کلومن)",
    w: 3.2,
    d: 3.2,
    h: 28,
    color: "#cbd5e1",
    edge: "#94a3b8",
  },
  tank: {
    label: "مخزن ذخیره",
    w: 12,
    d: 12,
    h: 11,
    color: "#e2e8f0",
    edge: "#a8b3c2",
  },
  exchanger: {
    label: "مبدل حرارتی",
    w: 7,
    d: 3,
    h: 3.2,
    color: "#a8a29e",
    edge: "#78716c",
  },
  coolingTower: {
    label: "برج خنک‌کننده",
    w: 10,
    d: 10,
    h: 16,
    color: "#b8bfc7",
    edge: "#8b939d",
  },
  pipeRack: {
    label: "راک لوله",
    w: 14,
    d: 4,
    h: 6,
    color: "#78716c",
    edge: "#57534e",
  },
  container: {
    label: "کانتینر / شلتر",
    w: 6,
    d: 2.5,
    h: 2.6,
    color: "#b45309",
    edge: "#7c2d12",
  },
  boiler: {
    label: "بویلر",
    w: 9,
    d: 9,
    h: 15,
    color: "#475569",
    edge: "#1e293b",
  },
  stack: {
    label: "دودکش",
    w: 2.8,
    d: 2.8,
    h: 32,
    color: "#a1a1aa",
    edge: "#71717a",
  },
  cableDrum: {
    label: "قرقره کابل",
    w: 3.4,
    d: 3.4,
    h: 2.6,
    color: "#a16207",
    edge: "#713f12",
  },
  controlRoom: {
    label: "اتاق کنترل",
    w: 8,
    d: 3.5,
    h: 3.5,
    color: "#e7e5e4",
    edge: "#a8a29e",
  },
  transformer: {
    label: "ترانس قدرت",
    w: 4.5,
    d: 3.2,
    h: 3.8,
    color: "#3f6212",
    edge: "#1a2e05",
  },
};

/** فهرست مرتب برای نمایش در پالت UI */
export const SCENE_OBJECT_LIST = (
  Object.keys(SCENE_OBJECT_CATALOG) as SceneObjectType[]
).map((type) => ({ type, ...SCENE_OBJECT_CATALOG[type] }));

/** برچسب کوتاه برای سلکت‌ها و گزارش */
export function sceneObjectLabel(type: SceneObjectType): string {
  return SCENE_OBJECT_CATALOG[type].label;
}

/** ساخت شناسه یکتا برای نمونه تجهیز */
export function makeSceneObjectId(type: SceneObjectType): string {
  return `${type}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}
