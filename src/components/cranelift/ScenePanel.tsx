"use client";

/**
 * IHMS CraneLift 3D — پنل نمایش سه‌بعدی
 * -----------------------------------------------------------
 * کانواس سه‌بعدی (client-only) + HUD زنده (زاویه بوم، طول بوم، شعاع،
 * ارتفاع قلاب، زاویه چرخش و فاز حرکت) + دکمه بزرگ «تحلیل لیفت / Play».
 * با یک دکمه همه‌چیز اجرا می‌شود: تحلیل کامل + (در صورت ثبت دو پرچم A/B)
 * شبیه‌سازی حرکت جرثقیل و نمایش نتیجه مجاز/غیرمجاز در پایان حرکت.
 */

import dynamic from "next/dynamic";
import { useState } from "react";
import { Play, Box, AlertTriangle, Loader2, MapPin, Compass, Move, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiftStore } from "@/lib/cranelift/store";
import { getCraneById } from "@/lib/cranelift/cranes";
import { solveGeometry, STATUS_COLORS, STATUS_LABELS } from "@/lib/cranelift/analysis";
import { playUnified } from "./run-analysis";
import { useSim } from "./three/sim-store";
import { useView3D } from "./three/view3d-store";
import { useUiStore } from "./ui-store";
import { useToast } from "@/hooks/use-toast";

// کانواس سه‌بعدی فقط در مرورگر
const CraneScene = dynamic(() => import("./three/CraneScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#18181b]">
      <Skeleton className="h-full w-full rounded-xl opacity-30" />
    </div>
  ),
});

/** یک خانه HUD زنده */
function HudCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md bg-black/45 px-2 py-1 backdrop-blur-sm">
      <div className="text-[9.5px] leading-none text-zinc-400">{label}</div>
      <div
        className={`mt-0.5 text-[12.5px] font-bold leading-none tabular-nums ${
          accent ? "text-amber-400" : "text-zinc-100"
        }`}
        dir="ltr"
      >
        {value}
      </div>
    </div>
  );
}

