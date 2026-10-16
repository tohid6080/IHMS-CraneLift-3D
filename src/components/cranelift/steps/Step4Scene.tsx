"use client";

/**
 * IHMS CraneLift 3D — مرحله ۴: صحنه سه‌بعدی
 * -----------------------------------------------------------
 * - پرچم‌های برداشت/جایگذاری (A/B): کلیک روی زمین + ارتفاع برداشت/جایگذاری
 * - جابه‌جایی جرثقیل: کلیک روی زمین برای بردن جرثقیل به محل جدید
 * - تجهیزات محوطه (نیروگاه/پالایشگاه): فونداسیون، سازه، برج، مخزن، مبدل و ...
 * - شبیه‌سازی حرکت دیگر دکمه جداگانه ندارد؛ با همان دکمه واحد «تحلیل لیفت / Play»
 *   (پنل سه‌بعدی یا مرحله ۵) تحلیل + حرکت + نتیجه یکجا اجرا می‌شود.
 * - کلیدهای نمایش، زاویه چرخش، شیب زمین و مانع صحنه
 */

import {
  CircleOff,
  MoveUp,
  Compass,
  Tags,
  Camera,
  Mountain,
  RotateCw,
  Box,
  Info,
  MapPin,
  Flag,
  Square,
  Trash2,
  Loader2,
  Move,
  Package,
  X,
  Crosshair,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLiftStore } from "@/lib/cranelift/store";
import { SCENE_OBJECT_LIST } from "@/lib/cranelift/scene-objects";
import { useView3D } from "../three/view3d-store";
import { useSim } from "../three/sim-store";
import { startTransferSim, stopTransferSim } from "../run-analysis";
import TransferVerdictCard from "../TransferVerdictCard";
import { captureScene } from "@/lib/cranelift/capture";
import { useToast } from "@/hooks/use-toast";

