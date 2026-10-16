"use client";

/**
 * CraneLift Pro 3D — مرحله ۳ ویزارد: ورودی‌های لیفت و شرایط محیطی
 * -----------------------------------------------------------
 * فرم کاملاً کنترل‌شده (Controlled) متصل به استور Zustand؛ هر تغییری
 * بلافاصله در صحنه سه‌بعدی و «خلاصه زنده» بالا اعمال می‌شود.
 * هندسه بوم به‌صورت زنده با solveGeometry حل می‌شود.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  Link2,
  Move3d,
  Package,
  StickyNote,
  Wind,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { solveGeometry } from "@/lib/cranelift/analysis";
import { getCraneById } from "@/lib/cranelift/cranes";
import { getChartFor } from "@/lib/cranelift/load-charts";
import { useLiftStore } from "@/lib/cranelift/store";
import type { GeometrySolution, LoadChartSection } from "@/lib/cranelift/types";
import { cn } from "@/lib/utils";

// ───────────────────────── ابزار کمکی ─────────────────────────

/** حذف نویز اعشار ناشی از محاسبات ممیز شناور (۲.۳۴۹۹۹… → "2.35") */
function cleanNum(v: number): string {
  return String(Number(v.toFixed(3)));
}

interface NumFieldProps {
  id: string;
  label: string;
  value: number;
  onValueChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  helper?: ReactNode;
  /** کلاس اضافه برای متن راهنما (مثلاً قرمز برای هشدار) */
  helperClass?: string;
}

/**
 * فیلد عددی با حالت پیش‌نویس (Draft) تا تایپ روان باشد؛
 * مقدار ذخیره‌شده در استور بلافاصله به‌روز می‌شود و نمایش
 * هنگام blur با مقدار استور هم‌گام می‌گردد.
 */
function NumField({
  id,
  label,
  value,
  onValueChange,
  min,
  max,
  step,
  helper,
  helperClass,
}: NumFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft !== null ? draft : cleanNum(value);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        dir="ltr"
        inputMode="decimal"
        className="text-center tabular-nums"
        min={min}
        max={max}
        step={step}
        value={display}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const v = parseFloat(raw);
          // مقادیر منفی بی‌معنا هستند؛ صفر مجاز است (مثلاً وزن ریگینگ)
          if (Number.isFinite(v)) onValueChange(Math.max(v, 0));
        }}
        onBlur={() => setDraft(null)}
      />
      {helper !== undefined && (
        <p className={cn("text-xs leading-5 text-muted-foreground", helperClass)}>
          {helper}
        </p>
      )}
    </div>
  );
}

/** ردیف استاندارد اسلایدر: برچسب + بج مقدار + اسلایدر کهربایی */
function SliderRow(props: {
  label: string;
  badge: string;
  value: number;
  min: number;
  max: number;
  step: number;
  ariaLabel: string;
  helper?: ReactNode;
  helperClass?: string;
  onValueChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{props.label}</Label>
        <Badge variant="outline" dir="ltr" className="font-mono tabular-nums">
          {props.badge}
        </Badge>
      </div>
      <Slider
        dir="ltr"
        aria-label={props.ariaLabel}
        value={[props.value]}
        min={props.min}
        max={props.max}
        step={props.step}
        onValueChange={(vals: number[]) => {
          const v = vals[0];
          if (typeof v === "number") props.onValueChange(v);
        }}
        className="[&_[data-slot=slider-range]]:bg-amber-500 [&_[data-slot=slider-thumb]]:border-amber-500"
      />
      {props.helper !== undefined && (
        <p className={cn("text-xs leading-5 text-muted-foreground", props.helperClass)}>
          {props.helper}
        </p>
      )}
    </div>
  );
}

// ───────────────────────── کامپوننت اصلی ─────────────────────────

