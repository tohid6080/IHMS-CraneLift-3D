"use client";

/**
 * CraneLift Pro 3D — مرحله ۱: انتخاب جرثقیل
 * -----------------------------------------------------------
 * گالری ۱۲ مدل واقعی جرثقیل با فیلتر نوع، کارت‌های تصویری و
 * جدول مشخصات فنی جرثقیل انتخاب‌شده.
 */

import { useMemo, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CRANES, getCraneById } from "@/lib/cranelift/cranes";
import { DEFAULT_LOAD_CHARTS } from "@/lib/cranelift/load-charts";
import { useLiftStore } from "@/lib/cranelift/store";
import { CRANE_TYPE_LABELS, type CraneType } from "@/lib/cranelift/types";
import { useToast } from "@/hooks/use-toast";

const TYPE_ICONS = { mobile: Truck, crawler: Tractor, tower: Building2 } as const;

/** تنظیم مقادیر پیش‌فرض ورودی‌ها بر اساس جرثقیل انتخاب‌شده */
function fitInputsToCrane(id: string) {
  const crane = getCraneById(id);
  const chart = DEFAULT_LOAD_CHARTS[id];
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
  });
}

export default function Step1Crane() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<CraneType | "all">("all");
  const selectedCraneId = useLiftStore((s) => s.selectedCraneId);
  const selectCrane = useLiftStore((s) => s.selectCrane);
  const next = useLiftStore((s) => s.next);

  const selected = getCraneById(selectedCraneId);
  const list = useMemo(
    () => (filter === "all" ? CRANES : CRANES.filter((c) => c.type === filter)),
    [filter]
  );

  const handleSelect = (id: string) => {
    selectCrane(id);
    fitInputsToCrane(id);
    toast({
      title: `جرثقیل ${getCraneById(id)?.name} انتخاب شد`,
      description: "مشخصات پایه و لودچارت مرجع بارگذاری شد — ورودی‌های پیش‌فرض تنظیم شد.",
    });
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

      {/* گالری جرثقیل‌ها */}
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
            <Button
              className="mt-4 w-full bg-amber-500 text-black hover:bg-amber-400 sm:w-auto"
              onClick={() => next()}
            >
              ادامه: مشاهده لودچارت
              <ChevronLeft className="size-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
