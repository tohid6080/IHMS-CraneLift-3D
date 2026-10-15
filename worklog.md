# Worklog — CraneLift Pro 3D

پروژه: اپلیکیشن حرفه‌ای برنامه‌ریزی و تحلیل لیفت جرثقیل (فارسی، RTL)
استک: Next.js 16 App Router + TypeScript + Tailwind 4 + shadcn/ui + React Three Fiber + Recharts + Zustand + jsPDF/html2canvas + papaparse

---

Task ID: 0
Agent: main coordinator
Task: Project setup + core library

Work Log:
- Installed: three@0.186, @react-three/fiber@9.8, @react-three/drei@10.7, jspdf@4, html2canvas@1.4, papaparse@5 (+ @types)
- Created core library at src/lib/cranelift/: types.ts, cranes.ts (12 real crane models), load-charts.ts (reference load charts), analysis.ts (geometry solver + capacity interpolation + safety checks engine), csv.ts (CSV import/export with validation), capture.ts (3D screenshot ref), store.ts (zustand + persist)

Stage Summary:
- Store: `useLiftStore` — persist key "cranelift-pro-v1", `skipHydration: true` (call `useHydrateLiftStore()` once in app root before rendering UI), partialize excludes screenshot3D/chartImage/hydrated. Actions: setStep/next/prev, setMeta, selectCrane, setCustomChart/resetChart, setInputs/setRigging/setDims/setObstacle, setResult, setScreenshot3D/setChartImage, resetAll.
- Analysis API: `analyzeLift(crane, chart, inputs) → AnalysisResult` | `solveGeometry(crane, inputs) → GeometrySolution` | `lookupCapacity(chart, boomLengthM, radiusM)` | constants `HOOK_BLOCK_HEIGHT_M`, `STATUS_COLORS`, `STATUS_LABELS`.
- Charts: `DEFAULT_LOAD_CHARTS[craneId]`, `getChartFor(craneId, customCharts)` (custom wins), `sortChart(chart)`.
- CSV: `chartToCSV(chart)` / `csvToChart(craneId, text) → {chart, errors, rowCount}` / `sampleCSV()`.
- Capture: `sceneCapture.capture` is registered inside the R3F Canvas; `captureScene()` returns dataURL|null.
- Crane images expected at public/cranes/<crane-id>.jpg (fallback: placeholder.svg).
- Persian font expected at public/fonts/Vazirmatn-{Regular,Medium,SemiBold,Bold}.woff2 (fallback: Tahoma).
- Planned tasks: 3-a (Step2Chart + LoadChartCurve), 3-b (Step3Inputs), 3-c (src/lib/cranelift/pdf.ts), 3-d (images+fonts), 4 (app shell, Step1/4/5/6, 3D scene — coordinator), 5 (integration/lint), 6 (browser E2E verification).

---

Task ID: 3-b
Agent: step3-inputs-agent
Task: Step 3 lift inputs form

Work Log:
- Read worklog.md + cranelift core lib (types/cranes/store/analysis/load-charts) and verified shadcn/ui exports (badge, card, select, slider, radio-group, toast destructive variant).
- Created exactly 1 new file: src/components/cranelift/steps/Step3Inputs.tsx ("use client", default export) — no other file touched, no dev/build/lint run, no installs.
- Live summary strip (Card, flex flex-wrap gap-4): solveGeometry(crane, inputs) memoized; chips for شعاع / زاویه بوم (tower → «تالی روی جیب افقی») / ارتفاع نوک بوم / بار کل; red badge with geo.error when !ok, green «هندسه معتبر» when radius+angle within crane specs, amber badge for out-of-spec-but-solvable geometry.
- Card 1 «بار و متعلقات» (Package): load weight with تن/کیلوگرم toggle (local useState<"t"|"kg">, store always keeps tonnes, kg↔t conversion v/1000, min 0.1 attr, draft-state input), dims 3 inputs → setDims, hook block + rigging weights → setInputs, amber «بار کل» footer badge.
- Card 2 «ریگینگ» (Link2): sling count Select (۲/۴) → setRigging, sling angle Slider 15..90/5 with 1/sin(β) load factor (red >1.41, amber >1.15, green), spreader Switch.
- Card 3 «هندسه بوم و شعاع» (Move3d): RadioGroup radius/angle mode; non-tower: radius input (min/max crane specs, helper shows solved boom angle or "—"), boom angle Slider with solved radius helper, boom length input + snap buttons per chart section via getChartFor(crane.id, customCharts) (active section amber), jib Switch (toast on enable with jibCapacityFactor) + jib length/jib angle controls; tower: amber note + radius input + jib-section snap buttons; requiredHookHeight input both branches.
- Card 4 «محیط و ایمنی» (Wind): wind speed input + km/h helper (red over specs.windLimitMs), gust +۲۰٪ Switch, ground slope Slider 0..3/0.1, safety factor Slider 1..1.5/0.05, slew angle Slider 0..360/5 (3D-only note).
- Card 5 «یادداشت‌های لیفت» (StickyNote, lg:col-span-2): Textarea bound to inputs.notes.
- Empty state when no crane: dashed Card «ابتدا جرثقیل انتخاب کنید» + Button setStep(0).
- Toasts via useToast: one-shot (ref-guarded) destructive toasts for wind over limit and sling factor >1.41; info toast when jib enabled.
- Shared local NumField (draft text state, dir="ltr" + text-center + tabular-nums, min/max/step attrs, Math.max(v,0) write guard) and SliderRow (amber range/thumb via data-slot arbitrary variants) helpers; SliderRow handles slider rounding for 0.1/0.05 steps.

