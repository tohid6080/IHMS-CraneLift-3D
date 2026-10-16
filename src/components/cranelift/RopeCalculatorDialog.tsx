"use client";

/**
 * IHMS CraneLift 3D — محاسبه‌گر تناژ سیم بکسل (ابزار جداگانه)
 * -----------------------------------------------------------
 * دو حالت:
 *  ۱) ظرفیت سیم مشخص: قطر + ساختار (6x19/6x36/…) + مغز (کنفی/فولادی) + گرید
 *     → MBL و جدول SWL با ضرایب اطمینان ۵ تا ۸.
 *  ۲) قطر لازم برای بار مشخص: بار کل + تعداد رشته قرقره + ضریب اطمینان
 *     → حداقل قطر استاندارد سیم.
 * نتیجه قابل «اعمال در لیفتینگ پلن» است (MBL سیم به تحلیل و گزارش منتقل می‌شود).
 */

import { useMemo, useState } from "react";
import { Cable, CheckCircle2, Info, RotateCcw } from "lucide-react";
import {
  Button,
} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLiftStore } from "@/lib/cranelift/store";
import { getCraneById } from "@/lib/cranelift/cranes";
import {
  HOIST_SAFETY_FACTOR,
  mblTToKN,
  minDiameterMm,
  ROPE_CONSTRUCTIONS,
  ROPE_CONSTRUCTION_LABELS,
  ropeMBLT,
  ROPE_CORE_LABELS,
  ropeSWLT,
  ropeSpecOf,
  STANDARD_DIAMETERS,
} from "@/lib/cranelift/wire-rope";
import type { RopeConstruction, RopeCore } from "@/lib/cranelift/types";
import { useToast } from "@/hooks/use-toast";

type Mode = "capacity" | "diameter";

