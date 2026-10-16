/**
 * IHMS CraneLift 3D — اجرای تحلیل لیفت (جریان واحد Play)
 * -----------------------------------------------------------
 * دکمه «تحلیل لیفت / Play» همه کارها را یکجا انجام می‌دهد:
 *   ۱) تحلیل کامل ظرفیت/ایمنی (analyzeLift) + ثبت نتیجه
 *   ۲) به‌روزرسانی اسکرین‌شات صحنه سه‌بعدی و منحنی لودچارت برای گزارش
 *   ۳) اگر هر دو پرچم A/B ثبت شده باشند: تحلیل جابجایی (planTransfer)
 *      + اجرای شبیه‌سازی حرکت جرثقیل (برداشت از A → جایگذاری در B)
 *   ۴) در پایان حرکت، کارت «مجاز / غیرمجاز» با محل مشکل و راهکار نمایش داده می‌شود
 */

import { useLiftStore } from "@/lib/cranelift/store";
import { getCraneById } from "@/lib/cranelift/cranes";
import { getChartFor } from "@/lib/cranelift/load-charts";
import { analyzeLift } from "@/lib/cranelift/analysis";
import { planTransfer } from "@/lib/cranelift/simulation";
import { captureScene } from "@/lib/cranelift/capture";
import type { AnalysisResult } from "@/lib/cranelift/types";
import { quotaCheck } from "@/lib/cranelift/licensing";
import { useSim } from "./three/sim-store";

/** اجرای تحلیل کامل + ثبت تصاویر. اگر جرثقیلی انتخاب نشده باشد null برمی‌گرداند. */
export async function runAnalysis(): Promise<AnalysisResult | null> {
  const s = useLiftStore.getState();
  const crane = getCraneById(s.selectedCraneId, s.customCranes);
  if (!crane) return null;

  const chart = getChartFor(crane.id, s.customCharts);
  const result = analyzeLift(crane, chart, s.inputs);
  useLiftStore.setState({ result });

  // ── اسکرین‌شات صحنه سه‌بعدی (اگر صحنه در حال رندر باشد) ──
  const shot = captureScene();
  if (shot) useLiftStore.getState().setScreenshot3D(shot);

  // ── تصویر منحنی لودچارت از مونتاژ مخفی (#loadchart-curve) ──
  try {
    const el = document.getElementById("loadchart-curve");
    if (el) {
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(el, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
      });
      useLiftStore.getState().setChartImage(canvas.toDataURL("image/png"));
    }
  } catch (e) {
    // تصویر منحنی حیاتی نیست؛ اما دلیل شکست لاگ می‌شود
    console.warn("[CraneLift] chart capture failed:", e);
  }

  return result;
}

/**
 * شروع شبیه‌سازی حرکت دوپرچمی: تحلیل هر دو نقطه (نسبت به محل استقرار جرثقیل)
 * + ثبت نتیجه + اجرای انیمیشن.
 * خروجی: "started" | "no-flags" | "no-crane"
 */
export function startTransferSim(): "started" | "no-flags" | "no-crane" {
  const s = useLiftStore.getState();
  const crane = getCraneById(s.selectedCraneId, s.customCranes);
  if (!crane) return "no-crane";
  if (!s.pickPoint || !s.placePoint) return "no-flags";

  const chart = getChartFor(crane.id, s.customCharts);
  const origin = s.cranePos ?? { x: 0, z: 0 };
  const transfer = planTransfer(crane, chart, s.inputs, s.pickPoint, s.placePoint, origin);
  useLiftStore.setState({ transfer });
  useSim.getState().start();
  return "started";
}

/** توقف/بازنشانی شبیه‌سازی */
export function stopTransferSim() {
  useSim.getState().reset();
}

// ───────────────────────── جریان واحد Play ─────────────────────────

/** پیام‌های toast نتیجه */
const RESULT_TITLES = {
  allowed: "✅ لیفت مجاز است",
  caution: "⚠️ نیازمند بررسی بیشتر",
  "not-allowed": "⛔ لیفت غیرمجاز است",
} as const;

export interface UnifiedPlayDeps {
  /** نمایش پیام (useToast) */
  toast: (t: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void;
  /** باز کردن دیالوگ ارتقا هنگام اتمام سهمیه نسخه رایگان */
  onQuotaExceeded: () => void;
}

/**
 * جریان واحد «تحلیل لیفت / Play» — هم در پنل سه‌بعدی و هم در مرحله تحلیل
 * از همین تابع استفاده می‌کند تا شبیه‌سازی و تحلیل یکی باشند.
 * - اگر دو پرچم ثبت شده باشد: پس از تحلیل، حرکت جرثقیل A→B اجرا و به مرحله صحنه می‌رود.
 * - در غیر این صورت: فقط تحلیل و نمایش نتیجه.
 */
export async function playUnified(deps: UnifiedPlayDeps): Promise<void> {
  const { toast, onQuotaExceeded } = deps;
  const s = useLiftStore.getState();
  const crane = getCraneById(s.selectedCraneId, s.customCranes);
  if (!crane) {
    toast({ title: "ابتدا جرثقیل انتخاب کنید", variant: "destructive" });
    return;
  }

  // سهمیه نسخه رایگان (شبیه‌سازی حرکت هم بخشی از همان تحلیل است)
  const q = quotaCheck(s.license.plan, s.usage, "analysis");
  if (!q.ok) {
    toast({
      title: "سهمیه تحلیل و شبیه‌سازی امروز تمام شد",
      description: `سقف نسخه رایگان: ${q.limit} اجرا در روز. برای استفاده نامحدود، ارتقا دهید.`,
      variant: "destructive",
    });
    onQuotaExceeded();
    return;
  }

  // ۱) تحلیل + تصاویر
  const r = await runAnalysis();
  if (!r) return;
  useLiftStore.getState().consume("analysis");

  const st = useLiftStore.getState();
  const bothFlags = !!(st.pickPoint && st.placePoint);

  // ۲) جابجایی دوپرچمی: تحلیل هر دو نقطه + اجرای حرکت
  if (bothFlags) {
    const res = startTransferSim();
    if (res === "started") {
      // رفتن به مرحله صحنه برای تماشای حرکت — نتیجه در پایان حرکت نمایش داده می‌شود
      useLiftStore.getState().setStep(3);
      toast({
        title: "تحلیل انجام شد — حرکت جرثقیل آغاز شد",
        description:
          "برداشت از پرچم A و جایگذاری در پرچم B را تماشا کنید؛ نتیجه مجاز/غیرمجاز در پایان حرکت نمایش داده می‌شود.",
      });
      return;
    }
  }

  // ۳) بدون پرچم: نمایش نتیجه تحلیل
  toast({
    title: RESULT_TITLES[r.status],
    description:
      r.status === "allowed"
        ? `استفاده از ظرفیت: ${r.utilizationPct?.toFixed(0)}٪`
        : r.warnings.find((w) => w.level === "danger")?.message ?? r.conclusion,
    variant: r.status === "not-allowed" ? "destructive" : "default",
  });
}