export default function Step3Inputs() {
  // ── استور ──
  const selectedCraneId = useLiftStore((s) => s.selectedCraneId);
  const inputs = useLiftStore((s) => s.inputs);
  const customCharts = useLiftStore((s) => s.customCharts);
  const setInputs = useLiftStore((s) => s.setInputs);
  const setRigging = useLiftStore((s) => s.setRigging);
  const setDims = useLiftStore((s) => s.setDims);
  const setStep = useLiftStore((s) => s.setStep);
  const { toast } = useToast();

  const customCranes = useLiftStore((s) => s.customCranes);
  const crane = getCraneById(selectedCraneId, customCranes);

  // ── هندسه زنده بوم ──
  const geo = useMemo<GeometrySolution | null>(
    () => (crane ? solveGeometry(crane, inputs) : null),
    [crane, inputs]
  );

  // ── سکشن‌های لودچارت (برای دکمه‌های انتخاب سریع طول بوم/جیب) ──
  const chartSections = useMemo<LoadChartSection[]>(() => {
    if (!crane) return [];
    const chart = getChartFor(crane.id, customCharts);
    return chart
      ? [...chart.sections].sort((a, b) => a.boomLengthM - b.boomLengthM)
      : [];
  }, [crane, customCharts]);

  // ── واحد وزن (تن/کیلوگرم) + پیش‌نویس تایپ ──
  const [weightUnit, setWeightUnit] = useState<"t" | "kg">("t");
  const [weightDraft, setWeightDraft] = useState<string | null>(null);

  // ── توست‌های هشدار (بدون تکرار) ──
  const warnedRef = useRef({ wind: false, sling: false });
  useEffect(() => {
    if (!crane) return;

    // هشدار باد بیش از حد مجاز
    const windOver = inputs.windSpeedMs > crane.specs.windLimitMs;
    if (windOver && !warnedRef.current.wind) {
      warnedRef.current.wind = true;
      toast({
        variant: "destructive",
        title: "هشدار: باد بیش از حد مجاز",
        description: `سرعت باد ${inputs.windSpeedMs} m/s از حد مجاز این جرثقیل (${crane.specs.windLimitMs} m/s) بیشتر است — لیفت ممنوع.`,
      });
    }
    if (!windOver) warnedRef.current.wind = false;

    // هشدار زاویه اسلینگ خطرناک (ضریب بار > ۱٫۴۱)
    const beta = Math.max(inputs.rigging.slingAngleDeg, 5);
    const factor = 1 / Math.sin((beta * Math.PI) / 180);
    if (factor > 1.41 && !warnedRef.current.sling) {
      warnedRef.current.sling = true;
      toast({
        variant: "destructive",
        title: "هشدار: زاویه اسلینگ خطرناک",
        description: `زاویه ${inputs.rigging.slingAngleDeg}° خیلی کم است؛ ضریب بار ${factor.toFixed(2)} برابر — خطر پارگی اسلینگ.`,
      });
    }
    if (factor <= 1.41) warnedRef.current.sling = false;
  }, [crane, inputs.windSpeedMs, inputs.rigging.slingAngleDeg, toast]);

  // ── حالت خالی: جرثقیل انتخاب نشده ──
  if (!crane || !geo) {
    return (
      <Card className="mx-auto max-w-md border-dashed">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-1 flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
            <Package className="size-6 text-amber-600" aria-hidden="true" />
          </div>
          <CardTitle>ابتدا جرثقیل انتخاب کنید</CardTitle>
          <CardDescription>
            برای ورود مشخصات بار، هندسه بوم و شرایط محیطی، ابتدا در مرحله ۱ یک
            جرثقیل انتخاب کنید.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-6">
          <Button
            onClick={() => setStep(0)}
            className="bg-amber-500 text-black hover:bg-amber-600"
          >
            رفتن به انتخاب جرثقیل
          </Button>
        </CardContent>
      </Card>
    );
  }

  const specs = crane.specs;
  const isTower = crane.type === "tower";

  // بار کل = بار + بلاک قلاب + ریگینگ
  const grossLoadT =
    inputs.loadWeightT + inputs.hookBlockWeightT + inputs.riggingWeightT;

  // اعتبار هندسه: در محدوده شعاع و زاویه مجاز جرثقیل
  const geoValid =
    geo.ok &&
    geo.radiusM >= specs.minRadiusM &&
    geo.radiusM <= specs.maxRadiusM &&
    (isTower ||
      (geo.boomAngleDeg >= specs.minBoomAngleDeg &&
        geo.boomAngleDeg <= specs.maxBoomAngleDeg));

  // ضریب بار اسلینگ 1/sin(β)
  const slingFactor =
    1 / Math.sin((Math.max(inputs.rigging.slingAngleDeg, 5) * Math.PI) / 180);

  /** فعال‌سازی جیب + توست اطلاع‌رسانی ضریب کاهش ظرفیت */
  const handleJibToggle = (on: boolean) => {
    setInputs({ useJib: on });
    if (on) {
      toast({
        title: "جیب فعال شد",
        description: `ظرفیت با ضریب جیب (${specs.jibCapacityFactor}) کاهش می‌یابد؛ لودچارت رسمی جیب سازنده را بررسی کنید.`,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* ═══════════ خلاصه زنده ═══════════ */}
      <Card className="border-amber-200 dark:border-amber-900">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
            <Activity className="size-4" aria-hidden="true" />
            خلاصه زنده:
          </span>

          <Badge variant="outline" className="gap-1 px-2.5 py-1 text-xs">
            شعاع:{" "}
            <span dir="ltr" className="font-mono tabular-nums">
              {geo.radiusM.toFixed(1)}
            </span>{" "}
            متر
          </Badge>

          <Badge variant="outline" className="px-2.5 py-1 text-xs">
            زاویه بوم:{" "}
            {isTower ? (
              "تالی روی جیب افقی"
            ) : (
              <span dir="ltr" className="font-mono tabular-nums">
                {geo.boomAngleDeg.toFixed(1)}°
              </span>
            )}
          </Badge>

          <Badge variant="outline" className="gap-1 px-2.5 py-1 text-xs">
            ارتفاع نوک بوم:{" "}
            <span dir="ltr" className="font-mono tabular-nums">
              {geo.tipHeightM.toFixed(1)}
            </span>{" "}
            متر
          </Badge>

          <Badge variant="outline" className="gap-1 px-2.5 py-1 text-xs">
            بار کل:{" "}
            <span dir="ltr" className="font-mono tabular-nums">
              {grossLoadT.toFixed(1)}
            </span>{" "}
            تن
          </Badge>

          {!geo.ok ? (
            <Badge className="bg-red-500 whitespace-normal text-right leading-snug text-white hover:bg-red-500">
              {geo.error}
            </Badge>
          ) : geoValid ? (
            <Badge className="bg-green-600 text-white hover:bg-green-600">
              هندسه معتبر
            </Badge>
          ) : (
            <Badge className="bg-amber-500 text-black hover:bg-amber-500">
              هندسه خارج از محدوده جرثقیل
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* ═══════════ کارت‌های فرم ═══════════ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── کارت ۱: بار و متعلقات ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-5 text-amber-500" aria-hidden="true" />
              بار و متعلقات
            </CardTitle>
            <CardDescription>
              وزن و ابعاد بار به‌همراه متعلقات زیر قلاب
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* وزن بار + تغییر واحد */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="load-weight">وزن بار</Label>
                <div
                  className="flex gap-1"
                  role="group"
                  aria-label="انتخاب واحد وزن"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant={weightUnit === "t" ? "default" : "outline"}
                    className={cn(
                      "h-7 px-3 text-xs",
                      weightUnit === "t" &&
                        "bg-amber-500 text-black hover:bg-amber-600"
                    )}
                    onClick={() => {
                      setWeightUnit("t");
                      setWeightDraft(null); // نمایش مجدد از مقدار استور
                    }}
                  >
                    تن
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={weightUnit === "kg" ? "default" : "outline"}
                    className={cn(
                      "h-7 px-3 text-xs",
                      weightUnit === "kg" &&
                        "bg-amber-500 text-black hover:bg-amber-600"
                    )}
                    onClick={() => {
                      setWeightUnit("kg");
                      setWeightDraft(null);
                    }}
                  >
                    کیلوگرم
                  </Button>
                </div>
              </div>
              <Input
                id="load-weight"
                type="number"
                dir="ltr"
                inputMode="decimal"
                className="text-center tabular-nums"
                min={0.1}
                step={weightUnit === "t" ? 0.1 : 100}
                value={
                  weightDraft ??
                  (weightUnit === "t"
                    ? cleanNum(inputs.loadWeightT)
                    : cleanNum(inputs.loadWeightT * 1000))
                }
                onChange={(e) => {
                  const raw = e.target.value;
                  setWeightDraft(raw);
                  const v = parseFloat(raw);
                  if (Number.isFinite(v) && v > 0) {
                    // همیشه به تن ذخیره می‌شود (واحد مرجع استور)
                    setInputs({
                      loadWeightT: weightUnit === "t" ? v : v / 1000,
                    });
                  }
                }}
                onBlur={() => setWeightDraft(null)}
              />
              <p className="text-xs text-muted-foreground">
                {weightUnit === "t" ? (
                  <>
                    معادل:{" "}
                    <span dir="ltr" className="font-mono tabular-nums">
                      {(inputs.loadWeightT * 1000).toFixed(0)}
                    </span>{" "}
                    کیلوگرم
                  </>
                ) : (
                  <>
                    معادل:{" "}
                    <span dir="ltr" className="font-mono tabular-nums">
                      {inputs.loadWeightT.toFixed(2)}
                    </span>{" "}
                    تن
                  </>
                )}
              </p>
            </div>

            {/* ابعاد بار */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <NumField
                id="dim-length"
                label="طول بار (متر)"
                value={inputs.loadDims.lengthM}
                min={0.1}
                step={0.1}
                onValueChange={(v) => setDims({ lengthM: v })}
              />
              <NumField
                id="dim-width"
                label="عرض بار (متر)"
                value={inputs.loadDims.widthM}
                min={0.1}
                step={0.1}
                onValueChange={(v) => setDims({ widthM: v })}
              />
              <NumField
                id="dim-height"
                label="ارتفاع بار (متر)"
                value={inputs.loadDims.heightM}
                min={0.1}
                step={0.1}
                onValueChange={(v) => setDims({ heightM: v })}
              />
            </div>

            {/* وزن‌های زیر قلاب */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumField
                id="hook-block-weight"
                label="وزن بلاک قلاب (تن)"
                value={inputs.hookBlockWeightT}
                min={0}
                step={0.05}
                onValueChange={(v) => setInputs({ hookBlockWeightT: v })}
              />
              <NumField
                id="rigging-weight"
                label="وزن ریگینگ (تن)"
                value={inputs.riggingWeightT}
                min={0}
                step={0.05}
                onValueChange={(v) => setInputs({ riggingWeightT: v })}
              />
            </div>

            <div className="flex justify-end">
              <Badge className="bg-amber-500 text-black hover:bg-amber-500">
                بار کل: {grossLoadT.toFixed(1)} تن
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* ── کارت ۲: ریگینگ ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="size-5 text-amber-500" aria-hidden="true" />
              ریگینگ
            </CardTitle>
            <CardDescription>
              پیکربندی اسلینگ‌ها و اتصال بار به قلاب
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* تعداد اسلینگ */}
            <div className="space-y-1.5">
              <Label htmlFor="sling-count">تعداد اسلینگ</Label>
              <Select
                value={String(inputs.rigging.slingCount)}
                onValueChange={(v) => setRigging({ slingCount: Number(v) })}
              >
                <SelectTrigger id="sling-count" className="w-full">
                  <SelectValue placeholder="انتخاب کنید" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">۲ اسلینگ</SelectItem>
                  <SelectItem value="4">۴ اسلینگ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* زاویه اسلینگ + ضریب بار */}
            <SliderRow
              label="زاویه اسلینگ از افق"
              badge={`${inputs.rigging.slingAngleDeg}°`}
              value={inputs.rigging.slingAngleDeg}
              min={15}
              max={90}
              step={5}
              ariaLabel="زاویه اسلینگ از افق"
              onValueChange={(v) => setRigging({ slingAngleDeg: v })}
              helper={
                <>
                  ضریب بار: 1/sin(β) ={" "}
                  <span dir="ltr" className="font-mono tabular-nums">
                    {slingFactor.toFixed(2)}
                  </span>
                  {slingFactor > 1.41
                    ? " — نیروی اسلینگ بسیار بالا!"
                    : slingFactor > 1.15
                      ? " — استفاده از تیر پخش‌کننده بررسی شود"
                      : ""}
                </>
              }
              helperClass={
                slingFactor > 1.41
                  ? "font-medium text-red-600"
                  : slingFactor > 1.15
                    ? "text-amber-600"
                    : "text-green-600"
              }
            />

            {/* تیر پخش‌کننده */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="use-spreader" className="cursor-pointer">
                  تیر پخش‌کننده (Spreader Beam)
                </Label>
                <p className="text-xs text-muted-foreground">
                  برای بارهای پهن؛ کاهش فشار جانبی اسلینگ روی بار
                </p>
              </div>
              <Switch
                id="use-spreader"
                checked={inputs.rigging.useSpreader}
                onCheckedChange={(v) => setRigging({ useSpreader: v })}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── کارت ۳: هندسه بوم و شعاع ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Move3d className="size-5 text-amber-500" aria-hidden="true" />
              هندسه بوم و شعاع
            </CardTitle>
            <CardDescription>
              تعیین موقعیت بوم، طول آن و ارتفاع لازم قلاب
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* حالت ورود: شعاع یا زاویه */}
            <RadioGroup
              value={inputs.radiusMode}
              onValueChange={(v) =>
                setInputs({ radiusMode: v as "radius" | "angle" })
              }
              className="flex flex-wrap gap-x-6 gap-y-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="radius" id="mode-radius" />
                <Label
                  htmlFor="mode-radius"
                  className="cursor-pointer font-normal"
                >
                  ورود با شعاع
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="angle" id="mode-angle" />
                <Label
                  htmlFor="mode-angle"
                  className="cursor-pointer font-normal"
                >
                  ورود با زاویه بوم
                </Label>
              </div>
            </RadioGroup>

            {!isTower ? (
              <>
                {/* جرثقیل سیار/شنی */}
                {inputs.radiusMode === "radius" ? (
                  <NumField
                    id="work-radius"
                    label="شعاع کاری (متر)"
                    value={inputs.radiusM}
                    min={specs.minRadiusM}
                    max={specs.maxRadiusM}
                    step={0.5}
                    onValueChange={(v) => setInputs({ radiusM: v })}
                    helper={
                      <>
                        زاویه بوم محاسبه‌شده:{" "}
                        <span dir="ltr" className="font-mono tabular-nums">
                          {geo.ok
                            ? `${geo.boomAngleDeg.toFixed(1)}°`
                            : "—"}
                        </span>
                      </>
                    }
                  />
                ) : (
                  <SliderRow
                    label="زاویه بوم از افق"
                    badge={`${inputs.boomAngleDeg}°`}
                    value={inputs.boomAngleDeg}
                    min={specs.minBoomAngleDeg}
                    max={specs.maxBoomAngleDeg}
                    step={1}
                    ariaLabel="زاویه بوم از افق"
                    onValueChange={(v) => setInputs({ boomAngleDeg: v })}
                    helper={
                      <>
                        شعاع محاسبه‌شده:{" "}
                        <span dir="ltr" className="font-mono tabular-nums">
                          {geo.radiusM.toFixed(1)} متر
                        </span>
                      </>
                    }
                  />
                )}

                {/* طول بوم + انتخاب سریع سکشن‌ها */}
                <NumField
                  id="boom-length"
                  label="طول بوم (متر)"
                  value={inputs.boomLengthM}
                  min={specs.mainBoomMinM}
                  max={specs.mainBoomMaxM}
                  step={0.5}
                  onValueChange={(v) => setInputs({ boomLengthM: v })}
                />
                {chartSections.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      انتخاب سریع طول بوم — سکشن‌های لودچارت:
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {chartSections.map((sec) => {
                        const active = inputs.boomLengthM === sec.boomLengthM;
                        return (
                          <Button
                            key={sec.boomLengthM}
                            type="button"
                            size="sm"
                            variant={active ? "default" : "outline"}
                            className={cn(
                              "h-7 px-2.5 font-mono text-xs tabular-nums",
                              active &&
                                "bg-amber-500 text-black hover:bg-amber-600"
                            )}
                            onClick={() =>
                              setInputs({ boomLengthM: sec.boomLengthM })
                            }
                          >
                            {sec.boomLengthM}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Separator />

                {/* جیب */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="use-jib" className="cursor-pointer">
                      استفاده از جیب
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      ظرفیت با ضریب جیب ({specs.jibCapacityFactor}) کاهش
                      می‌یابد
                    </p>
                  </div>
                  <Switch
                    id="use-jib"
                    checked={inputs.useJib}
                    onCheckedChange={handleJibToggle}
                    className="data-[state=checked]:bg-amber-500"
                  />
                </div>

                {inputs.useJib && (
                  <>
                    <NumField
                      id="jib-length"
                      label="طول جیب (متر)"
                      value={inputs.jibLengthM}
                      min={specs.jibMinM}
                      max={specs.jibMaxM}
                      step={0.5}
                      onValueChange={(v) => setInputs({ jibLengthM: v })}
                    />
                    <SliderRow
                      label="زاویه جیب از افق"
                      badge={`${inputs.jibAngleDeg}°`}
                      value={inputs.jibAngleDeg}
                      min={10}
                      max={80}
                      step={5}
                      ariaLabel="زاویه جیب از افق"
                      onValueChange={(v) => setInputs({ jibAngleDeg: v })}
                    />
                  </>
                )}
              </>
            ) : (
              <>
                {/* جرثقیل برجی: بوم افقی ثابت */}
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  جرثقیل برجی: بوم افقی ثابت است؛ شعاع = موقعیت تالی روی جیب.
                  طول جیب (سکشن لودچارت) را در مرحله ۲ انتخاب/ویرایش کنید و
                  زاویه بوم موضوعیت ندارد.
                </div>

                <NumField
                  id="tower-radius"
                  label="شعاع کاری (متر)"
                  value={inputs.radiusM}
                  min={specs.minRadiusM}
                  max={specs.maxRadiusM}
                  step={0.5}
                  onValueChange={(v) => setInputs({ radiusM: v })}
                />

                {chartSections.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      انتخاب سریع طول جیب — سکشن‌های لودچارت:
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {chartSections.map((sec) => {
                        const active = inputs.boomLengthM === sec.boomLengthM;
                        return (
                          <Button
                            key={sec.boomLengthM}
                            type="button"
                            size="sm"
                            variant={active ? "default" : "outline"}
                            className={cn(
                              "h-7 px-2.5 font-mono text-xs tabular-nums",
                              active &&
                                "bg-amber-500 text-black hover:bg-amber-600"
                            )}
                            onClick={() =>
                              setInputs({ boomLengthM: sec.boomLengthM })
                            }
                          >
                            {sec.boomLengthM}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            <Separator />

            {/* ارتفاع قلاب مورد نیاز */}
            <NumField
              id="required-hook-height"
              label="ارتفاع قلاب مورد نیاز (متر)"
              value={inputs.requiredHookHeightM}
              min={1}
              step={0.5}
              onValueChange={(v) => setInputs({ requiredHookHeightM: v })}
              helper="از سطح زمین تا زیر قلاب در بالاترین نقطه حرکت بار"
            />
          </CardContent>
        </Card>

        {/* ── کارت ۴: محیط و ایمنی ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wind className="size-5 text-amber-500" aria-hidden="true" />
              محیط و ایمنی
            </CardTitle>
            <CardDescription>
              شرایط سایت، باد و حاشیه‌های ایمنی لیفت
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* سرعت باد */}
            <NumField
              id="wind-speed"
              label="سرعت باد (m/s)"
              value={inputs.windSpeedMs}
              min={0}
              max={40}
              step={0.5}
              onValueChange={(v) => setInputs({ windSpeedMs: v })}
              helper={
                <>
                  <span dir="ltr" className="font-mono tabular-nums">
                    {(inputs.windSpeedMs * 3.6).toFixed(0)} km/h
                  </span>{" "}
                  — حد مجاز این جرثقیل:{" "}
                  <span dir="ltr" className="font-mono tabular-nums">
                    {specs.windLimitMs} m/s
                  </span>
                  {inputs.windSpeedMs > specs.windLimitMs
                    ? " — لیفت ممنوع!"
                    : ""}
                </>
              }
              helperClass={
                inputs.windSpeedMs > specs.windLimitMs
                  ? "font-medium text-red-600"
                  : undefined
              }
            />

            {/* تندباد */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="wind-gust" className="cursor-pointer">
                  تندباد (Gust +۲۰٪)
                </Label>
                <p className="text-xs text-muted-foreground">
                  لحظه‌های تندباد؛ ۲۰٪ افزوده به سرعت باد
                </p>
              </div>
              <Switch
                id="wind-gust"
                checked={inputs.windGust}
                onCheckedChange={(v) => setInputs({ windGust: v })}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>

            {/* شیب زمین */}
            <SliderRow
              label="شیب زمین"
              badge={`${inputs.groundSlopeDeg}°`}
              value={inputs.groundSlopeDeg}
              min={0}
              max={3}
              step={0.1}
              ariaLabel="شیب زمین"
              onValueChange={(v) =>
                setInputs({ groundSlopeDeg: Math.round(v * 10) / 10 })
              }
              helper="شیب بیش از حد، ظرفیت را کاهش و بار اوت‌ریگرها را نامتقارن می‌کند"
            />

            {/* ضریب ایمنی مازاد */}
            <SliderRow
              label="ضریب ایمنی مازاد"
              badge={`×${inputs.safetyFactor.toFixed(2)}`}
              value={inputs.safetyFactor}
              min={1}
              max={1.5}
              step={0.05}
              ariaLabel="ضریب ایمنی مازاد"
              onValueChange={(v) =>
                setInputs({ safetyFactor: Math.round(v * 100) / 100 })
              }
              helper="ظرفیت مجاز تقسیم بر این ضریب می‌شود (۱٫۱ = مارجین ۱۰٪)"
            />

            {/* زاویه چرخش سوپراستراکچر */}
            <SliderRow
              label="زاویه چرخش سوپراستراکچر (فقط نمایش سه‌بعدی)"
              badge={`${inputs.slewAngleDeg}°`}
              value={inputs.slewAngleDeg}
              min={0}
              max={360}
              step={5}
              ariaLabel="زاویه چرخش سوپراستراکچر"
              onValueChange={(v) => setInputs({ slewAngleDeg: v })}
            />
          </CardContent>
        </Card>

        {/* ── کارت ۵: یادداشت‌های لیفت (تمام‌عرض) ── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="size-5 text-amber-500" aria-hidden="true" />
              یادداشت‌های لیفت
            </CardTitle>
            <CardDescription>
              ثبت نکات اجرایی؛ در گزارش نهایی PDF درج می‌شود
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={4}
              placeholder="نکات خاص لیفت، محدودیت‌های سایت و ..."
              value={inputs.notes}
              onChange={(e) => setInputs({ notes: e.target.value })}
              className="min-h-24 resize-y"
              aria-label="یادداشت‌های لیفت"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
