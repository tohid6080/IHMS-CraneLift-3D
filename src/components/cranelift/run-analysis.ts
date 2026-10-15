/**
 * CraneLift Pro 3D — اجرای تحلیل لیفت
 * -----------------------------------------------------------
 * تحلیل را اجرا می‌کند، نتیجه را در استور ثبت و اسکرین‌شات‌های
 * صحنه سه‌بعدی و منحنی لودچارت را برای گزارش PDF به‌روزرسانی می‌کند.
 */

import { useLiftStore } from "@/lib/cranelift/store";
import { getCraneById } from "@/lib/cranelift/cranes";
import { getChartFor } from "@/lib/cranelift/load-charts";
import { analyzeLift } from "@/lib/cranelift/analysis";
import { captureScene } from "@/lib/cranelift/capture";
import type { AnalysisResult } from "@/lib/cranelift/types";

/** اجرای تحلیل کامل + ثبت تصاویر. اگر جرثقیلی انتخاب نشده باشد null برمی‌گرداند. */
export async function runAnalysis(): Promise<AnalysisResult | null> {
  const s = useLiftStore.getState();
  const crane = getCraneById(s.selectedCraneId);
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
