/**
 * IHMS CraneLift 3D — ورودی/خروجی CSV لودچارت
 * -----------------------------------------------------------
 * فرمت CSV:
 *   boom_length,radius,capacity
 *   12.3,3,112
 *   12.3,4,96
 *   ...
 */

import Papa from "papaparse";
import type { LoadChart, LoadChartSection } from "./types";

/** تبدیل لودچارت به متن CSV */
export function chartToCSV(chart: LoadChart): string {
  const rows: { boom_length: number; radius: number; capacity: number }[] = [];
  for (const s of [...chart.sections].sort(
    (a, b) => a.boomLengthM - b.boomLengthM
  )) {
    for (const p of [...s.points].sort((a, b) => a.radiusM - b.radiusM)) {
      rows.push({
        boom_length: s.boomLengthM,
        radius: p.radiusM,
        capacity: p.capacityT,
      });
    }
  }
  return Papa.unparse(rows, { columns: ["boom_length", "radius", "capacity"] });
}

export interface CSVImportResult {
  chart: LoadChart | null;
  errors: string[];
  rowCount: number;
}

/** تبدیل متن CSV به لودچارت با اعتبارسنجی کامل */
export function csvToChart(craneId: string, csv: string): CSVImportResult {
  const errors: string[] = [];

  const parsed = Papa.parse<Record<string, string>>(csv.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (parsed.data.length === 0) {
    return { chart: null, errors: ["فایل CSV خالی است."], rowCount: 0 };
  }

  // نگاشت ستون‌ها با انعطاف نام‌گذاری
  const groupMap = new Map<number, LoadChartSection>();
  let validRows = 0;

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const boom = parseFloat(
      (row["boom_length"] ?? row["boom"] ?? row["boomlength"] ?? "").toString()
    );
    const radius = parseFloat((row["radius"] ?? row["r"] ?? "").toString());
    const capacity = parseFloat(
      (row["capacity"] ?? row["cap"] ?? row["load"] ?? "").toString()
    );

    if ([boom, radius, capacity].some((v) => !isFinite(v))) {
      errors.push(`ردیف ${i + 2}: مقادیر عددی نامعتبر.`);
      continue;
    }
    if (boom <= 0 || radius <= 0 || capacity <= 0) {
      errors.push(`ردیف ${i + 2}: مقادیر باید مثبت باشند.`);
      continue;
    }
    if (capacity > 5000 || boom > 200 || radius > 200) {
      errors.push(`ردیف ${i + 2}: مقدار خارج از محدوده منطقی.`);
      continue;
    }

    validRows++;
    if (!groupMap.has(boom)) groupMap.set(boom, { boomLengthM: boom, points: [] });
    groupMap.get(boom)!.points.push({ radiusM: radius, capacityT: capacity });
  }

  if (validRows === 0) {
    return {
      chart: null,
      errors: ["هیچ ردیف معتبری یافت نشد. ستون‌های boom_length, radius, capacity لازم است."],
      rowCount: 0,
    };
  }

  const sections = [...groupMap.values()];

  // اعتبارسنجی: ظرفیت باید با افزایش شعاع کاهش (یا ثابت) بماند
  for (const s of sections) {
    s.points.sort((a, b) => a.radiusM - b.radiusM);
    for (let i = 1; i < s.points.length; i++) {
      if (s.points[i].capacityT > s.points[i - 1].capacityT + 0.01) {
        errors.push(
          `بوم ${s.boomLengthM} متر: در شعاع ${s.points[i].radiusM} متری ظرفیت افزایش یافته (ناسازگار با فیزیک لودچارت) — داده‌ها را بررسی کنید.`
        );
        break;
      }
    }
  }

  return {
    chart: {
      craneId,
      sections,
      source: "custom",
      updatedAt: new Date().toISOString(),
    },
    errors,
    rowCount: validRows,
  };
}

/** نمونه CSV خالی برای دانلود */
export function sampleCSV(): string {
  return "boom_length,radius,capacity\n12.3,3,112\n12.3,5,84\n12.3,7,63\n24,3.5,98\n24,7,61\n24,11,37.5\n";
}
