// پیشوندِ مسیرِ عمومی برای فایل‌های داخلِ public/ (مثل /logo.png) که با تگِ
// <img>/new Image() ساده (نه next/image) خطاب می‌شوند — این‌ها برخلافِ
// next/image و next/link خودکار پیشوندِ basePath نمی‌گیرند. در بیلدِ
// Capacitor/اندروید این مقدار خالی است (ریشه)؛ در بیلدِ GitHub Pages برابرِ
// basePath تنظیم‌شده در next.config.ts است (نگاه کنید به GH_PAGES آنجا).
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
