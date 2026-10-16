# اتصال خرید درون‌برنامه‌ای کافه‌بازار (Poolakey) — راهنمای فاز ۲

این پوشه فقط **اسکفولد/پیش‌نویس** است و هنوز به خطِ ساختِ CI (`.github/workflows/build-android.yml`)
متصل نشده — چون اتصالِ واقعی به دو چیز نیاز دارد که فقط خودتان می‌توانید
تهیه کنید:

1. **حسابِ توسعه‌دهنده در کافه‌بازار** (developers.cafebazaar.ir) + ثبتِ اپ.
2. **کلیدِ RSAِ عمومیِ اپ** از تنظیماتِ همان اپ در پنلِ بازار.
3. تعریفِ یک **محصولِ درون‌برنامه‌ای** (In-app Product) برای «نسخه‌ی حرفه‌ای»
   و گرفتنِ شناسه‌ی آن (مثلاً `cranelift_pro_lifetime`).

بدونِ این سه مورد، کدِ این پوشه قابلِ‌تکمیل/تست نیست — به همین دلیل فعلاً
خطِ CI فقط یک APK ساده (بدونِ خرید) می‌سازد تا خودِ اپ همین امروز قابلِ‌نصب
و تست باشد.

## وضعیت فعلی

`BazaarBillingPlugin.kt` دستی نوشته شده، بر اساسِ API عمومیِ شناخته‌شده‌ی
Poolakey، ولی **در این محیط کامپایل/تست نشده** (نه Android SDK این‌جا هست، نه
دستگاهِ واقعی). پیش از انتشارِ نهایی حتماً باید:

- یک‌بار `npx cap add android` اجرا شود،
- مراحلِ زیر دستی/با اسکریپت انجام شوند،
- روی یک دستگاهِ اندرویدِ واقعی با اپِ کافه‌بازار نصب‌شده، کاملاً تست شود
  (خرید، لغوِ خرید، بازگشتِ به اپ بعدِ کشتنِ پراسس، و غیره).

## مراحلِ اتصال (بعد از `npx cap add android`)

### ۱. فعال‌سازیِ Kotlin در پروژه‌ی اندروید

پروژه‌ی اندرویدِ تولیدشده توسطِ Capacitor به‌صورتِ پیش‌فرض فقط جاوا دارد.
به `android/build.gradle` (سطحِ پروژه) اضافه کنید:

```gradle
buildscript {
    ext.kotlin_version = '1.9.24'
    dependencies {
        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
    }
}
```

و به ابتدای `android/app/build.gradle`:

```gradle
apply plugin: 'kotlin-android'
```

### ۲. افزودنِ وابستگیِ Poolakey

به `android/app/build.gradle`، بخشِ `dependencies`:

```gradle
implementation "org.jetbrains.kotlin:kotlin-stdlib:$kotlin_version"
implementation "ir.cafebazaar.poolakey:poolakey:1.6.0" // نسخه‌ی دقیق را از صفحه‌ی رسمیِ Poolakey چک کنید
```

(مخزنِ Maven معمولاً `mavenCentral()` یا `jcenter()` — طبقِ مستنداتِ رسمیِ
نسخه‌ای که استفاده می‌کنید چک شود؛ ممکن است به افزودنِ یک repository خاص
در `android/build.gradle` نیاز باشد.)

### ۳. کپی کردنِ پلاگین

فایلِ `BazaarBillingPlugin.kt` همین پوشه را به مسیرِ زیر کپی کنید:

```
android/app/src/main/java/com/ihms/cranelift3d/BazaarBillingPlugin.kt
```

(پکیج‌نیم باید با `appId` در `capacitor.config.json` یکی باشد: `com.ihms.cranelift3d`)

### ۴. پر کردنِ کلید و شناسه‌ی محصول

داخلِ خودِ `BazaarBillingPlugin.kt`:

```kotlin
private val rsaPublicKey: String = "BAZAAR_RSA_PUBLIC_KEY_PLACEHOLDER" // ← از پنلِ بازار
private val productIdPro: String = "cranelift_pro_lifetime"            // ← شناسه‌ی محصولِ شما
```

⚠️ کلیدِ RSA را به‌صورتِ Hardcode در سورس نگه‌داشتن رایج و قابل‌قبول است
(خودِ Poolakey همین الگو را پیشنهاد می‌دهد — این کلید برای تأییدِ **امضای
پاسخِ بازار** است، نه یک رمزِ محرمانه‌ی سمتِ سرور)، اما بهتر است به‌جای
Hardcode مستقیم، از یک GitHub Secret و تزریق در زمانِ build استفاده شود
(مشابهِ الگوی keystore در build-android.yml) تا کلید در دیدِ مستقیمِ هر کسی
که سورس را می‌بیند نباشد.

### ۵. ثبتِ پلاگین در MainActivity

Capacitor به‌صورتِ خودکار پلاگین‌های محلی (غیر-npm) را رجیستر نمی‌کند — باید
دستی در `android/app/src/main/java/com/ihms/cranelift3d/MainActivity.java`
اضافه شود:

```java
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(android.os.Bundle savedInstanceState) {
    registerPlugin(BazaarBillingPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
```

### ۶. تأییدِ سمتِ سرور (توصیه‌شده، نه اجباری برای شروع)

`queryPurchases()`/`purchasePro()` همان‌طور که نوشته شده‌اند، به پاسخِ محلیِ
Poolakey (که خودش امضای بازار را با `rsaPublicKey` چک می‌کند) اعتماد
می‌کنند. این سطح از امنیت برایِ شروع معقول و رایج است (بسیاری از اپ‌های
بازار دقیقاً همین را انجام می‌دهند)، ولی نه غیرقابل‌دور زدن (یک کاربرِ
مصمم با APKِ patch‌شده می‌تواند آن را دور بزند). برای سخت‌گیری‌ترین حالت،
`purchaseToken` را می‌توان (مشابهِ الگوی Edge Functionِ IHMS) به یک تابعِ
سمتِ سرور فرستاد که آن را در برابرِ API رسمیِ تأییدِ خریدِ کافه‌بازار
صحه‌گذاری می‌کند — این کار در فازِ بعدی و در صورتِ نیاز اضافه می‌شود.

## افزودنِ این مراحل به GitHub Actions

وقتی مواردِ بالا را (حسابِ بازار + کلید RSA + SKU) آماده کردید، به من
بگویید تا این مراحل را به‌صورتِ خودکار به `build-android.yml` اضافه کنم
(دقیقاً مشابهِ الگوی تزریقِ debug.keystore که همین‌جا هست) — به‌جای این‌که
هر بار دستی تکرار شوند.
