"use client";

/**
 * CraneLift Pro 3D — مرحله ۴: تنظیمات صحنه سه‌بعدی
 * -----------------------------------------------------------
 * کلیدهای نمایش (منطقه ممنوعه، خطوط نیرو، خط شعاع، برچسب‌ها)،
 * زاویه چرخش سوپراستراکچر، شیب نمایشی زمین و مانع صحنه.
 * تغییرات به‌صورت زنده در کانواس سه‌بعدی (پنل کناری) اعمال می‌شود.
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useLiftStore } from "@/lib/cranelift/store";
import { useView3D } from "../three/view3d-store";
import { captureScene } from "@/lib/cranelift/capture";
import { useToast } from "@/hooks/use-toast";

export default function Step4Scene() {
  const { toast } = useToast();
  const view = useView3D();
  const inputs = useLiftStore((s) => s.inputs);
  const setInputs = useLiftStore((s) => s.setInputs);
  const setObstacle = useLiftStore((s) => s.setObstacle);
  const setScreenshot3D = useLiftStore((s) => s.setScreenshot3D);

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
    { key: "radiusLine" as const, icon: Compass, label: "خط شعاع کاری", desc: "خط‌چین از مرکز دوران تا بار" },
    { key: "labels" as const, icon: Tags, label: "برچسب‌ها", desc: "شعاع، وزن بار و ارتفاع" },
  ];

  return (
    <div className="space-y-4">
      {/* کلیدهای نمایش */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Box className="size-5 text-amber-500" />
            تنظیمات نمایش صحنه
          </CardTitle>
          <CardDescription>
            تغییرات به‌صورت زنده در پنل سه‌بعدی اعمال می‌شود.
          </CardDescription>
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

      {/* موقعیت و شرایط نمایشی */}
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

      {/* مانع صحنه */}
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
