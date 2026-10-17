/**
 * IHMS CraneLift 3D — ورود/ثبت‌نام آزمایشیِ نسخه‌ی وب (کادر ورودِ صفحه‌ی
 * public/cranelift در IHMS)
 * -----------------------------------------------------------
 * فقط برای کاربرانِ وب (غیرِ اندروید/Capacitor) نمایش داده می‌شود؛ خریدِ
 * واقعی (Poolakey/کافه‌بازار) مسیرِ کاملاً مجزاست و اینجا دخالتی ندارد.
 *
 * ثبت‌نام از طریقِ Edge Function عمومیِ submit-cranelift-trial-signup در
 * همان پروژه‌ی Supabaseِ IHMS انجام می‌شود — فقط مشخصاتِ کاربر (نام،
 * نام‌خانوادگی، موبایل، نامِ شرکت) آن‌جا ثبت می‌شود؛ هیچ داده‌ی مربوط به
 * برنامه‌ریزیِ لیفت (جرثقیل/لودچارت/نتیجه‌ی تحلیل و...) هرگز به سمتِ سرور
 * ارسال نمی‌شود — آن بخش کاملاً آفلاین و محلی می‌ماند (نگاه کنید به
 * ./store.ts: در حالتِ وب از sessionStorage استفاده می‌کند، نه
 * localStorage، تا با بستنِ تب پاک شود).
 *
 * وضعیتِ خودِ آزمایش (trialExpiresAt) در localStorage نگه‌داری می‌شود —
 * این یکی عمداً پایدار است، چون هدف این است که کاربر در طولِ همان ۱ روز،
 * با بستن و بازکردنِ دوباره‌ی تب، مجبور به ثبت‌نامِ دوباره نشود.
 */

const SUPABASE_URL = "https://zmmxiyqlwkqjzghbcydi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_pvobGcp2snOD3oFTX2LVMg_bZx2A9CR";

const TRIAL_STORAGE_KEY = "cranelift-trial-session-v1";
const MOBILE_RE = /^09\d{9}$/;

export interface TrialSignupFields {
  firstName: string;
  lastName: string;
  mobile: string;
  companyName: string;
}

export interface StoredTrial extends TrialSignupFields {
  trialExpiresAt: string;
}

function readStoredTrial(): StoredTrial | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TRIAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.trialExpiresAt) return null;
    return parsed as StoredTrial;
  } catch {
    return null;
  }
}

function writeStoredTrial(trial: StoredTrial): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(trial));
  } catch {
    // localStorage غیرقابل‌دسترس (حالت خصوصی و...) — نادیده گرفته می‌شود؛
    // کادرِ ورود در بازدیدِ بعدی دوباره نمایش داده می‌شود.
  }
}

export function clearStoredTrial(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TRIAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getStoredTrial(): StoredTrial | null {
  return readStoredTrial();
}

export function isTrialActive(trial: StoredTrial | null): boolean {
  if (!trial?.trialExpiresAt) return false;
  return new Date(trial.trialExpiresAt).getTime() > Date.now();
}

export type TrialSignupResult =
  | { ok: true; trial: StoredTrial; alreadyRegistered: boolean }
  | { ok: false; error: string };

function validateFields(fields: TrialSignupFields): string | null {
  if (!fields.firstName.trim() || !fields.lastName.trim()) return "نام و نام‌خانوادگی را وارد کنید.";
  if (!MOBILE_RE.test(fields.mobile.trim())) return "شماره موبایل را به‌صورت صحیح (مثل ۰۹۱۲xxxxxxx) وارد کنید.";
  if (!fields.companyName.trim()) return "نام شرکت را وارد کنید.";
  return null;
}

export async function submitTrialSignup(fields: TrialSignupFields): Promise<TrialSignupResult> {
  const validationError = validateFields(fields);
  if (validationError) return { ok: false, error: validationError };

  const payload = {
    firstName: fields.firstName.trim(),
    lastName: fields.lastName.trim(),
    mobile: fields.mobile.trim(),
    companyName: fields.companyName.trim(),
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-cranelift-trial-signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data?.trialExpiresAt) {
      return { ok: false, error: data?.error || "ثبتِ دوره‌ی آزمایشی انجام نشد. دوباره تلاش کنید." };
    }
    const trial: StoredTrial = { ...payload, trialExpiresAt: data.trialExpiresAt };
    writeStoredTrial(trial);
    return { ok: true, trial, alreadyRegistered: data.alreadyRegistered === true };
  } catch {
    return { ok: false, error: "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید." };
  }
}
