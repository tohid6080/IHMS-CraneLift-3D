"use client";

/**
 * CraneLift Pro 3D — نمودار منحنی لودچارت (Recharts)
 * -----------------------------------------------------------
 * نمایش منحنی ظرفیت-شعاع برای همه سکشن‌های طول بوم یک لودچارت.
 * - داده هر سکشن با درون‌یابی خطی بین نقاط همان سکشن ساخته می‌شود؛
 *   شعاع خارج از بازهٔ آن سکشن → undefined (خط در آن ناحیه رسم نمی‌شود).
 * - highlight → خطوط مرجع عمودی (شعاع کاری) و افقی (بار کل) قرمز.
 * نکته: این کامپوننت id خاصی ندارد؛ میزبانِ خودش را بیرون تعیین می‌کند.
 */

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LoadChart, LoadChartPoint } from "@/lib/cranelift/types";

/** پالت رنگ خطوط سکشن‌ها — بدون آبی/نیلی (کهکشان کهربایی محور است) */
const STROKE_PALETTE = [
  "#d97706",
  "#65a30d",
  "#dc2626",
  "#0d9488",
  "#9333ea",
  "#525252",
  "#b45309",
  "#15803d",
] as const;

export interface LoadChartCurveProps {
  chart: LoadChart | null;
  /** خطوط مرجع روی نمودار: شعاع کاری / بار کل / طول بوم فعلی */
  highlight?: {
    radiusM?: number;
    grossLoadT?: number;
    boomLengthM?: number;
  };
  /** ارتفاع نمودار (پیکسل) — پیش‌فرض ۳۲۰ */
  height?: number;
}

/** یک ردیف دادهٔ نمودار: شعاع + ظرفیت درون‌یابی‌شدهٔ هر سکشن (کلید sN) */
type CurveRow = { r: number } & Record<string, number | undefined>;

/**
 * درون‌یابی خطی ظرفیت یک سکشن در شعاع دلخواه،
 * فقط بر اساس نقاط خود سکشن؛ خارج از بازه → undefined.
 */
function interpolateSection(
  points: LoadChartPoint[],
  r: number
): number | undefined {
  if (points.length === 0) return undefined;
  const sorted = [...points].sort((a, b) => a.radiusM - b.radiusM);
  const minR = sorted[0].radiusM;
  const maxR = sorted[sorted.length - 1].radiusM;
  if (r < minR || r > maxR) return undefined;
  if (r === minR) return sorted[0].capacityT;
  if (r === maxR) return sorted[sorted.length - 1].capacityT;
  for (let i = 1; i < sorted.length; i++) {
    const p0 = sorted[i - 1];
    const p1 = sorted[i];
    if (r <= p1.radiusM) {
      const span = p1.radiusM - p0.radiusM;
      const t = span > 0 ? (r - p0.radiusM) / span : 0;
      return p0.capacityT + t * (p1.capacityT - p0.capacityT);
    }
  }
  return undefined;
}

/** گردکردن به ۲ رقم اعشار برای نمایش تمیز در تولتیپ */
const round2 = (v: number): number => Math.round(v * 100) / 100;

export default function LoadChartCurve({
  chart,
  highlight,
  height = 320,
}: LoadChartCurveProps) {
  // ── ساخت داده: اجتماع همهٔ شعاع‌ها (مرتب صعودی) + ظرفیت هر سکشن ──
  const data: CurveRow[] = useMemo(() => {
    if (!chart || chart.sections.length === 0) return [];
    const radiusSet = new Set<number>();
    for (const s of chart.sections) {
      for (const p of s.points) radiusSet.add(p.radiusM);
    }
    const radii = [...radiusSet].sort((a, b) => a - b);
    return radii.map((r) => {
      const row: CurveRow = { r };
      chart.sections.forEach((s, i) => {
        const cap = interpolateSection(s.points, r);
        if (cap !== undefined) row[`s${i}`] = round2(cap);
      });
      return row;
    });
  }, [chart]);

  const hasData = chart !== null && chart.sections.length > 0 && data.length > 0;

  return (
    <div
      dir="ltr"
      className="w-full"
      style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: 8 }}
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={data}
            margin={{ top: 14, right: 18, bottom: 4, left: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="r"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
              label={{
                value: "شعاع (متر)",
                position: "insideBottom",
                offset: -2,
                fontSize: 11,
                fill: "#6b7280",
              }}
            />
            <YAxis
              width={46}
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
              label={{
                value: "ظرفیت (تن)",
                angle: -90,
                position: "insideLeft",
                fontSize: 11,
                fill: "#6b7280",
              }}
            />
            <Tooltip
              formatter={(value) => `${value} تن`}
              labelFormatter={(v) => `شعاع: ${v} متر`}
              contentStyle={{
                direction: "rtl",
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
            />
            <Legend
              verticalAlign="bottom"
              wrapperStyle={{ direction: "rtl", fontSize: 11 }}
            />
            {/* خط مرجع عمودی: شعاع کاری فعلی */}
            {highlight?.radiusM !== undefined && (
              <ReferenceLine
                x={highlight.radiusM}
                stroke="#ef4444"
                strokeDasharray="6 4"
                label={{
                  value: "شعاع",
                  fill: "#ef4444",
                  fontSize: 11,
                  position: "top",
                }}
              />
            )}
            {/* خط مرجع افقی: بار کل */}
            {highlight?.grossLoadT !== undefined && (
              <ReferenceLine
                y={highlight.grossLoadT}
                stroke="#ef4444"
                strokeDasharray="6 4"
                label={{
                  value: "بار",
                  fill: "#ef4444",
                  fontSize: 11,
                  position: "insideTopRight",
                }}
              />
            )}
            {chart?.sections.map((s, i) => (
              <Line
                key={`s${i}`}
                dataKey={`s${i}`}
                name={`بوم ${s.boomLengthM} م`}
                type="monotone"
                dot={false}
                strokeWidth={highlight?.boomLengthM === s.boomLengthM ? 3.5 : 2}
                stroke={STROKE_PALETTE[i % STROKE_PALETTE.length]}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div
          className="flex items-center justify-center text-sm"
          style={{ height, color: "#737373" }}
        >
          لودچارتی برای نمایش وجود ندارد.
        </div>
      )}
    </div>
  );
}
