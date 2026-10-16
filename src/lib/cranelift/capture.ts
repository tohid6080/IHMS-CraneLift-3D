/**
 * IHMS CraneLift 3D — مرجع ثبت اسکرین‌شات صحنه سه‌بعدی
 * -----------------------------------------------------------
 * چون Canvas سه‌بعدی در عمق درخت کامپوننت‌ها قرار دارد، از یک
 * مرجع ماژول‌سطح (module-level) برای دسترسی امپراتیو به تابع
 * capture استفاده می‌کنیم. این مرجع در Canvas ثبت می‌شود.
 */

export const sceneCapture: {
  /** تابع capture که توسط کامپوننت داخل Canvas ثبت می‌شود */
  capture: (() => string | null) | null;
} = {
  capture: null,
};

/** گرفتن اسکرین‌شات از صحنه (اگر ثبت شده باشد) */
export function captureScene(): string | null {
  try {
    return sceneCapture.capture?.() ?? null;
  } catch {
    return null;
  }
}