export default function Step4Scene() {
  const { toast } = useToast();
  const view = useView3D();
  const inputs = useLiftStore((s) => s.inputs);
  const setInputs = useLiftStore((s) => s.setInputs);
  const setObstacle = useLiftStore((s) => s.setObstacle);
  const setScreenshot3D = useLiftStore((s) => s.setScreenshot3D);
  const pickPoint = useLiftStore((s) => s.pickPoint);
  const placePoint = useLiftStore((s) => s.placePoint);
  const clearFlags = useLiftStore((s) => s.clearFlags);
  const transfer = useLiftStore((s) => s.transfer);
  const cranePos = useLiftStore((s) => s.cranePos);
  const setCranePos = useLiftStore((s) => s.setCranePos);
  const sceneObjects = useLiftStore((s) => s.sceneObjects);
  const updateSceneObject = useLiftStore((s) => s.updateSceneObject);
  const removeSceneObject = useLiftStore((s) => s.removeSceneObject);
  const clearSceneObjects = useLiftStore((s) => s.clearSceneObjects);
  const simActive = useSim((s) => s.active);
  const simPose = useSim((s) => s.pose);
  const showVerdict = useSim((s) => s.showVerdict);
  const speed = useSim((s) => s.speed);
  const setSpeed = useSim((s) => s.setSpeed);

  const bothFlags = !!(pickPoint && placePoint);

  /** پخش مجدد آخرین حرکت (بدون سهمیه — فقط انیمیشن همان تحلیل) */
  const handleReplay = () => {
    if (!transfer || !bothFlags) return;
    const st = startTransferSim();
    if (st === "started") {
      toast({ title: "پخش مجدد حرکت", description: "برداشت از A و جایگذاری در B — نتیجه در پایان." });
    }
  };

  const handleScreenshot = () => {
    const shot = captureScene();
    if (shot) {
      setScreenshot3D(shot);
      toast({ title: "اسکرین‌شات صحنه ثبت شد", description: "در گزارش PDF استفاده می‌شود." });
    } else {
      toast({
        title: "صحنه در دسترس نیست",
        description: "کانواس سه‌بعدی رندر نشده است.",
        variant: "destructive",
      });
    }
  };

  const toggles = [
    { key: "exclusion" as const, icon: CircleOff, label: "منطقه ممنوعه (Exclusion Zone)", desc: "دایره قرمز نیمه‌شفاف روی زمین" },
    { key: "forces" as const, icon: MoveUp, label: "خطوط نیرو", desc: "فلش وزن بار و نیروی بالابر" },
    { key: "radiusLine" as const, icon: Compass, label: "خط شعاع کاری", desc: "خط‌چین از محل جرثقیل تا بار" },
    { key: "labels" as const, icon: Tags, label: "برچسب‌ها", desc: "زاویه بوم، شعاع، وزن بار و ارتفاع" },
  ];

  const selectedObject = sceneObjects.find((o) => o.id === view.selectedObjectId) ?? null;

  return (
    <div className="space-y-4">
      {/* ═══ پرچم‌های برداشت و جایگذاری ═══ */}
      <Card className="border-amber-500/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flag className="size-5 text-amber-500" />
            پرچم‌های برداشت و جایگذاری (A / B)
          </CardTitle>
          <CardDescription>
            نقطه برداشت (A) و نقطه جایگذاری (B) را روی زمین صحنه کلیک کنید؛ سپس دکمه واحد
            «تحلیل لیفت / Play» را بزنید تا تحلیل + حرکت کامل جرثقیل + نتیجه، یکجا اجرا شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant={view.flagMode === "pick" ? "default" : "outline"}
              className={`h-12 gap-2 ${
                view.flagMode === "pick" ? "bg-amber-500 text-black hover:bg-amber-400" : ""
              }`}
              onClick={() =>
                view.flagMode === "pick" ? view.clearMode() : view.setFlagMode("pick")
              }
              aria-pressed={view.flagMode === "pick"}
            >
              {view.flagMode === "pick" ? <X className="size-4" /> : <MapPin className="size-4" />}
              {view.flagMode === "pick" ? "لغو — روی زمین کلیک کنید" : "پرچم A — نقطه برداشت"}
            </Button>
            <Button
              variant={view.flagMode === "place" ? "default" : "outline"}
              className={`h-12 gap-2 ${
                view.flagMode === "place"
                  ? "border-2 border-emerald-500 bg-emerald-500 text-black hover:bg-emerald-400"
                  : ""
              }`}
              onClick={() =>
                view.flagMode === "place" ? view.clearMode() : view.setFlagMode("place")
              }
              aria-pressed={view.flagMode === "place"}
            >
              {view.flagMode === "place" ? <X className="size-4" /> : <MapPin className="size-4" />}
              {view.flagMode === "place" ? "لغو — روی زمین کلیک کنید" : "پرچم B — نقطه جایگذاری"}
            </Button>
          </div>

          {/* وضعیت پرچم‌ها */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/40 p-2.5 text-xs">
              <span className="font-bold text-amber-500">پرچم A: </span>
              {pickPoint ? (
                <span dir="ltr">
                  ({pickPoint.x.toFixed(1)}, {pickPoint.z.toFixed(1)}) — R =
                  {Math.hypot(pickPoint.x - (cranePos?.x ?? 0), pickPoint.z - (cranePos?.z ?? 0)).toFixed(1)} m
                </span>
              ) : (
                <span className="text-muted-foreground">ثبت نشده</span>
              )}
            </div>
            <div className="rounded-lg border bg-muted/40 p-2.5 text-xs">
              <span className="font-bold text-emerald-500">پرچم B: </span>
              {placePoint ? (
                <span dir="ltr">
                  ({placePoint.x.toFixed(1)}, {placePoint.z.toFixed(1)}) — R =
                  {Math.hypot(placePoint.x - (cranePos?.x ?? 0), placePoint.z - (cranePos?.z ?? 0)).toFixed(1)} m
                </span>
              ) : (
                <span className="text-muted-foreground">ثبت نشده</span>
              )}
            </div>
          </div>

          {/* ارتفاع برداشت و جایگذاری */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pick-h" className="text-xs">
                ارتفاع بار هنگام برداشت (مثلاً روی تریلی)
              </Label>
              <Input
                id="pick-h"
                type="number"
                dir="ltr"
                className="h-9 text-center"
                min={0}
                max={20}
                step={0.1}
                value={inputs.pickHeightM}
                onChange={(e) => setInputs({ pickHeightM: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="place-h" className="text-xs">
                ارتفاع جایگذاری بار (نقطه B)
              </Label>
              <Input
                id="place-h"
                type="number"
                dir="ltr"
                className="h-9 text-center"
                min={0}
                max={60}
                step={0.1}
                value={inputs.placeHeightM}
                onChange={(e) => setInputs({ placeHeightM: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
          </div>

          {/* کنترل پخش مجدد / توقف */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="lg"
              variant="outline"
              className="h-12 flex-1 gap-2 border-amber-500/50 hover:bg-amber-500/10"
              onClick={handleReplay}
              disabled={simActive || !transfer || !bothFlags}
              title={transfer ? "پخش مجدد آخرین حرکت تحلیل‌شده" : "ابتدا با Play تحلیل و حرکت را اجرا کنید"}
            >
              {simActive ? <Loader2 className="size-5 animate-spin" /> : <RotateCcw className="size-5" />}
              {simActive ? "جرثقیل در حال حرکت..." : "پخش مجدد حرکت A → B"}
            </Button>
            {simActive && (
              <Button size="lg" variant="destructive" className="h-12 gap-2" onClick={stopTransferSim}>
                <Square className="size-4" />
                توقف
              </Button>
            )}
            {(pickPoint || placePoint) && (
              <Button
                size="lg"
                variant="outline"
                className="h-12 gap-2"
                onClick={() => {
                  clearFlags();
                  stopTransferSim();
                }}
              >
                <Trash2 className="size-4" />
                حذف پرچم‌ها
              </Button>
            )}
          </div>

          {/* سرعت پخش + وضعیت زنده */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">سرعت پخش:</span>
              {[1, 2, 4].map((sp) => (
                <Button
                  key={sp}
                  size="sm"
                  variant={speed === sp ? "default" : "outline"}
                  className={`h-7 px-2.5 ${speed === sp ? "bg-amber-500 text-black hover:bg-amber-400" : ""}`}
                  onClick={() => setSpeed(sp)}
                  dir="ltr"
                >
                  ×{sp}
                </Button>
              ))}
            </div>
            {simPose && (
              <div className="text-xs text-muted-foreground" dir="ltr">
                {simPose.phaseLabel} — R {simPose.radiusM.toFixed(1)}m · ∠ Boom
                {simPose.boomDeg.toFixed(0)}° · Hook {simPose.hookTopY.toFixed(1)}m
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <Info className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              شعاع نقطه برداشت (A) نسبت به «محل استقرار جرثقیل» به‌صورت خودکار در مرحله ۳ ثبت می‌شود.
              دکمه واحد Play در پنل سه‌بعدی (یا مرحله ۵) همه کارها را انجام می‌دهد: تحلیل کامل هر دو
              نقطه، حرکت جرثقیل و اعلام «مجاز / غیرمجاز» با ذکر محل مشکل و راهکار اصلاح.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* نتیجه شبیه‌سازی پس از پایان حرکت */}
      {showVerdict && transfer && <TransferVerdictCard transfer={transfer} />}

      {/* ═══ جابه‌جایی جرثقیل ═══ */}
      <Card className="border-amber-500/25">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Move className="size-5 text-amber-500" />
            جابه‌جایی جرثقیل در محوطه
          </CardTitle>
          <CardDescription>
            اگر جرثقیل لازم است جای دیگری بایستد، این حالت را فعال کنید و روی زمین کلیک کنید؛
            شعاع کاری نسبت به محل جدید به‌روزرسانی می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={view.flagMode === "moveCrane" ? "default" : "outline"}
              className={`h-11 gap-2 ${
                view.flagMode === "moveCrane" ? "bg-amber-500 text-black hover:bg-amber-400" : ""
              }`}
              onClick={() =>
                view.flagMode === "moveCrane" ? view.clearMode() : view.setFlagMode("moveCrane")
              }
              aria-pressed={view.flagMode === "moveCrane"}
            >
              {view.flagMode === "moveCrane" ? <X className="size-4" /> : <Move className="size-4" />}
              {view.flagMode === "moveCrane" ? "لغو — روی زمین کلیک کنید" : "انتقال جرثقیل به نقطه دیگر"}
            </Button>
            <Button
              variant="outline"
              className="h-11 gap-2"
              onClick={() => {
                setCranePos(null);
                stopTransferSim();
              }}
              disabled={!cranePos}
            >
              <Crosshair className="size-4" />
              بازگشت به مرکز صحنه
            </Button>
          </div>
          <div className="rounded-lg border bg-muted/40 p-2.5 text-xs">
            <span className="font-bold">محل استقرار فعلی: </span>
            <span dir="ltr">
              {cranePos ? `X = ${cranePos.x.toFixed(1)} m , Z = ${cranePos.z.toFixed(1)} m` : "مرکز صحنه (0, 0)"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ═══ تجهیزات محوطه (نیروگاه / پالایشگاه) ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="size-5 text-amber-500" />
            تجهیزات محوطه — واقعی‌سازی محل لیفت
          </CardTitle>
          <CardDescription>
            فونداسیون، سازه فولادی، برج فرآیندی، مخزن، مبدل، برج خنک‌کن، راک لوله، بویلر، دودکش و
            ... را روی زمین بگذارید تا صحنه شبیه محوطه واقعی نیروگاه/پالایشگاه شود. تجهیزات در
            گزارش PDF هم فهرست می‌شوند.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* پالت تجهیزات */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {SCENE_OBJECT_LIST.map((it) => {
              const active =
                view.flagMode === "object" && view.pendingObjectType === it.type;
              return (
                <button
                  key={it.type}
                  type="button"
                  aria-pressed={active}
                  onClick={() => (active ? view.clearMode() : view.startObjectMode(it.type))}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-start text-xs transition-colors ${
                    active
                      ? "border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "bg-card hover:border-amber-500/40"
                  }`}
                  title={`${it.label} — ابعاد پایه: ${it.w}×${it.d}×${it.h} متر`}
                >
                  <span
                    className="size-4 shrink-0 rounded-sm border border-black/30"
                    style={{ backgroundColor: it.color }}
                    aria-hidden
                  />
                  <span className="line-clamp-2 leading-tight">{it.label}</span>
                </button>
              );
            })}
          </div>

          {view.flagMode === "object" && view.pendingObjectType && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs">
              <span className="flex items-center gap-1.5 font-bold text-amber-500">
                <MapPin className="size-3.5" />
                حالت افزودن فعال: روی زمین کلیک کنید (برای چند تجهیز پشت‌سرهم فعال می‌ماند)
              </span>
              <Button size="sm" variant="outline" className="h-7 gap-1 px-2" onClick={() => view.clearMode()}>
                <X className="size-3" />
                پایان
              </Button>
            </div>
          )}

          {/* فهرست تجهیزات گذاشته‌شده */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">
              تجهیزات صحنه ({sceneObjects.length})
            </span>
            {sceneObjects.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                onClick={clearSceneObjects}
              >
                <Trash2 className="size-3" />
                حذف همه
              </Button>
            )}
          </div>
          {sceneObjects.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
              هنوز تجهیزی اضافه نشده — از پالت بالا انتخاب و روی زمین کلیک کنید.
            </p>
          ) : (
            <div className="max-h-64 space-y-1.5 overflow-y-auto scroll-slim pe-1">
              {sceneObjects.map((o, idx) => {
                const meta = SCENE_OBJECT_LIST.find((x) => x.type === o.type)!;
                const selected = view.selectedObjectId === o.id;
                return (
                  <div
                    key={o.id}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${
                      selected ? "border-amber-500 bg-amber-500/10" : "bg-card"
                    }`}
                  >
                    <span
                      className="size-3.5 shrink-0 rounded-sm border border-black/30"
                      style={{ backgroundColor: meta.color }}
                      aria-hidden
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-start font-medium hover:underline"
                      onClick={() => view.set({ selectedObjectId: selected ? null : o.id })}
                      title="انتخاب در صحنه"
                    >
                      {idx + 1}. {meta.label}
                    </button>
                    <Badge variant="outline" className="shrink-0 tabular-nums" dir="ltr">
                      ({o.x.toFixed(1)}, {o.z.toFixed(1)})
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 p-0"
                      title="چرخش ۴۵ درجه"
                      aria-label={`چرخش ${meta.label}`}
                      onClick={() => updateSceneObject(o.id, { rotDeg: (o.rotDeg + 45) % 360 })}
                    >
                      <RotateCw className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 p-0 text-red-500 hover:text-red-500"
                      title="حذف تجهیز"
                      aria-label={`حذف ${meta.label}`}
                      onClick={() => {
                        removeSceneObject(o.id);
                        if (selected) view.set({ selectedObjectId: null });
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          {selectedObject && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs">
              <Info className="size-3.5 shrink-0 text-amber-500" />
              <span>
                انتخاب‌شده: <b>{SCENE_OBJECT_LIST.find((x) => x.type === selectedObject.type)?.label}</b> —
                چرخش {selectedObject.rotDeg}° • برای حذف، دکمه سطل را بزنید یا تجهیز دیگری را انتخاب کنید.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ کلیدهای نمایش ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Box className="size-5 text-amber-500" />
            تنظیمات نمایش صحنه
          </CardTitle>
          <CardDescription>تغییرات به‌صورت زنده در پنل سه‌بعدی اعمال می‌شود.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {toggles.map(({ key, icon: Icon, label, desc }) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <Icon className={`size-5 ${view[key] ? "text-amber-500" : "text-muted-foreground"}`} />
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
              </div>
              <Switch
                checked={view[key]}
                onCheckedChange={() => view.toggle(key)}
                aria-label={label}
              />
            </div>
          ))}
          <Button variant="outline" className="w-full gap-2" onClick={handleScreenshot}>
            <Camera className="size-4 text-amber-500" />
            ثبت اسکرین‌شات سه‌بعدی برای گزارش
          </Button>
        </CardContent>
      </Card>

      {/* ═══ موقعیت و شرایط نمایشی ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <RotateCw className="size-5 text-amber-500" />
            موقعیت و شرایط
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Compass className="size-4 text-amber-500" />
                زاویه چرخش سوپراستراکچر
              </Label>
              <span className="text-sm font-bold text-amber-500" dir="ltr">
                {inputs.slewAngleDeg}°
              </span>
            </div>
            <Slider
              min={0}
              max={360}
              step={5}
              value={[inputs.slewAngleDeg]}
              onValueChange={([v]) => setInputs({ slewAngleDeg: v })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Mountain className="size-4 text-amber-500" />
                شیب زمین (هم در تحلیل و هم در نمایش)
              </Label>
              <span className="text-sm font-bold" dir="ltr">
                {inputs.groundSlopeDeg.toFixed(1)}°
              </span>
            </div>
            <Slider
              min={0}
              max={3}
              step={0.1}
              value={[inputs.groundSlopeDeg]}
              onValueChange={([v]) => setInputs({ groundSlopeDeg: Number(v.toFixed(1)) })}
            />
            <p className="text-xs text-muted-foreground">
              صحنه با شیب واردشده کج می‌شود؛ در تحلیل، شیب بیش از حد مجاز هشدار می‌دهد.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ═══ مانع صحنه ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CircleOff className="size-5 text-amber-500" />
            مانع احتمالی در محوطه
          </CardTitle>
          <CardDescription>برای شبیه‌سازی ساختمان، دیوار یا تجهیزات مجاور</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">نمایش مانع</span>
            <Switch
              checked={inputs.obstacle.enabled}
              onCheckedChange={(v) => setObstacle({ enabled: v })}
              aria-label="نمایش مانع"
            />
          </div>
          {inputs.obstacle.enabled && (
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["موقعیت X (متر)", "xM", -40, 40],
                  ["موقعیت Z (متر)", "zM", -40, 40],
                  ["ارتفاع (متر)", "heightM", 1, 60],
                  ["عرض (متر)", "widthM", 0.5, 20],
                ] as const
              ).map(([label, key, min, max]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    dir="ltr"
                    className="h-9 text-center"
                    min={min}
                    max={max}
                    step={0.5}
                    value={inputs.obstacle[key]}
                    onChange={(e) =>
                      setObstacle({ [key]: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              ))}
            </div>
          )}
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <Info className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              مانع فقط جنبه بصری دارد؛ برخورد بار با مانع باید توسط سرپرست لیفت به‌صورت
              هندسی کنترل شود. از خط شعاع و برچسب‌ها برای برآورد فاصله استفاده کنید.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