export default function ScenePanel() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const selectedId = useLiftStore((s) => s.selectedCraneId);
  const inputs = useLiftStore((s) => s.inputs);
  const result = useLiftStore((s) => s.result);
  const cranePos = useLiftStore((s) => s.cranePos);
  const license = useLiftStore((s) => s.license);
  const pickPoint = useLiftStore((s) => s.pickPoint);
  const placePoint = useLiftStore((s) => s.placePoint);
  const simActive = useSim((s) => s.active);
  const simPose = useSim((s) => s.pose);
  const flagMode = useView3D((s) => s.flagMode);
  const pendingObjectType = useView3D((s) => s.pendingObjectType);
  const setUpgradeOpen = useUiStore((s) => s.setUpgradeOpen);

  const customCranes = useLiftStore((s) => s.customCranes);
  const crane = getCraneById(selectedId, customCranes);
  const geo = crane ? solveGeometry(crane, inputs) : null;
  const grossT = inputs.loadWeightT + inputs.hookBlockWeightT + inputs.riggingWeightT;
  const bothFlags = !!(pickPoint && placePoint);

  const handlePlay = async () => {
    if (running || simActive) return;
    setRunning(true);
    try {
      await playUnified({
        toast,
        onQuotaExceeded: () => setUpgradeOpen(true),
      });
    } finally {
      setRunning(false);
    }
  };

  // ── داده‌های HUD: حین حرکت از پوز زنده، وگرنه از هندسه ایستا ──
  const boomDeg = simPose ? simPose.boomDeg : geo?.ok && crane?.type !== "tower" ? (geo?.boomAngleDeg ?? null) : null;
  const radius = simPose ? simPose.radiusM : geo?.radiusM ?? null;
  const hookH = simPose ? simPose.hookTopY : geo?.tipHeightM ?? null;
  const slewDeg = simPose ? ((simPose.slewDeg % 360) + 360) % 360 : inputs.slewAngleDeg;
  const modeBanner =
    flagMode === "pick"
      ? "روی زمین کلیک کنید: پرچم A (برداشت)"
      : flagMode === "place"
        ? "روی زمین کلیک کنید: پرچم B (جایگذاری)"
        : flagMode === "moveCrane"
          ? "روی زمین کلیک کنید: محل جدید جرثقیل"
          : flagMode === "object" && pendingObjectType
            ? "روی زمین کلیک کنید: افزودن تجهیز (حالت فعال می‌ماند)"
            : null;

  return (
    <Card className="overflow-hidden border-2">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Box className="size-5 text-amber-500" />
          نمای سه‌بعدی لیفت
        </CardTitle>
        {result && (
          <Badge className="text-black" style={{ backgroundColor: STATUS_COLORS[result.status] }}>
            {STATUS_LABELS[result.status]}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative h-[340px] overflow-hidden rounded-xl border border-border bg-[#18181b] lg:h-[420px]">
          {crane ? (
            <>
              <CraneScene />

              {/* ── HUD زنده مشخصات (زاویه بوم و ...) ── */}
              <div className="pointer-events-none absolute end-2 top-2 flex w-[142px] flex-col gap-1">
                <HudCell
                  label="زاویه بوم"
                  value={crane?.type === "tower" ? "افقی" : boomDeg != null ? `∠ ${boomDeg.toFixed(0)}°` : "—"}
                  accent
                />
                <HudCell label="طول بوم" value={`${inputs.boomLengthM.toFixed(1)} m`} />
                <HudCell label="شعاع" value={radius != null ? `R ${radius.toFixed(1)} m` : "—"} />
                <HudCell label="نوک بوم / قلاب" value={hookH != null ? `${hookH.toFixed(1)} m` : "—"} />
                <HudCell label="چرخش" value={`↻ ${slewDeg.toFixed(0)}°`} />
                <HudCell label="بار کل" value={`${grossT.toFixed(1)} t`} accent />
              </div>

              {/* فاز حرکت */}
              {(simActive || (simPose && simPose.progress < 1)) && (
                <div className="absolute inset-x-2 bottom-2 rounded-lg border border-amber-500/40 bg-black/60 p-2 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1.5 font-bold text-amber-400">
                      {simActive ? <Loader2 className="size-3 animate-spin" /> : null}
                      {simPose?.phaseLabel ?? "آماده‌سازی حرکت..."}
                    </span>
                    <span className="text-zinc-300" dir="ltr">
                      R {simPose?.radiusM.toFixed(1) ?? "—"} m · ∠ {simPose?.boomDeg.toFixed(0) ?? "—"}°
                    </span>
                  </div>
                  <Progress value={(simPose?.progress ?? 0) * 100} className="mt-1.5 h-1" />
                </div>
              )}

              {/* راهنمای حالت کلیک */}
              {modeBanner && (
                <div className="absolute inset-x-2 top-2 flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/90 px-3 py-1.5 text-[11px] font-bold text-black shadow-lg">
                  <MapPin className="size-3.5" />
                  {modeBanner}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <AlertTriangle className="size-10 text-amber-500/60" />
              <p className="text-sm">برای مشاهده صحنه سه‌بعدی، ابتدا جرثقیل انتخاب کنید</p>
            </div>
          )}
        </div>

        {/* آمار سریع */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border bg-muted/40 px-2 py-1.5">
            <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <Compass className="size-3" />
              شعاع
            </div>
            <div className="text-sm font-bold" dir="ltr">
              {geo?.ok ? `${geo.radiusM.toFixed(1)} m` : "—"}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/40 px-2 py-1.5">
            <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <Move className="size-3" />
              محل جرثقیل
            </div>
            <div className="text-sm font-bold" dir="ltr">
              {cranePos ? `(${cranePos.x.toFixed(1)}, ${cranePos.z.toFixed(1)})` : "(0, 0)"}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/40 px-2 py-1.5">
            <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <Package className="size-3" />
              ظرفیت مجاز
            </div>
            <div className="text-sm font-bold" dir="ltr">
              {result?.ratedCapacityT != null ? `${result.ratedCapacityT.toFixed(1)} t` : "—"}
            </div>
          </div>
        </div>

        {/* دکمه بزرگ Play — تحلیل + شبیه‌سازی + نتیجه، همه یکجا */}
        <Button
          size="lg"
          disabled={running || !crane || simActive}
          onClick={handlePlay}
          className="h-14 w-full gap-3 border-2 border-amber-300/40 bg-amber-500 text-lg font-black text-black shadow-[0_0_36px_rgba(245,158,11,0.28)] transition-all hover:bg-amber-400 hover:shadow-[0_0_48px_rgba(245,158,11,0.4)] active:scale-[0.99]"
        >
          <Play className="size-6 fill-black" />
          {running
            ? "در حال تحلیل..."
            : simActive
              ? "در حال حرکت جرثقیل..."
              : "تحلیل لیفت / Play"}
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          {bothFlags
            ? "دو پرچم ثبت شده — با Play، تحلیل کامل + حرکت جرثقیل از A تا B یکجا اجرا و در پایان نتیجه مجاز/غیرمجاز اعلام می‌شود."
            : "با Play کل تحلیل اجرا می‌شود؛ برای شبیه‌سازی حرکت، دو پرچم A و B را در مرحله ۴ روی زمین بگذارید."}
          {" • "}
          چرخش: درگ • زوم: اسکرول
          {license.plan === "free" ? " • سهمیه رایگان امروز: تحلیل+حرکت" : ""}
        </p>
      </CardContent>
    </Card>
  );
}
