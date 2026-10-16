"use client";

/**
 * IHMS CraneLift 3D — مرحله ۵: تحلیل لیفت (Play)
 * -----------------------------------------------------------
 * دکمه بزرگ اجرای تحلیل + نمایش نتیجه: وضعیت رنگی، گیج درصد ظرفیت،
 * گشتاورها، جدول بررسی‌های ایمنی و هشدارها.
 */

import { useState } from "react";
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileDown,
  Gauge,
  Scale,
  Wind,
  Info,
  Loader2,
  Cable,
  Flag,
} from "lucide-react";
import {
  RadialBar,
  RadialBarChart,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLiftStore } from "@/lib/cranelift/store";
import { getCraneById } from "@/lib/cranelift/cranes";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/cranelift/analysis";
import { playUnified } from "../run-analysis";
import TransferVerdictCard from "../TransferVerdictCard";
import { useToast } from "@/hooks/use-toast";
import { useUiStore } from "../ui-store";
import type { AnalysisWarning } from "@/lib/cranelift/types";

const STATUS_STYLES = {
  allowed: {
    card: "border-green-500/40 bg-green-500/10",
    icon: CheckCircle2,
    iconColor: "text-green-500",
    text: "text-green-500",
  },
  caution: {
    card: "border-amber-500/40 bg-amber-500/10",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    text: "text-amber-500",
  },
  "not-allowed": {
    card: "border-red-500/40 bg-red-500/10",
    icon: XCircle,
    iconColor: "text-red-500",
    text: "text-red-500",
  },
} as const;

function WarningRow({ w }: { w: AnalysisWarning }) {
  const map = {
    info: { icon: Info, cls: "text-muted-foreground", bg: "bg-muted/50 border" },
    warning: { icon: AlertTriangle, cls: "text-amber-500", bg: "bg-amber-500/10 border border-amber-500/30" },
    danger: { icon: XCircle, cls: "text-red-500", bg: "bg-red-500/10 border border-red-500/30" },
  } as const;
  const { icon: Icon, cls, bg } = map[w.level];
  return (
    <div className={`flex items-start gap-2.5 rounded-lg p-3 ${bg}`}>
      <Icon className={`mt-0.5 size-4.5 shrink-0 ${cls}`} />
      <p className="text-sm leading-relaxed">{w.message}</p>
    </div>
  );
}

