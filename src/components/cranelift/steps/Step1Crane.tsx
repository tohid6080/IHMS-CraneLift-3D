"use client";

/**
 * CraneLift Pro 3D — مرحله ۱: انتخاب جرثقیل
 * -----------------------------------------------------------
 * گالری ۱۲ مدل واقعی جرثقیل با فیلتر نوع، کارت‌های تصویری و
 * جدول مشخصات فنی جرثقیل انتخاب‌شده.
 * + بخش «جرثقیل‌های من (سفارشی)»: مدل‌های تعریف‌شده توسط کاربر با
 *   امکان ویرایش/حذف، و دکمه افزودن جرثقیل سفارشی (CustomCraneDialog).
 */

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Truck,
  Tractor,
  Building2,
  CheckCircle2,
  ChevronLeft,
  LayoutGrid,
  Weight,
  Ruler,
  Scale,
  CirclePlus,
  Pencil,
  Trash2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CRANES, getCraneById } from "@/lib/cranelift/cranes";
import { getChartFor } from "@/lib/cranelift/load-charts";
import { ropeSpecOf } from "@/lib/cranelift/wire-rope";
import { useLiftStore } from "@/lib/cranelift/store";
import {
  CRANE_TYPE_LABELS,
  type Crane,
  type CraneType,
  type LoadChart,
} from "@/lib/cranelift/types";
import { useToast } from "@/hooks/use-toast";
import CustomCraneDialog from "@/components/cranelift/CustomCraneDialog";

const TYPE_ICONS = { mobile: Truck, crawler: Tractor, tower: Building2 } as const;

/** تنظیم مقادیر پیش‌فرض ورودی‌ها بر اساس جرثقیل انتخاب‌شده (مرجع یا سفارشی) */
function fitInputsToCrane(
  id: string,
  customCranes: Crane[],
  customCharts: Record<string, LoadChart>
) {
  const crane = getCraneById(id, customCranes);
  const chart = getChartFor(id, customCharts); // لودچارت سفارشی بر مرجع اولویت دارد
  if (!crane || !chart) return;
  const s = crane.specs;
  const midBoom =
    chart.sections[Math.floor(chart.sections.length / 2)].boomLengthM;
  const midJib = s.jibMaxM > 0 ? (s.jibMinM + s.jibMaxM) / 2 : 10;
  useLiftStore.getState().setInputs({
    boomLengthM: midBoom,
    jibLengthM: midJib,
    radiusM: Math.min(Math.max(s.minRadiusM + 4, 10), s.maxRadiusM * 0.5),
    useJib: false,
    requiredHookHeightM:
      crane.type === "tower"
        ? Math.min((s.freestandingHookHeightM ?? 40) * 0.35, 22)
        : 10,
    partsOfLine: ropeSpecOf(crane).maxPartsOfLine, // قرقره کامل پیش‌فرض
    ropeOverrideMblT: null, // بازگشت به سیم پیش‌فرض جرثقیل
  });
}