Stage Summary:
- Step3Inputs.tsx is fully store-controlled: every field writes through setInputs/setRigging/setDims, so the 3D scene and analysis re-render live.
- Exported surface for coordinator: `export default Step3Inputs` at src/components/cranelift/steps/Step3Inputs.tsx (expects store hydrated; guards null crane itself).
- Live geometry source: solveGeometry from analysis.ts; chart sections from getChartFor + customCharts (custom charts win) — snap buttons set inputs.boomLengthM (for tower = jib length used by chart lookup).
- All number inputs are type=number dir="ltr" text-center; amber (#f59e0b) accent only (no blue/indigo), red for violations, green for valid; mobile-first responsive grid lg:grid-cols-2 with notes card col-span-2.

---
Task ID: 3-d
Agent: general-purpose (asset download sub-agent)
Task: Crane photos + Vazirmatn fonts download

Work Log:
- NOTE: public/cranes/ existed but was empty (no placeholder.svg present) → created public/cranes/placeholder.svg (simple crane-line-art SVG, 1430B) to serve as the documented fallback source.
- CLI quirk: `z-ai image-search -o <file>` does NOT write the output file (bug) — JSON only goes to stdout. Worked around by capturing stdout and extracting the JSON block (`sed -n '/^{/,$p'`). Also: 4 parallel searches trigger HTTP 429 rate limiting; ran searches in pairs (max 2 concurrent) with retries/backoff — all then succeeded on attempt 1.
- ALL 12 cranes got REAL photos (no placeholder fallback needed): searched (query per spec), took first original_url, curl download, sharp normalize → JPEG (max width 800, white flatten, q82). Verified: valid jpeg format, ≥ 33KB each (threshold 8KB).
  - ltm-1090-4-2.jpg 109KB 800x470 | ltm-1100-5-2.jpg 132KB 800x470 | ltm-1300-6-2.jpg 63KB 800x470
  - gmk5250l.jpg 77KB 800x600 | atf-220g-5.jpg 37KB 800x534 | ac-220-5.jpg 34KB 800x450
  - lr-1300.jpg 116KB 800x536 | manitowoc-16000.jpg 53KB 800x960 | cke2500.jpg 198KB 800x1067
  - scc8300.jpg 53KB 800x800 | 280ec-h.jpg 47KB 800x450 | mdt-389.jpg 198KB 768x1024
- Fonts: all 4 Vazirmatn woff2 (Regular/Medium/SemiBold/Bold) downloaded from jsDelivr gh CDN (rastikerdar/vazirmatn@v33.003) on first try; verified wOF2 magic bytes, 50–51KB each (> 20KB). Tahoma fallback not needed.
- Image source URLs are stable OSS re-hosts (z-cdn.chatglm.cn/image-search-mcp/...). PNG sources (ac-220-5, manitowoc-16000) were converted to JPEG during normalization.

Stage Summary:
- public/cranes/ = 12 × <crane-id>.jpg (real photos, JPEG, width ≤ 800, white-flattened, q82) + placeholder.svg.
- public/fonts/ = Vazirmatn-{Regular,Medium,SemiBold,Bold}.woff2 (v33.003, wOF2 verified).
- Asset contract from Task 0 satisfied: cranes.ts ids ↔ public/cranes/<id>.jpg; @font-face can reference /fonts/Vazirmatn-*.woff2.
---
Task ID: 3-a
Agent: Step2 agent (LoadChartCurve + Step2Chart)
Task: Step 2 load chart viewer/editor + LoadChartCurve

Work Log:
- Read worklog.md + core APIs (types/load-charts/cranes/store/csv/analysis) and verified shadcn ui + @/hooks/use-toast + recharts 2.15.4
- Created src/components/cranelift/LoadChartCurve.tsx: "use client" Recharts LineChart; data = union of all radii (sorted asc) × per-section linear interpolation (out-of-section range → undefined → line breaks); one <Line> per section key s{i}, name «بوم X م», monotone, dot=false, strokeWidth 2 (3.5 for section matching highlight.boomLengthM — only visual use of that prop); amber-first no-blue palette; XAxis/YAxis with Persian inside labels, grid #e5e7eb, RTL legend/tooltip (value «تن», label شعاع), red dashed ReferenceLine x=radiusM «شعاع» / y=grossLoadT «بار»; white LTR wrapper (radius 12, p-2), ResponsiveContainer, default export; null-chart placeholder; NO id="loadchart-curve"
- Created src/components/cranelift/steps/Step2Chart.tsx: "use client" wizard step — empty state (Crane icon unavailable in lucide 0.525 → Truck fallback) with «رفتن به انتخاب جرثقیل» setStep(0); header with Badge سفارشی (bg-amber-500 text-black) / مرجع + 4 outline sm buttons (خروجی CSV Blob download `${crane.id}-loadchart.csv`, ورود CSV via hidden file input, نمونه CSV, بازگشت به مرجع+toast when custom); import → csvToChart → setCustomChart + success toast «... با N ردیف ثبت شد», first-3 errors joined as warning toast, try/catch destructive toast; chart panel wrapped in div#step2-chart-host with highlight {radiusM, grossLoadT = load+hook+rigging, boomLengthM}; boom-section selector buttons (active bg-amber-500 text-black) with selectedBoom state defaulting to section closest to inputs.boomLengthM, useEffect syncs on chart change but preserves still-valid manual selection during editing; points table in max-h-96 overflow-y-auto scroll-slim; edit mode via Switch «ویرایش جدول» — cells become Input type=number dir=ltr h-8 w-24 centered, local draft-string map enables smooth decimal typing, commit on parseable value via DEEP CLONE (structuredClone) + source:"custom" + updatedAt → setCustomChart, round1 + clamp ≥0.1 (>0 invariant), row-delete column «حذف» (guard ≥1 point), edit buttons: افزودن نقطه (lastRadius+2, max(1, lastCap*0.8)) / حذف این بوم (destructive, guard ≥1 section) / افزودن طول بوم (maxBoom+6 with default 0.5/0.25/0.12×maxCapacityT points, auto-selected); bottom Info alert with exact reference-data disclaimer
- Verified with `bunx tsc --noEmit`: zero errors in both new files (only pre-existing analysis.ts TS2739 ×2 remains — owned by task 0, untouched per instructions); did NOT run dev/build/lint, modified no other file

Stage Summary:
- `LoadChartCurve` (default export) is reusable: props {chart: LoadChart|null, highlight?: {radiusM?, grossLoadT?, boomLengthM?}, height?=320} — coordinator's chart-screenshot host must provide its own id (id "loadchart-curve" intentionally NOT used anywhere in these files)
- `Step2Chart` (default export) consumes only store API (selectedCraneId/customCharts/setCustomChart/resetChart/inputs/setStep) — no other wiring needed; first table edit converts a reference chart into a persisted custom chart (source:"custom") so the Badge + «بازگشت به مرجع» button behave correctly
- Editing uses a drafts map keyed `${boom}:${idx}:${field}` to avoid controlled-number-input decimal typing issues; unparseable input ignored until valid/blur
- Caveat 1: shadcn use-toast has no warning variant → CSV validation warnings use default variant with explicit warning title; success uses default variant (destructive only for hard failures)
- Caveat 2: `scroll-slim` class referenced per spec but not yet defined in globals.css (harmless until coordinator adds it)
- Caveat 3: pre-existing type errors in src/lib/cranelift/analysis.ts (solveGeometry early-returns missing GeometrySolution fields) — task 0 owner should fix; unrelated to this task
---
Task ID: 3-c
Agent: pdf-report-agent
Task: PDF report generator (pdf.ts)

Work Log:
- Read worklog.md + core APIs (types.ts: ReportData/AnalysisResult/LoadChart/LiftInputs/Crane/CRANE_TYPE_LABELS; analysis.ts: STATUS_COLORS/STATUS_LABELS shape; cranes.ts: CraneSpecs fields) and verified jspdf@4.2.1 (named `jsPDF` export) + html2canvas@1.4.1 typings in node_modules before coding.
- Created EXACTLY 1 new file: src/lib/cranelift/pdf.ts — no other file touched, no dev/build/lint, no installs.
- Exported API: `downloadPDFReport(data: ReportData): Promise<void>` (multi-page A4 download) and `buildReportDataURL(data: ReportData): Promise<string>` (full-report PNG dataURL for quick previews); both share the private `renderReportCanvas()` (DOM builder → document.body append → `await document.fonts.ready` → html2canvas scale:2/white bg/useCORS/no-logging → element.remove() in finally).
- Dynamic imports INSIDE functions only (SSR-safe module, zero top-level window/document): `const { default: html2canvas } = await import("html2canvas")`, `const { jsPDF } = await import("jspdf")`.
- Hidden report DOM: fixed div left:-20000px, width 794px, white bg, #1c1917 text, Vazirmatn→Tahoma, direction rtl, padding 32px, fontSize 13px, lineHeight 1.9, zIndex -1 — built exclusively with inline HEX styles via helpers el()/richNode()/kv()/h2()/table(centerCols)/kvTable() (html2canvas cannot parse Tailwind oklch or CSS variables).
- Sections: (a) amber #f59e0b header band «گزارش برنامه‌ریزی و تحلیل لیفت جرثقیل» + LTR subtitle + borderless 2-col meta grid (کد پروژه/نام/محل/تاریخ fa-IR/مهندس ناظر/شرکت with «—» fallbacks); (b) final-result banner #16a34a/#ca8a04/#dc2626 (print-tuned, darker than STATUS_COLORS) with status title + white conclusion, amber «تحلیل اجرا نشده است» when result null; (c) crane specs kv table (11 rows incl. jib range «—» for 0-0 tower data); (d) inputs kv table with bold amber #b45309 بار کل, tower boom angle «—», جیب length/angle or «بدون جیب», wind + (تندباد), notes row only if non-empty; (e) images flex row (350×200 objectFit contain, #d4d4d8 border, captions نمای سه‌بعدی/منحنی لودچارت) only when screenshot3D/chartImage exist; (f) analysis results kv (15 rows, null→«—», «خارج از محدوده» for null rated capacity, utilization bold colored >100 red/≥80 amber/else green, hook margin red when <0); (g) checks table [بررسی/مقدار/حد مجاز/وضعیت] with bold colored ✓/⚠/✗ (green/amber/red, html2canvas-safe glyphs); (h) warnings list with level-colored square bullets (#52525b/#ca8a04/#dc2626) or «هشدار خاصی ثبت نشد.»; (i) load-chart section with مرجع(#52525b)/سفارشی(#f59e0b) pill badge + closest-boomLengthM section sorted by radius, ≤16 rows then «...» row, «لودچارتی ثبت نشده» fallback; (j) static 8-item □ safety checklist (exact Persian texts from spec); (k) two 48%×100px dashed #737373 sign boxes (مهندس ناظر / سرپرست لیفت, نام/تاریخ dotted lines); (l) gray disclaimer footer + fa-IR timestamp.
- Pagination: pxPerMm = canvas.width/210, pageHeightPx = floor(297×pxPerMm), per-slice temp canvas (white-filled, drawImage at negative y offset), JPEG 0.92, pdf.addImage(0,0,210,sliceHeightMm), addPage() between slices, setProperties(title/creator), save `CraneLift-Report-${projectId}.pdf`.
- Robustness: both exports wrap the whole body in try/catch and rethrow `Error("خطا در ساخت گزارش PDF: …")`; invalid meta date → «—»; guarded canvas 2D context.
- Verified with `bunx tsc --noEmit --pretty false` (read-only type check, not build/lint): zero errors referencing cranelift/pdf.ts.

Stage Summary:
- Integration point for coordinator: import { downloadPDFReport, buildReportDataURL } from "@/lib/cranelift/pdf"; call downloadPDFReport(store snapshot as ReportData) from the Step 5/6 «دانلود گزارش PDF» click handler (client-side only; shows spinner while awaiting) and optionally buildReportDataURL for an on-screen preview thumbnail.
- ReportData assembly hint: { meta, crane, chart: getChartFor(crane.id, customCharts), inputs, result, screenshot3D: captureScene(), chartImage: <html2canvas of chart host> } — pdf.ts reads only these fields; result=null renders gracefully (amber banner + «—» everywhere + no-checks message).
- All colors are literal HEX inline styles (no oklch/Tailwind/CSS vars) → html2canvas-safe; single tall canvas is sliced vertically so nothing is lost between pages; JPEG q0.92 keeps file size moderate.
- Banner colors intentionally #16a34a/#ca8a04/#dc2626 (spec) rather than analysis.ts STATUS_COLORS for white-text contrast on paper; jib spec row shows «—» when a crane has no jib range (tower models).

---
Task ID: 4
Agent: main coordinator
Task: App shell, 3D scene, Steps 1/4/5/6, page/layout/globals integration

Work Log:
- Fixed TS2739 in analysis.ts solveGeometry error returns (flagged by 3-a)
- Wrote view3d-store.ts (display toggles), run-analysis.ts (analysis + screenshot captures)
- Built three/CraneScene.tsx: mobile/crawler/tower crane models, telescopic boom + jib by input angles, hook/slings/load attached at solved geometry, exclusion zone, dashed radius line, force arrows, obstacle, slope tilt, OrbitControls + CameraRig auto-fit, preserveDrawingBuffer capture
- Replaced drei <Html> labels with custom Sprite+CanvasTexture Label3D (React 19 "synchronously unmount a root" console errors eliminated)
- ScenePanel (dynamic ssr:false, quick stats, big amber Play), Step1Crane (12 cards, real photos, filters, spec table, default-fit on select), Step4Scene (toggles, slew/slope sliders, obstacle, screenshot), Step5Analysis (big Play, status hero, radial gauge, KPIs, checks table, warnings), Step6Report (meta form, captures, preview + downloadPDFReport)
- CraneLiftApp shell: RTL header, 6-step stepper, sticky ScenePanel on steps 3-5, hidden #loadchart-curve host, sticky footer with nav; page.tsx, layout.tsx (fa/rtl + Vazirmatn), globals.css (fonts, slim scrollbars)

Stage Summary:
- Full wizard functional end-to-end; screenshots persisted-excluded by design

---
Task ID: 5
Agent: main coordinator
Task: Integration fixes, lint, tsc

Work Log:
- Replaced mounted-pattern ThemeToggle with dark: CSS classes (react-hooks/set-state-in-effect)
- Step2Chart: removed useEffect sync + manual memoization (derived state instead)
- Switched html2canvas -> html2canvas-pro in run-analysis.ts and pdf.ts (Tailwind 4 oklch/lab "unsupported color function" failure)
- Removed unused eslint-disable directives; fixed tuple typing in Step6Report
- Final: eslint clean, tsc clean (app code)

Stage Summary:
- Root cause of chart-capture failure: html2canvas 1.4 cannot parse oklch/lab (Tailwind 4) — solved with html2canvas-pro

---
Task ID: 6
Agent: main coordinator (agent-browser E2E)
Task: Browser end-to-end verification

Work Log:
- Step1: gallery renders 12 cranes with real photos; selection works (amber ring, toast, defaults fitted)
- Step2: 5-curve load chart with radius/load reference lines, CSV buttons, مرجع badge
- Step3: live geometry chips (radius/angle/tip height/gross) + all cards
- Step4: toggles verified aria-checked, slew/slope sliders, obstacle
- 3D: crane + load + labels + exclusion zone render; camera auto-fit; zero console errors after Sprite-label fix
- Play: LR1300 @10m/48m boom -> allowed 9% (gauge, checks table, KPIs correct: rated 125t, effective 113.6t with SF 1.1)
- Red path: 150t -> not-allowed 133% (red hero, red KPIs) -> restored to 10t allowed
- Step6: PDF preview rendered + real download produced /home/z/Downloads/CraneLift-Report-CLP-MV9TLX9P.pdf (4 pages: header/meta, green result banner, crane+inputs tables, chart image, results, checks ✓, load-chart table, safety checklist, signature boxes)
- Mobile 390px + desktop verified; dark/light themes; footer layout rule respected
- Final console/page errors: 0

Stage Summary:
- App is production-ready and fully browser-verified
