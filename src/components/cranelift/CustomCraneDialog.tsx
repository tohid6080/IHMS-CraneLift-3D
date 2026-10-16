"use client";

/**
 * CraneLift Pro 3D — گفت‌وگوی تعریف / ویرایش جرثقیل سفارشی
 * -----------------------------------------------------------
 * اگر مدل جرثقیل کاربر در نمونه‌های مرجع نباشد، از اینجا می‌تواند
 * مدل و مشخصات کامل فنی آن را تعریف کند. در حالت «ایجاد»، پس از ثبت،
 * یک لودچارت خالی صفحه‌دار به‌صورت خودکار seed می‌شود و کاربر به مرحله ۲
 * (ویرایش لودچارت) هدایت می‌شود. در حالت «ویرایش» فقط مشخصات به‌روزرسانی
 * می‌شود و شناسه + لودچارت قبلی دست‌نخورده می‌ماند.
 */

import { useMemo, useState } from "react";
import {
  CirclePlus,
  Info,
  Pencil,
  Save,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { makeCustomCraneId, useLiftStore } from "@/lib/cranelift/store";
import { ropeMBLT, ropeSpecOf, ROPE_CORE_LABELS } from "@/lib/cranelift/wire-rope";
import {
  CRANE_TYPE_LABELS,
  type Crane,
  type CraneSpecs,
  type CraneType,
  type RopeCore,
} from "@/lib/cranelift/types";
import { useToast } from "@/hooks/use-toast";

/** تصویر پیش‌فرض وقتی کاربر آدرسی وارد نمی‌کند */
const PLACEHOLDER_IMAGE = "/cranes/placeholder.svg";

/** تبدیل ارقام فارسی/عربی و اعشار فارسی به عدد استاندارد */
function parseNum(raw: string): number {
  const normalized = raw
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/٫/g, ".");
  const v = parseFloat(normalized);
  return Number.isFinite(v) ? v : NaN;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** وضعیت پیش‌نویس فرم — همه اعداد به‌صورت رشته برای تایپ روان */
interface CraneDraft {
  name: string;
  manufacturer: string;
  type: CraneType;
  description: string;
  imageUrl: string;
  // ── مشخصات فنی ──
  maxCapacityT: string;
  mainBoomMinM: string;
  mainBoomMaxM: string;
  jibMinM: string;
  jibMaxM: string;
  counterweightT: string;
  selfWeightT: string;
  outriggerSpanM: string;
  windLimitMs: string;
  minBoomAngleDeg: string;
  maxBoomAngleDeg: string;
  pivotHeightM: string;
  pivotOffsetM: string;
  minRadiusM: string;
  maxRadiusM: string;
  jibCapacityFactor: string;
  freestandingHookHeightM: string;
  maxPartsOfLine: string;
  ropeDiameterMm: string;
  ropeMBLT: string;
  ropeCore: RopeCore;
}

function defaultDraft(): CraneDraft {
  return {
    name: "",
    manufacturer: "",
    type: "mobile",
    description: "",
    imageUrl: "",
    maxCapacityT: "",
    mainBoomMinM: "",
    mainBoomMaxM: "",
    jibMinM: "0",
    jibMaxM: "0",
    counterweightT: "",
    selfWeightT: "",
    outriggerSpanM: "",
    windLimitMs: "9.8",
    minBoomAngleDeg: "10",
    maxBoomAngleDeg: "80",
    pivotHeightM: "2.4",
    pivotOffsetM: "1.7",
    minRadiusM: "3",
    maxRadiusM: "",
    jibCapacityFactor: "0.75",
    freestandingHookHeightM: "40",
    maxPartsOfLine: "8",
    ropeDiameterMm: "20",
    ropeMBLT: "",
    ropeCore: "IWRC",
  };
}

function draftFromCrane(crane: Crane): CraneDraft {
  const s = crane.specs;
  return {
    name: crane.name,
    manufacturer: crane.manufacturer,
    type: crane.type,
    description: crane.description,
    imageUrl: crane.image === PLACEHOLDER_IMAGE ? "" : crane.image,
    maxCapacityT: String(s.maxCapacityT),
    mainBoomMinM: String(s.mainBoomMinM),
    mainBoomMaxM: String(s.mainBoomMaxM),
    jibMinM: String(s.jibMinM),
    jibMaxM: String(s.jibMaxM),
    counterweightT: String(s.counterweightT),
    selfWeightT: String(s.selfWeightT),
    outriggerSpanM: String(s.outriggerSpanM),
    windLimitMs: String(s.windLimitMs),
    minBoomAngleDeg: String(s.minBoomAngleDeg),
    maxBoomAngleDeg: String(s.maxBoomAngleDeg),
    pivotHeightM: String(s.pivotHeightM),
    pivotOffsetM: String(s.pivotOffsetM),
    minRadiusM: String(s.minRadiusM),
    maxRadiusM: String(s.maxRadiusM),
    jibCapacityFactor: String(s.jibCapacityFactor),
    freestandingHookHeightM:
      s.freestandingHookHeightM != null ? String(s.freestandingHookHeightM) : "40",
    // سیم بکسل: از مشخصات ذخیره‌شده یا تخمین موتور سیم
    maxPartsOfLine: String(s.maxPartsOfLine ?? ropeSpecOf(crane).maxPartsOfLine),
    ropeDiameterMm: String(s.ropeDiameterMm ?? ropeSpecOf(crane).diameterMm),
    ropeMBLT: s.ropeMBLT != null ? String(s.ropeMBLT) : "",
    ropeCore: s.ropeCore ?? ropeSpecOf(crane).core,
  };
}

/** پیشنهاد هوشمند حداکثر شعاع بر اساس حداکثر طول بوم */
function suggestMaxRadius(type: CraneType, mainBoomMaxRaw: string): string {
  const v = parseNum(mainBoomMaxRaw);
  if (!Number.isFinite(v) || v <= 0) return "";
  // برجی: شعاع = تا نوک جیب (کل طول جیب) | سیار/شنی: ~۸۰٪ بوم
  return String(round1(type === "tower" ? v : v * 0.8));
}

/** ساخت مشخصات نهایی و پاک‌سازی‌شده از پیش‌نویس */
function buildSpecs(d: CraneDraft): CraneSpecs {
  const isTower = d.type === "tower";

  const maxBoom = Math.max(0, parseNum(d.mainBoomMaxM) || 0);
  let minBoom = parseNum(d.mainBoomMinM);
  if (!Number.isFinite(minBoom) || minBoom <= 0) {
    minBoom = Math.max(1, round1(maxBoom * 0.25));
  }
  if (maxBoom > 0 && minBoom > maxBoom) minBoom = maxBoom;

  const jibMax = Math.max(0, parseNum(d.jibMaxM) || 0);
  let jibMin = parseNum(d.jibMinM);
  if (!Number.isFinite(jibMin) || jibMin < 0) jibMin = 0;
  if (jibMin > jibMax) jibMin = jibMax;

  const minAngle = isTower ? 0 : clamp(parseNum(d.minBoomAngleDeg) || 10, 0, 89);
  let maxAngle = isTower ? 0 : clamp(parseNum(d.maxBoomAngleDeg) || 80, 0, 90);
  if (!isTower && maxAngle <= minAngle) maxAngle = Math.min(90, minAngle + 5);

  const minRadius = Math.max(0.5, parseNum(d.minRadiusM) || 3);
  let maxRadius = parseNum(d.maxRadiusM);
  if (!Number.isFinite(maxRadius) || maxRadius <= 0) {
    maxRadius = isTower ? maxBoom : round1(maxBoom * 0.8);
  }
  if (maxRadius < minRadius) maxRadius = round1(minRadius + 1);

  const factor = clamp(parseNum(d.jibCapacityFactor) || 0.75, 0.5, 1);
  const ph = parseNum(d.pivotHeightM);
  const po = parseNum(d.pivotOffsetM);
  const fh = parseNum(d.freestandingHookHeightM);
  const nonNeg = (v: number) =>
    Number.isFinite(v) && v > 0 ? round1(v) : 0;

  return {
    maxCapacityT: round1(parseNum(d.maxCapacityT)), // قبل از این‌جا اعتبارسنجی شده (> 0)
    mainBoomMinM: round1(minBoom),
    mainBoomMaxM: round1(maxBoom),
    jibMinM: round1(jibMin),
    jibMaxM: round1(jibMax),
    jibCapacityFactor: isTower ? 1 : factor,
    selfWeightT: nonNeg(parseNum(d.selfWeightT)),
    counterweightT: nonNeg(parseNum(d.counterweightT)),
    outriggerSpanM: nonNeg(parseNum(d.outriggerSpanM)),
    windLimitMs: Math.max(1, round1(parseNum(d.windLimitMs) || 9.8)),
    minBoomAngleDeg: minAngle,
    maxBoomAngleDeg: maxAngle,
    pivotHeightM: isTower ? 0 : Number.isFinite(ph) && ph >= 0 ? round1(ph) : 2.4,
    pivotOffsetM: isTower ? 0 : Number.isFinite(po) && po >= 0 ? round1(po) : 1.7,
    minRadiusM: round1(minRadius),
    maxRadiusM: round1(maxRadius),
    ...(isTower
      ? {
          freestandingHookHeightM:
            Number.isFinite(fh) && fh > 0 ? round1(fh) : 40,
        }
      : {}),

    // ── سیم بکسل و قرقره ──
    maxPartsOfLine: clamp(Math.round(parseNum(d.maxPartsOfLine) || 8), 1, 16),
    ropeDiameterMm: clamp(parseNum(d.ropeDiameterMm) || 20, 6, 60),
    ropeCore: d.ropeCore,
    ropeMBLT:
      Number.isFinite(parseNum(d.ropeMBLT)) && parseNum(d.ropeMBLT) > 0
        ? round1(parseNum(d.ropeMBLT))
        : round1(
            ropeMBLT(
              clamp(parseNum(d.ropeDiameterMm) || 20, 6, 60),
              "6x36",
              d.ropeCore
            )
          ),
  };
}

/** فیلد عددی با برچسب فارسی + واحد — ورودی LTR وسط‌چین */
function NumField({
  label,
  unit,
  value,
  onChange,
  required,
  invalid,
  helper,
  disabled,
  placeholder,
  min,
  max,
  step,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  invalid?: boolean;
  helper?: string;
  disabled?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1 text-xs font-medium">
        {label}
        {required && <span className="text-red-500">*</span>}
        {unit && (
          <span className="text-[10px] font-normal text-muted-foreground">
            ({unit})
          </span>
        )}
      </Label>
      <Input
        type="number"
        dir="ltr"
        inputMode="decimal"
        className="h-9 text-center tabular-nums disabled:opacity-60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step ?? "any"}
        aria-invalid={invalid || undefined}
      />
      {invalid && helper ? (
        <p className="flex items-center gap-1 text-[11px] leading-4 text-red-500">
          <TriangleAlert className="size-3 shrink-0" />
          {helper}
        </p>
      ) : null}
    </div>
  );
}

/**
 * بدنه فرم — با هر بار باز شدن گفت‌وگو از نو mount می‌شود (Radix محتوای بسته
 * را از DOM حذف می‌کند)، بنابراین state اولیه همان پیش‌نویس جرثقیل مقصد است.
 */
function CraneForm({
  editCrane,
  onClose,
}: {
  editCrane: Crane | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const addCustomCrane = useLiftStore((s) => s.addCustomCrane);
  const updateCustomCrane = useLiftStore((s) => s.updateCustomCrane);
  const setStep = useLiftStore((s) => s.setStep);

  const isEdit = Boolean(editCrane);
  const [draft, setDraft] = useState<CraneDraft>(() =>
    editCrane ? draftFromCrane(editCrane) : defaultDraft()
  );
  // اگر کاربر خودش حداکثر شعاع را وارد کرده، دیگر روی آن دست نمی‌زنیم
  const [radiusAuto, setRadiusAuto] = useState(true);
  const [imageBroken, setImageBroken] = useState(false);

  const set = (key: keyof CraneDraft, v: string) =>
    setDraft((d) => ({ ...d, [key]: v }));

  // ── اعتبارسنجی: نام + ظرفیت + حداکثر بوم الزامی ──
  const nameOk = draft.name.trim().length > 0;
  const capacityOk = parseNum(draft.maxCapacityT) > 0;
  const boomMaxOk = parseNum(draft.mainBoomMaxM) > 0;
  const isValid = nameOk && capacityOk && boomMaxOk;

  const jibFactor = useMemo(() => {
    const v = parseNum(draft.jibCapacityFactor);
    return Number.isFinite(v) ? clamp(v, 0.5, 1) : 0.75;
  }, [draft.jibCapacityFactor]);

  const isTower = draft.type === "tower";

  /** تغییر نوع جرثقیل — مقدارهای غیرمرتبط با نوع جدید هوشمندانه تنظیم می‌شوند */
  const handleTypeChange = (t: CraneType) => {
    setDraft((d) => {
      const next = { ...d, type: t };
      if (t === "tower") {
        next.minBoomAngleDeg = "0";
        next.maxBoomAngleDeg = "0";
        next.jibMinM = "0";
        next.jibMaxM = "0";
        next.jibCapacityFactor = "1";
        next.pivotHeightM = "0";
        next.pivotOffsetM = "0";
        if (!next.freestandingHookHeightM.trim()) {
          next.freestandingHookHeightM = "40";
        }
        if (!next.mainBoomMinM.trim()) next.mainBoomMinM = "40";
        if (!next.mainBoomMaxM.trim()) next.mainBoomMaxM = "70";
        if (radiusAuto) next.maxRadiusM = suggestMaxRadius("tower", next.mainBoomMaxM);
      } else {
        next.minBoomAngleDeg = "10";
        next.maxBoomAngleDeg = "80";
        next.pivotHeightM = "2.4";
        next.pivotOffsetM = "1.7";
        next.jibCapacityFactor = "0.75";
        if (radiusAuto) {
          next.maxRadiusM = suggestMaxRadius("mobile", next.mainBoomMaxM);
        }
      }
      return next;
    });
  };

  const handleMainBoomMaxChange = (v: string) => {
    setDraft((d) => ({
      ...d,
      mainBoomMaxM: v,
      ...(radiusAuto ? { maxRadiusM: suggestMaxRadius(d.type, v) } : {}),
    }));
  };

  const handleSave = () => {
    if (!isValid) return;
    const name = draft.name.trim();
    const specs = buildSpecs(draft);
    const image = draft.imageUrl.trim() || PLACEHOLDER_IMAGE;
    const description =
      draft.description.trim() ||
      `${CRANE_TYPE_LABELS[draft.type]} سفارشی با ظرفیت اسمی ${specs.maxCapacityT} تن — توسط کاربر تعریف شده.`;

    if (editCrane) {
      // ویرایش: شناسه و لودچارت قبلی دست‌نخورده می‌ماند
      updateCustomCrane(editCrane.id, {
        name,
        manufacturer: draft.manufacturer.trim() || "سفارشی",
        type: draft.type,
        image,
        description,
        specs,
      });
      toast({
        title: "مشخصات جرثقیل به‌روزرسانی شد",
        description: `${name} — لودچارت قبلی حفظ شد.`,
      });
    } else {
      const crane: Crane = {
        id: makeCustomCraneId(name),
        name,
        manufacturer: draft.manufacturer.trim() || "سفارشی",
        type: draft.type,
        image,
        specs,
        description,
      };
      addCustomCrane(crane); // انتخاب خودکار + seed لودچارت خالی
      toast({
        title: "جرثقیل سفارشی ثبت شد — لودچارت خالی آن در مرحله ۲ پر کنید",
        description: `${name} انتخاب شد؛ در مرحله بعد مقادیر جدول ظرفیت را وارد کنید.`,
      });
      setStep(1); // پرش به مرحله ۲ (ویرایش لودچارت)
    }
    onClose();
  };

  return (
    <>
      <DialogContent className="max-w-[calc(100%-2rem)] gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4 text-start">
          <DialogTitle className="flex items-center gap-2 text-base">
            {isEdit ? (
              <Pencil className="size-4 text-amber-500" />
            ) : (
              <CirclePlus className="size-4 text-amber-500" />
            )}
            {isEdit ? `ویرایش جرثقیل سفارشی — ${editCrane?.name ?? ""}` : "افزودن جرثقیل سفارشی"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "مشخصات را ویرایش کنید — شناسه و لودچارت ثبت‌شده قبلی حفظ می‌شود."
              : "اگر مدل جرثقیل شما در نمونه‌های مرجع نیست، مشخصات فنی آن را اینجا تعریف کنید."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto scroll-slim px-6 py-4">
          {/* ── اطلاعات پایه ── */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold tracking-wide text-amber-600 dark:text-amber-400">
              اطلاعات پایه
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-xs font-medium">
                  نام مدل
                  <span className="text-red-500">*</span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    (مثلاً SANY STC250)
                  </span>
                </Label>
                <Input
                  dir="ltr"
                  className="text-start"
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="SANY STC250"
                  aria-invalid={!nameOk || undefined}
                />
                {!nameOk && (
                  <p className="flex items-center gap-1 text-[11px] text-red-500">
                    <TriangleAlert className="size-3 shrink-0" />
                    نام مدل الزامی است.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  سازنده
                  <span className="ms-1 text-[10px] font-normal text-muted-foreground">
                    (اختیاری)
                  </span>
                </Label>
                <Input
                  value={draft.manufacturer}
                  onChange={(e) => set("manufacturer", e.target.value)}
                  placeholder="سانی، لیبهر، پوتن ..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">نوع جرثقیل</Label>
                <Select
                  value={draft.type}
                  onValueChange={(v) => handleTypeChange(v as CraneType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="انتخاب نوع" />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(CRANE_TYPE_LABELS) as CraneType[]
                    ).map((t) => (
                      <SelectItem key={t} value={t}>
                        {CRANE_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  آدرس تصویر
                  <span className="ms-1 text-[10px] font-normal text-muted-foreground">
                    (اختیاری — خالی بگذارید تا تصویر پیش‌فرض استفاده شود)
                  </span>
                </Label>
                <Input
                  dir="ltr"
                  value={draft.imageUrl}
                  onChange={(e) => {
                    set("imageUrl", e.target.value);
                    setImageBroken(false);
                  }}
                  placeholder="/cranes/my-crane.jpg یا https://..."
                />
                {draft.imageUrl.trim() && !imageBroken && (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-1.5">
                    {/* تصویر خارجی ممکن است دامنه دلخواه کاربر باشد — از img ساده استفاده می‌کنیم */}
                    <img
                      src={draft.imageUrl.trim()}
                      alt="پیش‌نمایش تصویر جرثقیل"
                      className="h-12 w-20 rounded object-cover"
                      onError={() => setImageBroken(true)}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      پیش‌نمایش تصویر
                    </span>
                  </div>
                )}
                {imageBroken && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    تصویر بارگذاری نشد — هنگام نمایش، تصویر پیش‌فرض جایگزین می‌شود.
                  </p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-medium">
                  توضیح کوتاه
                  <span className="ms-1 text-[10px] font-normal text-muted-foreground">
                    (اختیاری — فارسی)
                  </span>
                </Label>
                <Textarea
                  rows={2}
                  className="min-h-0"
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="مثلاً: جرثقیل سیار ۲۵ تنی مناسب لیفت‌های شهری و نصب اسکلت فلزی ..."
                />
              </div>
            </div>
          </section>

          {/* ── مشخصات فنی ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold tracking-wide text-amber-600 dark:text-amber-400">
                مشخصات فنی
              </h3>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Info className="size-3 text-amber-500" />
                پیش‌فرض‌های هوشمند: با واردکردن حداکثر طول بوم، حداکثر شعاع به‌صورت خودکار پیشنهاد می‌شود.
              </p>
            </div>

            {isTower && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] leading-5 text-amber-700 dark:text-amber-300">
                جرثقیل برجی: زاویه بوم، جیب ثانویه و هندسه پین بوم اعمال نمی‌شود؛
                طول «بوم اصلی» همان بازه طول جیب تکرلی است و ارتفاع آزاد قلاب جایگزین زاویه‌ها می‌شود.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <NumField
                label="ظرفیت اسمی"
                unit="تن"
                required
                value={draft.maxCapacityT}
                onChange={(v) => set("maxCapacityT", v)}
                invalid={!capacityOk}
                helper="ظرفیت باید عددی بزرگ‌تر از صفر باشد."
                placeholder="50"
                min={0.1}
              />
              <NumField
                label="حداکثر طول بوم اصلی"
                unit="متر"
                required
                value={draft.mainBoomMaxM}
                onChange={handleMainBoomMaxChange}
                invalid={!boomMaxOk}
                helper="حداکثر طول بوم الزامی است."
                placeholder={isTower ? "70" : "45"}
                min={1}
              />
              <NumField
                label="حداقل طول بوم اصلی"
                unit="متر"
                value={draft.mainBoomMinM}
                onChange={(v) => set("mainBoomMinM", v)}
                placeholder={isTower ? "40" : "11.7"}
                min={0}
              />
              <NumField
                label="حداقل شعاع کاری"
                unit="متر"
                value={draft.minRadiusM}
                onChange={(v) => set("minRadiusM", v)}
                min={0}
                step={0.1}
              />
              <NumField
                label="حداکثر شعاع کاری"
                unit="متر"
                value={draft.maxRadiusM}
                onChange={(v) => {
                  setRadiusAuto(false);
                  set("maxRadiusM", v);
                }}
                placeholder="خودکار"
                min={0}
                step={0.1}
              />
              {!isTower && (
                <>
                  <NumField
                    label="حداقل طول جیب"
                    unit="متر"
                    value={draft.jibMinM}
                    onChange={(v) => set("jibMinM", v)}
                    placeholder="0"
                    min={0}
                    step={0.1}
                  />
                  <NumField
                    label="حداکثر طول جیب"
                    unit="متر"
                    value={draft.jibMaxM}
                    onChange={(v) => set("jibMaxM", v)}
                    placeholder="0"
                    min={0}
                    step={0.1}
                  />
                </>
              )}
              <NumField
                label="کانترویت"
                unit="تن"
                value={draft.counterweightT}
                onChange={(v) => set("counterweightT", v)}
                placeholder="8.5"
                min={0}
                step={0.1}
              />
              <NumField
                label="وزن خود جرثقیل"
                unit="تن"
                value={draft.selfWeightT}
                onChange={(v) => set("selfWeightT", v)}
                placeholder="39"
                min={0}
                step={0.1}
              />
              <NumField
                label="دهانه اوت‌ریگر"
                unit="متر"
                value={draft.outriggerSpanM}
                onChange={(v) => set("outriggerSpanM", v)}
                placeholder="7.46"
                min={0}
                step={0.1}
              />
              <NumField
                label="حد باد کار"
                unit="m/s"
                value={draft.windLimitMs}
                onChange={(v) => set("windLimitMs", v)}
                min={0}
                step={0.1}
              />
              {isTower ? (
                <NumField
                  label="ارتفاع آزاد قلاب"
                  unit="متر"
                  value={draft.freestandingHookHeightM}
                  onChange={(v) => set("freestandingHookHeightM", v)}
                  placeholder="40"
                  min={0}
                  step={0.1}
                />
              ) : (
                <>
                  <NumField
                    label="حداقل زاویه بوم"
                    unit="درجه"
                    value={draft.minBoomAngleDeg}
                    onChange={(v) => set("minBoomAngleDeg", v)}
                    min={0}
                    max={89}
                  />
                  <NumField
                    label="حداکثر زاویه بوم"
                    unit="درجه"
                    value={draft.maxBoomAngleDeg}
                    onChange={(v) => set("maxBoomAngleDeg", v)}
                    min={0}
                    max={90}
                  />
                  <NumField
                    label="ارتفاع پین بوم"
                    unit="متر"
                    value={draft.pivotHeightM}
                    onChange={(v) => set("pivotHeightM", v)}
                    min={0}
                    step={0.1}
                  />
                  <NumField
                    label="فاصله پین از مرکز"
                    unit="متر"
                    value={draft.pivotOffsetM}
                    onChange={(v) => set("pivotOffsetM", v)}
                    min={0}
                    step={0.1}
                  />
                </>
              )}
            </div>

            {/* سیم بکسل و قرقره — برای تحلیل ظرفیت قلاب و گزارش */}
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                سیم بکسل وینچ و تعداد رشته قلاب (قرقره)
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumField
                  label="حداکثر رشته قلاب"
                  unit="رشته"
                  value={draft.maxPartsOfLine}
                  onChange={(v) => set("maxPartsOfLine", v)}
                  min={1}
                  max={16}
                />
                <NumField
                  label="قطر سیم"
                  unit="mm"
                  value={draft.ropeDiameterMm}
                  onChange={(v) => set("ropeDiameterMm", v)}
                  min={6}
                  max={60}
                />
                <NumField
                  label="MBL سیم"
                  unit="تن"
                  value={draft.ropeMBLT}
                  onChange={(v) => set("ropeMBLT", v)}
                  placeholder="خودکار"
                  min={0}
                  step={0.1}
                  helper={
                    draft.ropeMBLT
                      ? undefined
                      : `تخمین: ${ropeMBLT(
                          Math.max(6, parseNum(draft.ropeDiameterMm) || 20),
                          "6x36",
                          draft.ropeCore
                        ).toFixed(1)} تن`
                  }
                />
                <div className="space-y-1.5">
                  <Label className="text-xs">نوع مغز سیم</Label>
                  <Select
                    value={draft.ropeCore}
                    onValueChange={(v) => set("ropeCore", v as RopeCore)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FC">{ROPE_CORE_LABELS.FC}</SelectItem>
                      <SelectItem value="IWRC">{ROPE_CORE_LABELS.IWRC}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                اگر MBL را خالی بگذارید، از قطر و نوع مغز تخمین زده می‌شود. این مقادیر در بررسی
                ظرفیت قلاب، تحلیل و گزارش PDF استفاده می‌شوند.
              </p>
            </div>

            {/* ضریب کاهش جیب — فقط غیربرجی */}
            {!isTower && (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">
                    ضریب کاهش ظرفیت جیب
                    <span className="ms-1 text-[10px] font-normal text-muted-foreground">
                      (بدون جدول جیب)
                    </span>
                  </Label>
                  <span
                    dir="ltr"
                    className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400"
                  >
                    × {jibFactor.toFixed(2)}
                  </span>
                </div>
                <Slider
                  min={0.5}
                  max={1}
                  step={0.05}
                  value={[jibFactor]}
                  onValueChange={([v]) => set("jibCapacityFactor", String(v))}
                  aria-label="ضریب کاهش ظرفیت جیب"
                  className="[&_[data-slot=slider-range]]:bg-amber-500 [&_[data-slot=slider-thumb]]:border-amber-500"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground" dir="ltr">
                  <span>0.50</span>
                  <span>1.00</span>
                </div>
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="items-center gap-3 border-t px-6 py-4 sm:justify-between">
          {!isValid && (
            <p className="hidden text-[11px] text-red-500 sm:block">
              فیلدهای ستاره‌دار (*) را کامل کنید تا دکمه ثبت فعال شود.
            </p>
          )}
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" onClick={onClose}>
              انصراف
            </Button>
            <Button
              className="bg-amber-500 text-black hover:bg-amber-400"
              disabled={!isValid}
              onClick={handleSave}
            >
              <Save className="size-4" />
              {isEdit ? "ذخیره تغییرات" : "ثبت جرثقیل سفارشی"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </>
  );
}

export interface CustomCraneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editCrane?: Crane | null;
}

export default function CustomCraneDialog({
  open,
  onOpenChange,
  editCrane = null,
}: CustomCraneDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* فرم با key ثابت به جرثقیل مقصد — هنگام باز شدن همیشه تازه mount می‌شود */}
      {open && (
        <CraneForm
          key={editCrane?.id ?? "create"}
          editCrane={editCrane}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}