export default function RopeCalculatorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const selectedId = useLiftStore((s) => s.selectedCraneId);
  const customCranes = useLiftStore((s) => s.customCranes);
  const inputs = useLiftStore((s) => s.inputs);
  const setInputs = useLiftStore((s) => s.setInputs);
  const crane = getCraneById(selectedId, customCranes);
  const spec = crane ? ropeSpecOf(crane) : null;

  const [mode, setMode] = useState<Mode>("capacity");
  const [diameter, setDiameter] = useState(20);
  const [construction, setConstruction] = useState<RopeConstruction>("6x36");
  const [core, setCore] = useState<RopeCore>("IWRC");
  const [grade, setGrade] = useState<string>("1960");
  const [loadT, setLoadT] = useState(10);
  const [parts, setParts] = useState(4);
  const [sf, setSf] = useState(HOIST_SAFETY_FACTOR);

  const gradeN = Number(grade);

  // ── حالت ۱: ظرفیت سیم انتخابی ──
  const mbl = useMemo(
    () => ropeMBLT(diameter, construction, core, gradeN),
    [diameter, construction, core, gradeN]
  );
  const swlRows = useMemo(
    () => [5, 6, 7, 8].map((k) => ({ sf: k, swl: mbl / k })),
    [mbl]
  );

  // ── حالت ۲: حداقل قطر برای بار مشخص ──
  const calc = useMemo(() => {
    const safeParts = Math.max(1, Math.round(parts));
    const linePull = Math.max(loadT, 0.01) / safeParts;
    const needSWL = linePull * sf;
    const d = minDiameterMm(linePull, construction, core, sf, gradeN);
    const mblFound = d ? ropeMBLT(d, construction, core, gradeN) : null;
    return { linePull, needSWL, d, mblFound, safeParts };
  }, [loadT, parts, sf, construction, core, gradeN]);

  const applyToPlan = (mblT: number, partsToSet?: number) => {
    setInputs({
      ropeOverrideMblT: Math.round(mblT * 100) / 100,
      ...(partsToSet ? { partsOfLine: partsToSet } : {}),
    });
    toast({
      title: "سیم بکسل در لیفتینگ پلن اعمال شد",
      description: `MBL ${mblT.toFixed(1)} تن به تحلیل و گزارش اضافه شد.`,
    });
    onOpenChange(false);
  };

  const resetOverride = () => {
    setInputs({ ropeOverrideMblT: null });
    toast({ title: "بازگشت به سیم بکسل پیش‌فرض جرثقیل" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto scroll-slim sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Cable className="size-5 text-amber-500" />
            محاسبه‌گر تناژ سیم بکسل
          </DialogTitle>
          <DialogDescription>
            محاسبه MBL و ظرفیت کاری سیم بکسل با مغز کنفی یا فولادی — قابل اعمال در لیفتینگ پلن
          </DialogDescription>
        </DialogHeader>

        {/* انتخاب حالت */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={mode === "capacity" ? "default" : "outline"}
            className={mode === "capacity" ? "bg-amber-500 text-black hover:bg-amber-400" : ""}
            onClick={() => setMode("capacity")}
          >
            ظرفیت سیم مشخص
          </Button>
          <Button
            variant={mode === "diameter" ? "default" : "outline"}
            className={mode === "diameter" ? "bg-amber-500 text-black hover:bg-amber-400" : ""}
            onClick={() => setMode("diameter")}
          >
            قطر لازم برای بار
          </Button>
        </div>

        {/* ورودی‌های مشترک */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>ساختار سیم</Label>
            <Select value={construction} onValueChange={(v) => setConstruction(v as RopeConstruction)}>
              <SelectTrigger dir="ltr">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROPE_CONSTRUCTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {ROPE_CONSTRUCTION_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>نوع مغز</Label>
            <Select value={core} onValueChange={(v) => setCore(v as RopeCore)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FC">{ROPE_CORE_LABELS.FC}</SelectItem>
                <SelectItem value="IWRC">{ROPE_CORE_LABELS.IWRC}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>گرید فولاد (MPa)</Label>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger dir="ltr">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1960">1960</SelectItem>
                <SelectItem value="2160">2160</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "capacity" ? (
            <div className="space-y-1.5">
              <Label>قطر سیم (mm)</Label>
              <Select
                value={String(diameter)}
                onValueChange={(v) => setDiameter(Number(v))}
              >
                <SelectTrigger dir="ltr">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64 scroll-slim">
                  {STANDARD_DIAMETERS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} mm
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="rope-load">بار کل (تن)</Label>
                <Input
                  id="rope-load"
                  type="number"
                  dir="ltr"
                  className="text-center"
                  min={0.1}
                  step={0.5}
                  value={loadT}
                  onChange={(e) => setLoadT(Math.max(0.1, Number(e.target.value) || 0.1))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rope-parts">تعداد رشته قرقره</Label>
                <Input
                  id="rope-parts"
                  type="number"
                  dir="ltr"
                  className="text-center"
                  min={1}
                  max={16}
                  value={parts}
                  onChange={(e) => setParts(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rope-sf">ضریب اطمینان</Label>
                <Select value={String(sf)} onValueChange={(v) => setSf(Number(v))}>
                  <SelectTrigger dir="ltr">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 6, 7, 8].map((k) => (
                      <SelectItem key={k} value={String(k)}>
                        {k} : 1
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        {/* ── نتیجه حالت ۱ ── */}
        {mode === "capacity" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border bg-muted/40 p-3 text-center">
                <div className="text-xs text-muted-foreground">حداقل نیروی گسیختگی (MBL)</div>
                <div className="mt-1 text-xl font-black text-amber-500" dir="ltr">
                  {mbl.toFixed(1)} t
                </div>
                <div className="text-xs text-muted-foreground" dir="ltr">
                  ≈ {mblTToKN(mbl).toFixed(0)} kN
                </div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-center">
                <div className="text-xs text-muted-foreground">ظرفیت کاری با ضریب ۵</div>
                <div className="mt-1 text-xl font-black text-green-500" dir="ltr">
                  {(mbl / 5).toFixed(2)} t
                </div>
                <div className="text-xs text-muted-foreground">SWL = MBL ÷ ۵</div>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-center text-sm">
                <thead className="bg-muted/60 text-xs">
                  <tr>
                    <th className="py-2">ضریب اطمینان</th>
                    <th className="py-2">ظرفیت کاری (SWL)</th>
                    <th className="py-2">کاربرد</th>
                  </tr>
                </thead>
                <tbody>
                  {swlRows.map((r) => (
                    <tr key={r.sf} className="border-t">
                      <td className="py-1.5" dir="ltr">
                        {r.sf} : 1
                      </td>
                      <td className="py-1.5 font-bold" dir="ltr">
                        {r.swl.toFixed(2)} t
                      </td>
                      <td className="py-1.5 text-xs text-muted-foreground">
                        {r.sf === 5 ? "بالابر جرثقیل (استاندارد)" : "بلوک‌های ایستایی / عمومی"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              className="w-full gap-2 bg-amber-500 text-black hover:bg-amber-400"
              onClick={() => applyToPlan(mbl)}
              disabled={!crane}
            >
              <CheckCircle2 className="size-4" />
              اعمال این سیم در لیفتینگ پلن (MBL {mbl.toFixed(1)} تن)
            </Button>
          </div>
        )}

        {/* ── نتیجه حالت ۲ ── */}
        {mode === "diameter" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">کشش هر رشته</div>
                <div className="mt-1 text-lg font-black" dir="ltr">
                  {calc.linePull.toFixed(2)} t
                </div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">SWL لازم (×{sf})</div>
                <div className="mt-1 text-lg font-black" dir="ltr">
                  {calc.needSWL.toFixed(2)} t
                </div>
              </div>
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <div className="text-xs text-muted-foreground">حداقل قطر لازم</div>
                <div className="mt-1 text-lg font-black text-amber-500" dir="ltr">
                  {calc.d ? `${calc.d} mm` : "—"}
                </div>
              </div>
            </div>
            {calc.d && calc.mblFound ? (
              <div className="flex items-start gap-2 rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                <Info className="mt-0.5 size-4 shrink-0 text-green-500" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  سیم <span dir="ltr">{calc.d}mm</span> {ROPE_CONSTRUCTION_LABELS[construction]} با{" "}
                  {ROPE_CORE_LABELS[core]} و گرید <span dir="ltr">{gradeN}</span> دارای MBL{" "}
                  <span dir="ltr">{calc.mblFound.toFixed(1)} تن</span> است و با ضریب{" "}
                  <span dir="ltr">{sf}:1</span> تا{" "}
                  <span dir="ltr">{(calc.mblFound / sf).toFixed(2)} تن</span> در هر رشته بار مجاز است.
                </p>
              </div>
            ) : (
              <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-500">
                با این ساختار/مغز، حتی قطورترین سیم استاندارد (52mm) پاسخگو نیست — تعداد رشته‌ها
                را بیشتر کنید.
              </p>
            )}
            <Button
              className="w-full gap-2 bg-amber-500 text-black hover:bg-amber-400"
              disabled={!calc.d || !calc.mblFound || !crane}
              onClick={() => calc.mblFound && applyToPlan(calc.mblFound, calc.safeParts)}
            >
              <CheckCircle2 className="size-4" />
              اعمال در لیفتینگ پلن ({calc.d ? `${calc.d}mm` : "—"} × {calc.safeParts} رشته)
            </Button>
          </div>
        )}

        {/* وضعیت سیم فعلی پلن */}
        {spec && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
            <div className="text-xs leading-relaxed text-muted-foreground">
              سیم فعال پلن:{" "}
              {inputs.ropeOverrideMblT ? (
                <Badge className="bg-amber-500 text-black">از محاسبه‌گر — MBL {inputs.ropeOverrideMblT.toFixed(1)} تن</Badge>
              ) : (
                <Badge variant="outline">
                  پیش‌فرض جرثقیل — <span dir="ltr">{spec.diameterMm}mm</span> / MBL{" "}
                  <span dir="ltr">{spec.mblT.toFixed(1)}t</span>
                </Badge>
              )}
              {" "}— حداکثر رشته: <span dir="ltr">{spec.maxPartsOfLine}</span>
            </div>
            {inputs.ropeOverrideMblT && (
              <Button size="sm" variant="outline" className="gap-1" onClick={resetOverride}>
                <RotateCcw className="size-3.5" />
                بازگشت به پیش‌فرض
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