export default function Step5Analysis() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const selectedId = useLiftStore((s) => s.selectedCraneId);
  const result = useLiftStore((s) => s.result);
  const radiusM = useLiftStore((s) => s.inputs.radiusM);
  const transfer = useLiftStore((s) => s.transfer);
  const setStep = useLiftStore((s) => s.setStep);
  const setUpgradeOpen = useUiStore((s) => s.setUpgradeOpen);

  const customCranes = useLiftStore((s) => s.customCranes);
  const crane = getCraneById(selectedId, customCranes);

  if (!crane) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
          <AlertTriangle className="size-10 text-amber-500/60" />
          ابتدا از مرحله ۱ جرثقیل انتخاب کنید
        </CardContent>
      </Card>
    );
  }

  /** جریان واحد Play — همان دکمه پنل سه‌بعدی: تحلیل + شبیه‌سازی + نتیجه */
  const handlePlay = async () => {
    setRunning(true);
    try {
      await playUnified({ toast, onQuotaExceeded: () => setUpgradeOpen(true) });
    } finally {
      setRunning(false);
    }
  };

  const util = result?.utilizationPct ?? null;
  const utilColor =
    util == null ? "#71717a" : util > 100 ? "#ef4444" : util >= 80 ? "#eab308" : "#22c55e";

  return (
    <div className="space-y-5">
      {/* دکمه بزرگ Play */}
      <Button
        size="lg"
        disabled={running}
        onClick={handlePlay}
        className="h-24 w-full gap-4 rounded-2xl border-2 border-amber-300/40 bg-amber-500 text-2xl font-black text-black shadow-[0_0_48px_rgba(245,158,11,0.3)] transition-all hover:bg-amber-400 hover:shadow-[0_0_64px_rgba(245,158,11,0.45)] active:scale-[0.995]"
      >
        {running ? (
          <Loader2 className="size-9 animate-spin" />
        ) : (
          <Play className="size-9 fill-black" />
        )}
        {running ? "در حال تحلیل لیفت..." : "تحلیل لیفت — PLAY"}
      </Button>
      {!result && (
        <p className="text-center text-sm text-muted-foreground">
          با کلیک روی دکمه، تحلیل کامل اجرا و اگر دو پرچم ثبت شده باشد حرکت جرثقیل A→B هم
          شبیه‌سازی می‌شود؛ ظرفیت از لودچارت درون‌یابی شده، گشتاورها، باد، شیب و ریگینگ
          به‌طور کامل بررسی می‌شود.
        </p>
      )}

      {/* نتیجه تحلیل */}
      {result && (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-5 duration-500">
          {/* کارت وضعیت */}
          <Card className={`border-2 ${STATUS_STYLES[result.status].card}`}>
            <CardContent className="flex flex-col items-center gap-3 py-6 text-center sm:flex-row sm:text-start">
              {(() => {
                const Icon = STATUS_STYLES[result.status].icon;
                return <Icon className={`size-14 shrink-0 ${STATUS_STYLES[result.status].iconColor}`} />;
              })()}
              <div className="flex-1">
                <div className={`text-2xl font-black ${STATUS_STYLES[result.status].text}`}>
                  {STATUS_LABELS[result.status]}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                  {result.conclusion}
                </p>
                <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                  {new Date(result.timestamp).toLocaleString("fa-IR")} — {crane.name}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* KPI ها */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">ظرفیت مجاز لودچارت</div>
                <div className="mt-1 text-2xl font-black" dir="ltr">
                  {result.ratedCapacityT != null ? `${result.ratedCapacityT.toFixed(1)} t` : "—"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground" dir="ltr">
                  با مارجین: {result.effectiveCapacityT != null ? `${result.effectiveCapacityT.toFixed(1)} t` : "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">بار کل (بار + قلاب + ریگینگ)</div>
                <div className="mt-1 text-2xl font-black text-amber-500" dir="ltr">
                  {result.grossLoadT.toFixed(1)} t
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  شعاع: {radiusM.toFixed(1)} متر
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">درصد استفاده از ظرفیت</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-black" style={{ color: utilColor }} dir="ltr">
                    {util != null ? `${util.toFixed(0)}%` : "—"}
                  </span>
                </div>
                <Progress value={util != null ? Math.min(util, 100) : 0} className="mt-2 h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Scale className="size-3.5" /> گشتاور بار vs مجاز
                </div>
                <div className="mt-1 text-lg font-black" dir="ltr">
                  {result.loadMomentTm != null ? `${result.loadMomentTm.toFixed(0)} / ${result.allowedMomentTm?.toFixed(0) ?? "—"}` : "—"}
                  <span className="text-xs font-normal text-muted-foreground"> t·m</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground" dir="ltr">
                  {result.momentRatioPct != null ? `${result.momentRatioPct.toFixed(0)}% of limit` : "—"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* سیم بکسل و قرقره */}
          {result && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Cable className="size-4 text-amber-500" />
                  سیم بکسل و تعداد رشته قلاب
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border bg-muted/40 p-3 text-center">
                    <div className="text-[11px] text-muted-foreground">رشته‌های در قلاب</div>
                    <div className="mt-1 text-xl font-black" dir="ltr">
                      {result.partsOfLine}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-3 text-center">
                    <div className="text-[11px] text-muted-foreground">کشش هر رشته</div>
                    <div className="mt-1 text-xl font-black" dir="ltr">
                      {result.linePullPerPartT != null ? `${result.linePullPerPartT.toFixed(2)} t` : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-3 text-center">
                    <div className="text-[11px] text-muted-foreground">SWL هر رشته (MBL÷۵)</div>
                    <div className="mt-1 text-xl font-black text-green-500" dir="ltr">
                      {result.ropeSWLT != null ? `${result.ropeSWLT.toFixed(2)} t` : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-3 text-center">
                    <div className="text-[11px] text-muted-foreground">ظرفیت محدود به سیم</div>
                    <div className="mt-1 text-xl font-black" dir="ltr">
                      {result.ropeLimitedCapacityT != null ? `${result.ropeLimitedCapacityT.toFixed(1)} t` : "—"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* نتیجه جابجایی دوپرچمی (در صورت اجرای شبیه‌سازی) */}
          {transfer && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                <Flag className="size-4 text-amber-500" />
                خلاصه شبیه‌سازی جابجایی دوعرچه‌ای
              </div>
              <TransferVerdictCard transfer={transfer} />
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            {/* گیج ظرفیت */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Gauge className="size-4 text-amber-500" />
                  گیج استفاده از ظرفیت
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mx-auto h-44 w-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      innerRadius="72%"
                      outerRadius="100%"
                      data={[{ name: "util", value: Math.min(util ?? 0, 130), fill: utilColor }]}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="value" cornerRadius={12} background={{ fill: "#3f3f46" }} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black" style={{ color: utilColor }} dir="ltr">
                      {util != null ? `${util.toFixed(0)}%` : "—"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">ظرفیت مصرف‌شده</span>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded-md border bg-muted/40 py-1">
                    <span className="text-muted-foreground">کشش هر اسلینگ: </span>
                    <span className="font-bold" dir="ltr">
                      {result.slingTensionT != null ? `${result.slingTensionT.toFixed(2)} t` : "—"}
                    </span>
                  </div>
                  <div className="rounded-md border bg-muted/40 py-1">
                    <span className="text-muted-foreground">باد: </span>
                    <span className="font-bold" dir="ltr">
                      {result.windRatioPct != null ? `${result.windRatioPct.toFixed(0)}%` : "—"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* جدول بررسی‌ها */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Wind className="size-4 text-amber-500" />
                  بررسی‌های کامل ایمنی
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-96 overflow-y-auto scroll-slim">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                        <TableHead>بررسی</TableHead>
                        <TableHead>مقدار</TableHead>
                        <TableHead>حد مجاز</TableHead>
                        <TableHead className="text-center">وضعیت</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.checks.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{c.label}</TableCell>
                          <TableCell dir="auto">{c.value}</TableCell>
                          <TableCell className="text-muted-foreground" dir="auto">
                            {c.limit}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                c.level === "pass"
                                  ? "border-green-500/40 bg-green-500/10 text-green-500"
                                  : c.level === "warn"
                                    ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                                    : "border-red-500/40 bg-red-500/10 text-red-500"
                              }
                            >
                              {c.level === "pass" ? "✓ منطبق" : c.level === "warn" ? "⚠ هشدار" : "✗ نامعتبر"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* هشدارها */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                هشدارها و توصیه‌ها ({result.warnings.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.warnings.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-500">
                  <CheckCircle2 className="size-4" />
                  هشدار خاصی ثبت نشد — همه بررسی‌ها با موفقیت پاس شدند.
                </div>
              ) : (
                result.warnings.map((w, i) => <WarningRow key={i} w={w} />)
              )}
            </CardContent>
          </Card>

          {/* اکشن‌ها */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="flex-1 gap-2 bg-amber-500 text-black hover:bg-amber-400"
              onClick={() => setStep(5)}
            >
              <FileDown className="size-5" />
              ادامه: دریافت گزارش PDF
            </Button>
            <Button size="lg" variant="outline" className="gap-2" onClick={handlePlay} disabled={running}>
              <RotateCcw className="size-4" />
              اجرای مجدد تحلیل
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
