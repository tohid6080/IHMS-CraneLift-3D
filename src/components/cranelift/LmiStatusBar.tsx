"use client";

/**
 * CraneLift Pro 3D — نوار وضعیت LMI (Load Moment Indicator)
 * -----------------------------------------------------------
 * نوار باریک وضعیت به سبک نمایشگرهای صنعتی LMI: چیپ‌های کوچک
 * «آیکون + برچسب فارسی + مقدار» به‌صورت اسکرول افقی، به‌همراه
 * گیج بار (Act / % / Max) با نوار پیشرفت رنگی بر اساس وضعیت تحلیل.
 * کامپوننت مستقل — بدون prop؛ همه مقادیر از استور خوانده می‌شود.
 */

import {
  Anvil,
  ArrowDownToLine,
  CalendarClock,
  Compass,
  MoveHorizontal,
  Ruler,
  Scale,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useLiftStore } from "@/lib/cranelift/store";
import { getCraneById } from "@/lib/cranelift/cranes";
import { STATUS_COLORS } from "@/lib/cranelift/analysis";

/** گرد کردن به یک رقم اعشار */
const fmt1 = (v: number): string => (Math.round(v * 10) / 10).toFixed(1);

/** چیپ کوچک وضعیت: آیکون + برچسب + مقدار (اعداد LTR با tabular-nums) */
function Chip({
  icon: Icon,
  label,
  value,
  unit,
  danger = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`flex shrink-0 items-center gap-1.5 rounded-md border bg-background/70 px-2 py-1 ${
        danger ? "border-red-500/60 bg-red-500/10" : ""
      }`}
    >
      <Icon
        aria-hidden
        className={`size-3.5 shrink-0 ${danger ? "text-red-500" : "text-amber-500"}`}
      />
      <span className="text-[10px] leading-none text-muted-foreground">{label}</span>
      <span
        dir="ltr"
        className={`text-xs font-bold leading-none tabular-nums ${
          danger ? "text-red-500" : "text-foreground"
        }`}
      >
        {value}
        {unit ? (
          <span className="ms-0.5 text-[9px] font-normal text-muted-foreground">{unit}</span>
        ) : null}
      </span>
    </div>
  );
}

export default function LmiStatusBar() {
  const inputs = useLiftStore((s) => s.inputs);
  const result = useLiftStore((s) => s.result);
  const meta = useLiftStore((s) => s.meta);
  const selectedCraneId = useLiftStore((s) => s.selectedCraneId);
  const customCranes = useLiftStore((s) => s.customCranes);

  const crane = getCraneById(selectedCraneId, customCranes);
  const grossT = inputs.loadWeightT + inputs.hookBlockWeightT + inputs.riggingWeightT;
  const boomAngleDeg = result?.boomAngleDeg ?? inputs.boomAngleDeg;
  // باد بیش از حد مجاز جرثقیل (حد مجاز فقط با جرثقیل انتخابی معنا دارد)
  const overWind = crane ? inputs.windSpeedMs > crane.specs.windLimitMs : false;

  const metaDate = new Date(meta.date);
  const dateStr = Number.isNaN(metaDate.getTime())
    ? "—"
    : metaDate.toLocaleDateString("fa-IR");

  const utilPct = result?.utilizationPct ?? null;
  const statusColor = result ? STATUS_COLORS[result.status] : undefined;

  return (
    <section
      aria-label="نوار وضعیت LMI"
      className="border-t border-slate-300/70 bg-slate-100 dark:border-slate-700/70 dark:bg-slate-900/80"
    >
      <div className="mx-auto w-full max-w-[1400px] px-2 py-1.5 sm:px-4">
        <div className="scroll-slim flex items-center gap-1.5 overflow-x-auto">
          <Chip icon={MoveHorizontal} label="شعاع" value={fmt1(inputs.radiusM)} unit="متر" />
          <Chip icon={Ruler} label="بوم" value={fmt1(inputs.boomLengthM)} unit="متر" />
          <Chip icon={Compass} label="زاویه بوم" value={fmt1(boomAngleDeg)} unit="°" />
          <Chip
            icon={ArrowDownToLine}
            label="قلاب (ارتفاع نیاز)"
            value={fmt1(inputs.requiredHookHeightM)}
            unit="متر"
          />
          <Chip
            icon={Wind}
            label="باد"
            value={fmt1(inputs.windSpeedMs)}
            unit="m/s"
            danger={overWind}
          />
          <Chip icon={Scale} label="بار کل" value={fmt1(grossT)} unit="تن" />

          {/* ── گیج بار LMI (برجسته) ── */}
          {result ? (
            <div
              className="flex shrink-0 items-center gap-2 rounded-md border-2 bg-background/70 px-2.5 py-1"
              style={{ borderColor: statusColor }}
            >
              <Scale aria-hidden className="size-4 shrink-0" style={{ color: statusColor }} />
              <div className="min-w-40">
                <div
                  dir="ltr"
                  className="flex items-baseline gap-1.5 text-xs font-black leading-none tabular-nums"
                >
                  <span>Act {fmt1(result.grossLoadT)}t</span>
                  <span style={{ color: statusColor }}>
                    {utilPct != null ? `${Math.round(utilPct)}%` : "—"}
                  </span>
                  <span className="font-medium text-muted-foreground">
                    Max {result.ratedCapacityT != null ? fmt1(result.ratedCapacityT) : "—"}t
                  </span>
                </div>
                <div aria-hidden className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, utilPct ?? 0))}%`,
                      backgroundColor: statusColor,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-2 rounded-md border-2 border-dashed bg-background/50 px-2.5 py-1.5 text-muted-foreground">
              <Scale aria-hidden className="size-4 shrink-0" />
              <span dir="ltr" className="text-xs font-bold leading-none tabular-nums">
                Act — | —% | Max —
              </span>
            </div>
          )}

          <Chip
            icon={Anvil}
            label="کانترویت"
            value={crane?.specs.counterweightT != null ? fmt1(crane.specs.counterweightT) : "—"}
            unit={crane ? "تن" : undefined}
          />

          {/* پروژه + تاریخ (تقویم شمسی) */}
          <div className="flex shrink-0 items-center gap-1.5 rounded-md border bg-background/70 px-2 py-1">
            <CalendarClock aria-hidden className="size-3.5 shrink-0 text-amber-500" />
            <span className="text-[10px] leading-none text-muted-foreground">پروژه</span>
            <span dir="ltr" className="text-xs font-bold leading-none tabular-nums">
              {meta.projectId}
            </span>
            <span aria-hidden className="text-[10px] leading-none text-muted-foreground">
              •
            </span>
            <span className="text-xs font-bold leading-none tabular-nums">{dateStr}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