export default function Step1Crane() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<CraneType | "all">("all");
  const selectedCraneId = useLiftStore((s) => s.selectedCraneId);
  const selectCrane = useLiftStore((s) => s.selectCrane);
  const next = useLiftStore((s) => s.next);
  const customCranes = useLiftStore((s) => s.customCranes);
  const customCharts = useLiftStore((s) => s.customCharts);
  const removeCustomCrane = useLiftStore((s) => s.removeCustomCrane);

  // ── گفت‌وگوی جرثقیل سفارشی ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCrane, setEditCrane] = useState<Crane | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // بازنشانی خودکار حالت «تأیید دوم حذف» پس از چند ثانیه
  useEffect(() => {
    if (!pendingDeleteId) return;
    const t = setTimeout(() => setPendingDeleteId(null), 4000);
    return () => clearTimeout(t);
  }, [pendingDeleteId]);

  const selected = getCraneById(selectedCraneId, customCranes);
  const list = useMemo(
    () => (filter === "all" ? CRANES : CRANES.filter((c) => c.type === filter)),
    [filter]
  );

  const handleSelect = (id: string) => {
    selectCrane(id);
    fitInputsToCrane(id, customCranes, customCharts);
    const isCustom = customCranes.some((c) => c.id === id);
    toast({
      title: `جرثقیل ${getCraneById(id, customCranes)?.name} انتخاب شد`,
      description: isCustom
        ? "لودچارت سفارشی شما بارگذاری شد — مقادیر جدول را در مرحله ۲ وارد کنید."
        : "مشخصات پایه و لودچارت مرجع بارگذاری شد — ورودی‌های پیش‌فرض تنظیم شد.",
    });
  };

  const openCreateDialog = () => {
    setEditCrane(null);
    setDialogOpen(true);
  };

  const openEditDialog = (crane: Crane) => {
    setEditCrane(crane);
    setDialogOpen(true);
  };

  const handleDeleteCustom = (crane: Crane) => {
    if (pendingDeleteId === crane.id) {
      removeCustomCrane(crane.id); // لودچارت سفارشی + انتخاب هم پاک می‌شود
      setPendingDeleteId(null);
      toast({
        title: `جرثقیل ${crane.name} حذف شد`,
        description: "لودچارت سفارشی مرتبط با آن نیز پاک شد.",
      });
    } else {
      setPendingDeleteId(crane.id);
      toast({
        title: "برای تأیید حذف، دوباره روی آیکن سطل کلیک کنید",
        description: `حذف ${crane.name} — لودچارت سفارشی آن هم حذف می‌شود.`,
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* فیلتر نوع */}
      <div className="flex flex-wrap items-center gap-2">
        <LayoutGrid className="size-4 text-muted-foreground" />
        {(
          [
            ["all", "همه مدل‌ها", LayoutGrid],
            ["mobile", "سیار", Truck],
            ["crawler", "شنی", Tractor],
            ["tower", "برجی", Building2],
          ] as const
        ).map(([key, label, Icon]) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? "default" : "outline"}
            className={
              filter === key
                ? "bg-amber-500 text-black hover:bg-amber-500"
                : "hover:border-amber-500/50"
            }
            onClick={() => setFilter(key)}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
        <span className="ms-auto text-xs text-muted-foreground">
          {list.length} مدل
        </span>
      </div>

      {/* افزودن جرثقیل سفارشی — کارت برجسته بالای گالری */}
      <button
        type="button"
        onClick={openCreateDialog}
        className="group flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-amber-500/50 bg-amber-500/5 p-4 text-start transition-colors hover:border-amber-500 hover:bg-amber-500/10 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none"
        aria-label="افزودن جرثقیل سفارشی"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-500/15 transition-colors group-hover:bg-amber-500/25">
          <CirclePlus className="size-5 text-amber-500" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold">افزودن جرثقیل سفارشی</span>
          <span className="block text-xs text-muted-foreground">
            مدل و مشخصات جرثقیل خودتان را تعریف کنید
          </span>
        </span>
      </button>

      {/* جرثقیل‌های سفارشی کاربر */}
      {customCranes.length > 0 && (
        <section className="space-y-3" aria-label="جرثقیل‌های سفارشی من">
          <div className="flex flex-wrap items-center gap-2">
            <Wrench className="size-4 text-amber-500" />
            <h2 className="text-sm font-bold">جرثقیل‌های من (سفارشی)</h2>
            <Badge className="bg-amber-500 text-black">سفارشی</Badge>
            <span className="ms-auto text-xs text-muted-foreground">
              {customCranes.length} مدل
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {customCranes.map((crane) => {
              const isSelected = crane.id === selectedCraneId;
              const TypeIcon = TYPE_ICONS[crane.type];
              const isExternalImg = !crane.image.startsWith("/");
              const isPendingDelete = pendingDeleteId === crane.id;
              return (
                <Card
                  key={crane.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") handleSelect(crane.id);
                  }}
                  onClick={() => handleSelect(crane.id)}
                  className={`group cursor-pointer gap-3 overflow-hidden pt-0 transition-all hover:shadow-lg hover:shadow-amber-500/10 ${
                    isSelected
                      ? "border-2 border-amber-500 shadow-md shadow-amber-500/15"
                      : "border-amber-500/30 hover:border-amber-500/40"
                  }`}
                >
                  {/* تصویر */}
                  <div className="relative h-36 w-full overflow-hidden bg-muted">
                    {isExternalImg ? (
                      // تصویر با آدرس خارجی (https) — از img ساده استفاده می‌کنیم
                      <img
                        src={crane.image}
                        alt={`جرثقیل ${crane.name}`}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (!img.dataset.fallback) {
                            img.dataset.fallback = "1";
                            img.src = "/cranes/placeholder.svg";
                          }
                        }}
                      />
                    ) : (
                      <Image
                        src={crane.image}
                        alt={`جرثقیل ${crane.name}`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (!img.dataset.fallback) {
                            img.dataset.fallback = "1";
                            img.src = "/cranes/placeholder.svg";
                          }
                        }}
                      />
                    )}
                    <div className="absolute inset-x-0 top-0 flex justify-between gap-1 p-2">
                      <div className="flex flex-wrap gap-1">
                        <Badge className="bg-black/70 text-white backdrop-blur">
                          <TypeIcon className="size-3" />
                          {CRANE_TYPE_LABELS[crane.type].split(" ")[0]}
                        </Badge>
                        <Badge className="bg-amber-500 text-black">سفارشی</Badge>
                      </div>
                      {isSelected && (
                        <Badge className="gap-1 bg-amber-500 text-black">
                          <CheckCircle2 className="size-3.5" />
                          انتخاب‌شده
                        </Badge>
                      )}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <span className="text-xs text-white/80">{crane.manufacturer}</span>
                    </div>
                  </div>

                  <CardContent className="space-y-2.5 pb-4">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold leading-tight" dir="ltr">
                          {crane.name}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {crane.description}
                        </p>
                      </div>
                      {/* ابزار ویرایش / حذف */}
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-amber-600"
                          aria-label={`ویرایش ${crane.name}`}
                          title="ویرایش مشخصات"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(crane);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`size-7 ${
                            isPendingDelete
                              ? "bg-red-500 text-white hover:bg-red-500 hover:text-white"
                              : "text-muted-foreground hover:text-red-600"
                          }`}
                          aria-label={`حذف ${crane.name}${isPendingDelete ? " — برای تأیید دوباره کلیک کنید" : ""}`}
                          title={isPendingDelete ? "برای تأیید حذف دوباره کلیک کنید" : "حذف جرثقیل سفارشی"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustom(crane);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    {/* مشخصات کلیدی */}
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="rounded-md border bg-muted/40 py-1">
                        <Weight className="mx-auto size-3.5 text-amber-500" />
                        <div className="text-sm font-bold" dir="ltr">
                          {crane.specs.maxCapacityT} t
                        </div>
                        <div className="text-[10px] text-muted-foreground">ظرفیت</div>
                      </div>
                      <div className="rounded-md border bg-muted/40 py-1">
                        <Ruler className="mx-auto size-3.5 text-amber-500" />
                        <div className="text-sm font-bold" dir="ltr">
                          {crane.specs.mainBoomMaxM} m
                        </div>
                        <div className="text-[10px] text-muted-foreground">بوم</div>
                      </div>
                      <div className="rounded-md border bg-muted/40 py-1">
                        <Scale className="mx-auto size-3.5 text-amber-500" />
                        <div className="text-sm font-bold" dir="ltr">
                          {crane.specs.selfWeightT} t
                        </div>
                        <div className="text-[10px] text-muted-foreground">وزن خود</div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      variant={isSelected ? "default" : "outline"}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(crane.id);
                      }}
                    >
                      {isSelected ? "✓ انتخاب شد — مشاهده مشخصات" : "انتخاب این جرثقیل"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* گالری جرثقیل‌های مرجع */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((crane, i) => {
          const isSelected = crane.id === selectedCraneId;
          const TypeIcon = TYPE_ICONS[crane.type];
          return (
            <Card
              key={crane.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleSelect(crane.id);
              }}
              onClick={() => handleSelect(crane.id)}
              className={`group cursor-pointer gap-3 overflow-hidden pt-0 transition-all hover:shadow-lg hover:shadow-amber-500/10 ${
                isSelected
                  ? "border-2 border-amber-500 shadow-md shadow-amber-500/15"
                  : "hover:border-amber-500/40"
              }`}
            >
              {/* تصویر */}
              <div className="relative h-36 w-full overflow-hidden bg-muted">
                <Image
                  src={crane.image}
                  alt={`جرثقیل ${crane.name}`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  priority={i < 3}
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (!img.dataset.fallback) {
                      img.dataset.fallback = "1";
                      img.src = "/cranes/placeholder.svg";
                    }
                  }}
                />
                <div className="absolute inset-x-0 top-0 flex justify-between p-2">
                  <Badge className="bg-black/70 text-white backdrop-blur">
                    <TypeIcon className="size-3" />
                    {CRANE_TYPE_LABELS[crane.type].split(" ")[0]}
                  </Badge>
                  {isSelected && (
                    <Badge className="gap-1 bg-amber-500 text-black">
                      <CheckCircle2 className="size-3.5" />
                      انتخاب‌شده
                    </Badge>
                  )}
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <span className="text-xs text-white/80">{crane.manufacturer}</span>
                </div>
              </div>

              <CardContent className="space-y-2.5 pb-4">
                <div>
                  <h3 className="font-bold leading-tight" dir="ltr">
                    {crane.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {crane.description}
                  </p>
                </div>
                {/* مشخصات کلیدی */}
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-md border bg-muted/40 py-1">
                    <Weight className="mx-auto size-3.5 text-amber-500" />
                    <div className="text-sm font-bold" dir="ltr">
                      {crane.specs.maxCapacityT} t
                    </div>
                    <div className="text-[10px] text-muted-foreground">ظرفیت</div>
                  </div>
                  <div className="rounded-md border bg-muted/40 py-1">
                    <Ruler className="mx-auto size-3.5 text-amber-500" />
                    <div className="text-sm font-bold" dir="ltr">
                      {crane.specs.mainBoomMaxM} m
                    </div>
                    <div className="text-[10px] text-muted-foreground">بوم</div>
                  </div>
                  <div className="rounded-md border bg-muted/40 py-1">
                    <Scale className="mx-auto size-3.5 text-amber-500" />
                    <div className="text-sm font-bold" dir="ltr">
                      {crane.specs.selfWeightT} t
                    </div>
                    <div className="text-[10px] text-muted-foreground">وزن خود</div>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  variant={isSelected ? "default" : "outline"}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(crane.id);
                  }}
                >
                  {isSelected ? "✓ انتخاب شد — مشاهده مشخصات" : "انتخاب این جرثقیل"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* مشخصات کامل جرثقیل انتخاب‌شده */}
      {selected && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              مشخصات فنی — <span dir="ltr">{selected.name}</span>
              {customCranes.some((c) => c.id === selected.id) && (
                <Badge className="bg-amber-500 text-black">سفارشی</Badge>
              )}
              <Badge variant="outline" className="border-amber-500/50 text-amber-500">
                {CRANE_TYPE_LABELS[selected.type]}
              </Badge>
            </CardTitle>
            <CardDescription>{selected.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["ظرفیت اسمی", `${selected.specs.maxCapacityT} تن`],
                [
                  "بوم اصلی",
                  `${selected.specs.mainBoomMinM} تا ${selected.specs.mainBoomMaxM} متر`,
                ],
                [
                  "جیب",
                  selected.specs.jibMaxM > 0
                    ? `${selected.specs.jibMinM} تا ${selected.specs.jibMaxM} متر`
                    : "ندارد",
                ],
                ["وزن خود جرثقیل", `${selected.specs.selfWeightT} تن`],
                ["کانترویت", `${selected.specs.counterweightT} تن`],
                ["دهانه اوت‌ریگر / شنی", `${selected.specs.outriggerSpanM} متر`],
                [
                  "حداکثر باد مجاز",
                  `${selected.specs.windLimitMs} m/s`,
                ],
                [
                  "شعاع کاری",
                  `${selected.specs.minRadiusM} تا ${selected.specs.maxRadiusM} متر`,
                ],
                ...(selected.type === "tower"
                  ? [["ارتفاع آزاد قلاب", `${selected.specs.freestandingHookHeightM} متر`]]
                  : [
                      [
                        "زاویه بوم",
                        `${selected.specs.minBoomAngleDeg}° تا ${selected.specs.maxBoomAngleDeg}°`,
                      ],
                    ]),
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-2 border-b border-dashed py-1"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold" dir="auto">
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                className="w-full bg-amber-500 text-black hover:bg-amber-400 sm:w-auto"
                onClick={() => next()}
              >
                ادامه: مشاهده لودچارت
                <ChevronLeft className="size-4" />
              </Button>
              {customCranes.some((c) => c.id === selected.id) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-500/50 hover:border-amber-500 hover:text-amber-600"
                  onClick={() => openEditDialog(selected)}
                >
                  <Pencil className="size-3.5" />
                  ویرایش مشخصات این جرثقیل
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* گفت‌وگوی تعریف / ویرایش جرثقیل سفارشی */}
      <CustomCraneDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editCrane={editCrane}
      />
    </div>
  );
}
