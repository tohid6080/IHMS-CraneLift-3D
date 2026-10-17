"use client";

/**
 * IHMS CraneLift 3D — کادرِ ورود/ثبت‌نامِ نسخه‌ی آزمایشیِ وب
 * -----------------------------------------------------------
 * فقط در حالتِ وب (غیرِ اندرویدِ نیتیو) رندر می‌شود — نگاه کنید به
 * CraneLiftApp.tsx. مشخصاتِ واردشده فقط برایِ ثبتِ کاربرِ آزمایشی در
 * Supabaseِ IHMS استفاده می‌شود (از طریقِ submitTrialSignup)؛ هیچ داده‌ی
 * برنامه‌ریزیِ لیفتی اینجا جمع‌آوری یا ارسال نمی‌شود.
 */

import { useState, type FormEvent } from "react";
import { Loader2, LogIn, ShieldAlert, Clock, Building2, User, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitTrialSignup, type StoredTrial } from "@/lib/cranelift/trialAuth";

export default function TrialGate({
  expired,
  onSuccess,
}: {
  expired: boolean;
  onSuccess: (trial: StoredTrial) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await submitTrialSignup({ firstName, lastName, mobile, companyName });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSuccess(res.trial);
  };

  if (expired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border-2 border-red-500/40 bg-red-500/10 text-red-500">
          <Clock className="size-8" />
        </div>
        <div>
          <h1 className="text-xl font-black">دوره‌ی آزمایشی رایگان شما به پایان رسید</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            دوره‌ی آزمایشیِ ۱روزه‌ی IHMS CraneLift 3D برای این دستگاه تمام شده است. برای استفاده‌ی
            نامحدود، نسخه‌ی کاملِ اندرویدِ این برنامه از کافه‌بازار قابل‌تهیه است.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-black tracking-tight" dir="ltr">
          IHMS <span className="text-amber-500">CraneLift 3D</span>
        </h1>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          برنامه‌ریزی و تحلیل لیفت جرثقیل — نسخه‌ی آزمایشیِ وب
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border-2 border-border bg-card p-6 shadow-lg"
      >
        <div className="flex items-center gap-2 text-sm font-bold">
          <LogIn className="size-4 text-amber-500" />
          ورود به دوره‌ی آزمایشی رایگان (۱ روزه)
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ct-first-name" className="flex items-center gap-1 text-xs">
            <User className="size-3.5" /> نام
          </Label>
          <Input
            id="ct-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="مثلاً: علی"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ct-last-name" className="flex items-center gap-1 text-xs">
            <User className="size-3.5" /> نام خانوادگی
          </Label>
          <Input
            id="ct-last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="مثلاً: محمدی"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ct-mobile" className="flex items-center gap-1 text-xs">
            <Phone className="size-3.5" /> شماره موبایل
          </Label>
          <Input
            id="ct-mobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="۰۹xxxxxxxxx"
            dir="ltr"
            inputMode="numeric"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ct-company" className="flex items-center gap-1 text-xs">
            <Building2 className="size-3.5" /> نام شرکت
          </Label>
          <Input
            id="ct-company"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="نام شرکت/پیمانکار"
            required
          />
        </div>

        {error && <p className="text-xs font-medium text-red-500">{error}</p>}

        <Button type="submit" disabled={busy} className="w-full gap-1.5 bg-amber-500 text-black hover:bg-amber-400">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          شروع آزمایش رایگان ۱ روزه
        </Button>

        <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            توجه: این نسخه‌ی آزمایشی، اطلاعاتِ پروژه (جرثقیل، لودچارت، ورودی‌ها، نتیجه‌ی تحلیل) را
            روی هیچ سروری ذخیره نمی‌کند — فقط به‌صورتِ موقت در همین مرورگر نگه‌داری می‌شود و با
            بستن یا ترکِ این صفحه برای همیشه پاک خواهد شد.
          </span>
        </div>
      </form>
    </div>
  );
}
