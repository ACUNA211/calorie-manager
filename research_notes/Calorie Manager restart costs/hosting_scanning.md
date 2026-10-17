# Hosting, database, auth, scheduling, push, barcode scanning and app-store costs for a 2–4 user household app (October 2026)

**How this was checked (read first):** Research date 2026-10-17. In this session WebFetch and curl could not reach any vendor page: DNS failed, and the egress proxy refused `supabase.com` ("connect_rejected", 403). So every figure below comes from **web-search result summaries**. Those summaries quote official pages in some cases and only third-party blogs in others, and each bullet says which. Where Sept 2026 project research (`.scratch/mvp/research/running-cost.md`, `stack-options.md`, checked 2026-09-29/30 against official pages) agrees with this session's search results, the figure is marked **"re-confirmed"**. Where only a third-party source supports a figure, it is marked **(third-party)**. A figure with no source this session is marked **unverified**.

**Project context:**
- ADR 0001 (2026-10-10) replaced the built app with a Claude artifact plus Claude chat. A restart that builds a real multi-user app reverses that ADR.
- The existing Supabase schema (`supabase/migrations/001_core_schema.sql`) is **single-member**. `member_settings` is a one-row table (`check (id = 1)`). RLS is enabled on every table but has **zero policies** (`grep "create policy"` returns 0), because only the service-role connector reads and writes.
- A household with 2–4 logins therefore needs three new pieces: a `households` table and a `household_members` table, a `household_id` on the pantry, plan and recipe tables (with a `user_id` on the per-person calorie log and settings), and RLS policies.

## 1. Supabase Free vs Pro for a 2–4 user household

### Takeaway
Supabase Free ($0) covers a 2–4 user household on every quota by orders of magnitude. Its real weaknesses are pausing after 1 week of inactivity and having no backups. Pro is $25/month per organization and includes $10 of compute credit, which covers one Micro project. That makes Pro the "robust" choice. pg_cron and RLS are included on both plans, and household sharing is a standard RLS membership pattern.

### Cited Findings
- **Free plan limits:** 500 MB database, 50,000 MAU, 5 GB egress, 2 active projects, pauses after 1 week of inactivity (re-confirmed; official page in Sept research). — [Supabase pricing](https://supabase.com/pricing); this session: [jetadmin 2026 guide](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/), [makerkit](https://makerkit.dev/blog/saas/supabase-pricing) (third-party)
- **Free file storage:** 1 GB per most sources, 500 MB per one source (conflict). — [focusreactive](https://focusreactive.com/blog/supabase-price/) (1 GB); contradicted by [makerkit md](https://makerkit.dev/blog/md/saas/supabase-pricing) (500 MB) (third-party)
- **Edge Functions:** 500,000 invocations/month on Free, 2M on Pro, $2 per million over (third-party, majority). One 2025 guide gives 1,000/day, which is probably outdated. — [toolradar 2026](https://toolradar.com/blog/supabase-pricing-2026), [cloudzero](https://www.cloudzero.com/blog/supabase-pricing/)
- **Edge Function limits:** 2 s CPU per request and 150 s wall clock on Free; 400 s wall clock on paid (Sept research, official). — [Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits)
- **Pro plan:** $25/month per organization. It includes 8 GB database (then $0.125/GB), 100,000 MAU, 250 GB egress (then $0.09/GB), 100 GB storage, and a $10 compute credit covering one Micro instance. Spend cap is on by default. Pro has daily backups kept 7 days and is never paused (re-confirmed). — [Supabase pricing](https://supabase.com/pricing); this session: [jetadmin](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/), [focusreactive](https://focusreactive.com/blog/supabase-price/)
- **Second project on Pro:** each extra project in a Pro organization is billed its own compute, about $10/month for Micro. So a `dev` plus `prod` pair on Pro costs about $35/month (Sept research, official). — [Supabase compute](https://supabase.com/docs/guides/platform/manage-your-usage/compute)
- **Team plan:** $599/month, irrelevant here (third-party). — [jetadmin review, 2026-09-30](https://www.jetadmin.io/blog/supabase-review/)
- **Pausing rule:** Supabase's docs say "A Free plan project is considered inactive if it does not receive sufficient user database activity over the past week… Typically a few user requests to the database each day over the previous week is enough". A warning email comes about 1 week before the pause (Sept research, official). — [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- **Does pg_cron count as activity?** A non-staff GitHub discussion reply says writes count, a connection that does nothing doesn't, and pg_cron counts. This is **unverified** against official docs. — [GitHub discussion #13121](https://github.com/orgs/supabase/discussions/13121); keep-alive workarounds: [levelup article](https://levelup.gitconnected.com/supabase-free-tier-will-pause-your-app-heres-the-github-actions-fix-8c1fd35b49ca) (third-party)
- **pg_cron:** it is "a Postgres Module" that runs "from every second to once a year" and can POST to an Edge Function or any URL through `pg_net`. Run history in `cron.job_run_details` is "not cleaned up automatically" (Sept research, official). — [Supabase Cron](https://supabase.com/docs/guides/cron), [Cron quickstart](https://supabase.com/docs/guides/cron/quickstart)
- **pg_cron and time zones:** jobs fire on a fixed clock (UTC). Per-user local-time reminders therefore need one per-minute job that reads a schedules table (Sept research). — [Cron quickstart](https://supabase.com/docs/guides/cron/quickstart)
- **Realtime on Free:** 2M messages and 200 peak connections; Pro has 5M and 500 (Sept research, official). — [Supabase pricing](https://supabase.com/pricing)
- **RLS roles:** every request maps to `anon` or `authenticated`, and policies scope these with `TO`. — [Supabase AI prompt: RLS policies](https://supabase.com/docs/guides/ai-tools/ai-prompts/database-rls-policies)
- **RLS membership pattern:** a `team_id in (select … where auth.uid() = user_id)` policy can error or recurse. A `SECURITY DEFINER` helper that returns the caller's team IDs avoids this, and that helper should live in a non-exposed (private) schema. — [GitHub discussion #4509](https://github.com/orgs/supabase/discussions/4509), [makerkit RLS best practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) (third-party)
- **RLS performance:** wrapping as `(select auth.uid())` means it is evaluated once, not per row. — [makerkit RLS best practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) (third-party)

### Inferences
- **Usage at this scale:** 2–4 users is about 0.008% of the 50,000 MAU limit. Data at roughly 35 MB per user per year (Sept estimate) means 4 users take several years to reach 500 MB, provided the pg_cron history is purged.
- **Household RLS design:** a `households` table, a `household_members(household_id, user_id)` table, and a `private.my_household_ids()` SECURITY DEFINER function. Shared pantry, plan and recipe tables then use a policy like `household_id in (select private.my_household_ids())`, and per-person rows (calorie log, targets) add `user_id = (select auth.uid())`.
- **Schema change:** the current single-row `member_settings` becomes per-user. Leave the service-role connector in place for Claude's skills; it bypasses RLS.
- **Pausing risk:** a household with daily use and a per-minute pg_cron job that writes rows is very unlikely to pause. The pause rule and the no-backup gap are still the main reasons to pay $25.

### Gaps
- The official pricing page could not be opened this session, so a price change in October 2026 cannot be ruled out. The figures match the Sept 30 official check.
- No official statement on whether pg_cron alone prevents pausing.
- Whether a Free `dev` project can stay in a separate free organization after `prod` moves to Pro is **unverified**.

## 2. Hosting: Vercel, Cloudflare, Firebase, Netlify, Render, Fly.io

### Takeaway
For a private household app, Vercel Hobby and Cloudflare Workers/Pages Free both cost $0.
- **Vercel Hobby:** only "non-commercial, personal use", and its cron runs once a day at most. Use Supabase pg_cron for the schedule.
- **Cloudflare Workers Free:** 10 ms CPU per request. Workers Paid is $5/month and is the cheapest commercial-OK upgrade.
- **Firebase:** Cloud Functions need the Blaze plan (card on file), but FCM is free.
- **Netlify Free:** hard-capped credits.
- **Render Free:** sleeps after 15 minutes.
- **Fly.io:** no free tier for new accounts.

### Cited Findings
**Vercel**
- **Hobby use rule:** "the Hobby plan restricts users to non-commercial, personal use only". Pro is $20 per user per month (re-confirmed). — [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- **Vercel cron (page updated 2026-01-28):** 100 cron jobs per project on Hobby, at most once a day, with ±59 min precision. Expressions that run more often "will fail during deployment". Pro allows once a minute. — [Vercel cron usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- **Hobby allowances:** 1M function invocations, 4 active-CPU hours, 360 GB-hours memory, 300 s max duration, 100 GB transfer. Over a limit, the feature is blocked for up to 30 days rather than billed (Sept research, official). — [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Vercel functions pricing](https://vercel.com/docs/functions/usage-and-pricing)

**Cloudflare**
- **Workers Free:** 100,000 requests/day, 10 ms CPU per HTTP request, 5 Cron Triggers per account, 10 ms CPU per cron run, 50 subrequests. — [Workers limits](https://developers.cloudflare.com/workers/platform/limits)
- **Workers Paid:** $5/month. It includes 10M requests/month ($0.30 per extra million) and 30M CPU-ms ($0.02 per extra million). CPU is 30 s by default per request and up to 5 min. Limits are 250 Cron Triggers, 30 s CPU per cron for intervals under 1 hour, and 10,000 subrequests. — [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits)
- **D1 Free:** 5M rows read/day, 100K rows written/day, 5 GB storage. Queries fail at the cap until 00:00 UTC. — [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- **D1 on Workers Paid:** 25B rows read and 50M rows written per month. Overage is $0.001 per million reads, $1.00 per million writes, and $0.75/GB-month storage. "Rows read" counts scanned rows. — [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- **Agents SDK `schedule()`:** uses Durable Object alarms, so each user can have exact-time wakeups (Sept research). — [Agents SDK schedule](https://developers.cloudflare.com/agents/api-reference/schedule-tasks/)
- **Auth on Cloudflare:** no built-in auth (Sept research; Cloudflare auth options **unverified**). — [stack-options.md, Sept 2026](https://developers.cloudflare.com/workers/platform/pricing/)

**Firebase**
- **Plans and FCM:** Cloud Messaging is no-cost on any plan. — [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- **Deploying functions:** Cloud Functions require Blaze (pay-as-you-go) to deploy (Sept research, official). One third-party summary claims Spark includes a functions quota (conflict). — [Firebase Functions get started](https://firebase.google.com/docs/functions/get-started); contradicted by [supertokens](https://supertokens.com/blog/firebase-pricing) (third-party)
- **Scheduled functions:** they run on Cloud Scheduler, so they need Blaze. — [Firebase schedule functions](https://firebase.google.cn/docs/functions/schedule-functions?hl=en), [crontap](https://crontap.com/blog/firebase-scheduled-functions-without-blaze) (third-party)
- **Cloud Scheduler price (official):** 3 free jobs per **billing account** (not per project), then $0.10 per job per 31 days. Executions are not billed, and a paused job still counts. — [Cloud Scheduler pricing](https://cloud.google.com/scheduler/pricing?hl=pt-BR)
- **Firestore Standard free quota (official):** 50,000 reads and 20,000 writes per day; 20K deletes/day and 1 GiB storage. — [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- **Cloud Functions free quota:** 2M invocations/month. Whether the Blaze free tier is the same as Spark's is not stated outright. — [Firebase pricing (ko)](https://firebase.google.com/pricing/?hl=ko), [DEV guide](https://dev.to/androve2k/spark-vs-blaze-the-firebase-pricing-guide-i-wish-id-read-sooner-onb) (third-party)
- **Firebase Auth:** email, social and anonymous sign-in are free to 50,000 MAU on both plans. Phone/SMS is billed per message (about $0.01 per verification in the US) and needs billing enabled. Tiered pricing above 50K MAU starts at $0.0055/MAU. — [rapidnative 2026](https://www.rapidnative.com/blogs/firebase-authentication-pricing), [logto](https://blog.logto.io/it/firebase-authentication-pricing), [supertokens](https://supertokens.com/blog/firebase-pricing) (all third-party)
- **Firestore offline:** offline persistence and write queue are built in (Sept research, official). — [Firestore offline](https://firebase.google.com/docs/firestore/manage-data/enable-offline)

**Others**
- **Netlify Free:** 300 credits/month, a hard limit; when they run out, all sites on the team pause. Production deploys cost 15 credits each. Bandwidth costs 20 credits/GB per one source and 10 per another (conflict). Personal plan $9/month, Pro $20/month. — [netli.fyi 2026](https://netli.fyi/blog/netlify-free-plan-limits-2026), [supadrop](https://supadrop.host/blog/netlify-pricing-free-tier-limits/) (third-party)
- **Render Free:** web services spin down after 15 minutes idle (cut from 30 min on 2025-09-01), with 30–60 s cold starts. Paid starts at $7/month for 512 MB. — [temps.sh Render 2026](https://temps.sh/blog/render-pricing-2026), [Render article](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026.md)
- **Fly.io:** pay-as-you-go with no free tier for new accounts; legacy accounts keep 3 small VMs. A shared-cpu-1x 256 MB machine is about $2.02/month running 24/7. One source disagrees on the free tier. — [costbench Render vs Fly](https://costbench.com/compare/render-vs-fly-io/), [solodevstack](https://solodevstack.com/blog/render-vs-flyio-solo-developers) (third-party)

### Inferences
- **Hobby and a family app:** a private household app for the developer's own family fits Vercel's "personal use" wording. Selling it or charging other households does not, and needs Vercel Pro ($20/seat) or a switch to Cloudflare Workers Paid ($5).
- **Vercel's cron limit doesn't matter here:** pg_cron in Supabase (or a Cloudflare Cron Trigger) does per-minute scheduling, and Vercel is only woken for due jobs.
- **Firebase is cheap but loose:** with 3 scheduled jobs (weekly plan, a per-minute reminder dispatcher, a nightly cleanup) it stays within the 3 free Cloud Scheduler jobs, so about $0. But it needs a card on file without a confirmed hard cap, and Firestore is non-relational, which is a poor fit for a pantry/recipe/plan schema.
- **Render Free and Netlify Free are poor scheduler targets:** cold starts and hard pauses. Fly.io (~$2/month) is cheap but adds ops work.

### Gaps
- No official page opened for Vercel pricing, Netlify, Render or Fly.io this session.
- Whether Firebase Blaze can be hard-capped (budgets only alert) is **unverified**.
- The Cloudflare Pages free tier limits were not retrieved.

## 3. Push notifications

### Takeaway
Every push transport is free at household scale: Web Push with VAPID, FCM, APNs (with a paid Apple membership) and Expo Push. On iPhone, Web Push works only for a web app **added to the Home Screen** on iOS/iPadOS 16.4+, after a user tap.

### Cited Findings
- **Push API:** works "whether or not the web app is in the foreground, or even currently loaded", needs a service worker, and has been Baseline since March 2023 (Sept research). — [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- **iOS Web Push requirements:** iOS/iPadOS 16.4 brought Web Push to Home Screen web apps. Only a web app added to the Home Screen can request permission; a Safari tab cannot. The request must follow a direct user gesture. The stack is the Push API, Notifications API and Service Workers. — [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- **Manifest:** a web app manifest is required for iOS web push (vendor guide, not Apple). — [OneSignal iOS web push](https://documentation.onesignal.com/docs/web-push-for-ios), [Pushpad iOS requirements](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications) (third-party)
- **FCM:** no charge on either Firebase plan. — [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- **Expo Push:** no per-message charge per third-party comparisons. Expo staff said "We do not have a set limit (either daily or monthly)". Sends are batched up to 100 per request. — [Expo forums: push limits](https://forums.expo.dev/t/is-there-any-limit-for-sending-push-notification/2265), [Courier: APNs vs Expo](https://www.courier.com/integrations/compare/apple-push-notification-vs-expo) (third-party / forum)
- **APNs:** I found no source this session on its price or whether it requires the paid program (**unverified**). That APNs is free with an Apple Developer Program membership is from training knowledge.

### Inferences
- **Recommended:** VAPID Web Push sent from a Vercel route or Edge Function, with the `web-push` library or equivalent. It costs $0, needs no Firebase project, and Android Chrome routes it via FCM.
- **iPhone users:** each user must "Add to Home Screen" first, which is an onboarding step and not a cost. A native app avoids this but adds the store fees in section 5.

### Gaps
- Apple's APNs pricing and requirements were not confirmed from an Apple page.
- iOS 26.x behaviour changes and EU-specific Home Screen web app rules were not checked.
- Whether Chrome/Edge on iOS can also receive Web Push is third-party only.

## 4. Barcode scanning on the phone

### Takeaway
Use a free ZXing-C++ WebAssembly decoder: `zxing-wasm`, or the `barcode-detector` polyfill built on it. It reads UPC-A/EAN-13 in every modern browser, including iOS Safari. The native `BarcodeDetector` API is **not usable on iOS Safari**: caniuse marks it disabled by default through iOS 26.6. Use it only as a fast path on Android Chrome. Paid web SDKs start at about $99/month (STRICH) or $1,499/year (Dynamsoft), and Scandit and Scanbot are quote-only. That is overkill for a household. ML Kit is free but native-only.

### Cited Findings
- **caniuse, BarcodeDetector on iOS:** unsupported on iOS 3.2–16.7; "disabled by default" on iOS 17.0–26.6. Supported in Chrome for Android (v151), Samsung Internet and UC Browser. — [caniuse BarcodeDetector](https://caniuse.com/mdn-api_barcodedetector), [caniuse detect()](https://caniuse.com/mdn-api_barcodedetector_detect)
- **Conflict:** a Flutter plugin's docs claim native support in "Safari 17+", which contradicts caniuse. caniuse and WebKit bug reports are more authoritative. — [mobile_scanner docs](https://pub.dev/documentation/mobile_scanner/7.3.0/)
- **iOS 18 reports:** a developer on iOS 18.4 had to enable a feature flag, and scanning still failed on a barcode that worked on Android. Another thread says the Shape Detection API has been broken since iOS 18. — [WebKit Bugzilla 281848](https://bugs.webkit.org/show_bug.cgi?id=281848), [Apple Developer Forums 767761](https://developer.apple.com/forums/thread/767761)
- **`barcode-detector` (Sec-ant):** a BarcodeDetector ponyfill/polyfill on ZXing-C++ WebAssembly via `zxing-wasm`. By default it fetches the `.wasm` from jsDelivr, so self-host it for offline use or a strict CSP; a strict CSP also needs `'wasm-unsafe-eval'`. — [barcode-detector README](https://cdn.jsdelivr.net/npm/barcode-detector@3.1.3/README.md), [npm barcode-detector](https://npmjs.com/package/barcode-detector), [@marianmeres/scanner](https://jsr.io/@marianmeres/scanner)
- **zxing-wasm:** a WebAssembly port of ZXing C++ that works in all modern browsers, including Firefox, with EAN-13 supported. — [mobile_scanner docs](https://pub.dev/documentation/mobile_scanner/7.4.0/)
- **ZXing-js (`@zxing/library`, which `@zxing/browser` wraps):** maintainers say they "no longer have time to actively maintain" it. Camera access on iOS before 14.3 worked only in Safari. — [npm @zxing/library](https://npmjs.com/package/@zxing/library), [zxing-js README](https://cdn.jsdelivr.net/npm/@zxing/library@0.23.0/README.md)
- **html5-qrcode:** built on ZXing-js, uses native BarcodeDetector when available, and has reported issues with camera permissions and inconsistent behaviour across devices, including iOS. — [Scanbot: Quagga2 vs html5-qrcode](https://scanbot.io/blog/quagga2-vs-html5-qrcode-scanner/) (competitor vendor; treat with caution)
- **QuaggaJS/Quagga2:** covered only in the same competitor comparison. No independent accuracy data found. — [Scanbot comparison](https://scanbot.io/blog/quagga2-vs-html5-qrcode-scanner/)
- **Dynamsoft:** official page says usage-based licensing from **$1,499/year**. A reseller lists a 10,000-scan annual JS bundle at $1,371.02. 30-day trial. — [Dynamsoft pricing](https://www.dynamsoft.com/barcode-reader/pricing/), [ComponentSource](https://www.componentsource.com/product/barcode-reader/prices)
- **STRICH:** Basic $99/month (10,000 scans/month per G2), Professional $249/month (100,000 scans/month per G2), Enterprise $5,000/year (Capterra). Aggregator figures, not confirmed on strich.io. — [Capterra STRICH pricing](https://www.capterra.com/p/10020686/STRICH/pricing/), [G2 STRICH](https://g2.com/products/strich-barcode-scanning-sdk/reviews)
- **Scandit:** removed itemized tier pricing for a quote form in July 2026. Aggregators cite about $50/month for "Express Core", a mobile app product, not the web SDK. — [PricingSaaS Scandit](https://pricingsaas.com/companies/scandit), [PricingSaaS diff 2026W31](https://pricingsaas.com/companies/scandit/diffs/2026W31) (third-party)
- **Scandit and Scanbot price claim:** an undated dev post claims about $25,000/year each (**unverified**, likely outdated). Scanbot was acquired by Apryse and claims flat annual unlimited-scan pricing. — [dev.to comparison](https://dev.to/yurich84/comparison-of-barcode-scanner-libraries-4feg), [scanbot.io](https://scanbot.io/?p=10465)
- **ML Kit:** on-device and no network needed. Supports EAN-8, EAN-13, UPC-A, UPC-E, Code 128 and others. Has limits with some 1D/ITF codes and reads at most 10 barcodes per call. The Google code scanner needs no camera permission (uses the same model, returns the most central barcode). The model can be bundled or come from Play services. — [ML Kit barcode scanning](https://developers.google.com/ml-kit/vision/barcode-scanning?authuser=0), [ML Kit Android](https://developers.google.com/ml-kit/vision/barcode-scanning/android?authuser=8)
- **ML Kit price:** described as free by a competitor (Scanbot); no official price statement found. — [scanbot.io](https://scanbot.io/?p=11457)

### Inferences
- **Grocery barcodes are easy:** UPC-A/EAN-13 on packaging are high-contrast 1D codes, which free decoders handle well when the camera has autofocus and the code is close. Paid SDKs earn their price on damaged codes, poor light, batch or AR scanning and enterprise volume. None of that matters for a pantry.
- **Fallback:** a typed-digits entry box (EAN-13 has a check digit to validate) is a robust, $0 fallback.
- **Pick:** `barcode-detector` (polyfill) gives one API. It uses native detection on Android Chrome and WASM on iOS. Self-host the `.wasm` for the PWA's offline cache.

### Gaps
- No independent, published UPC-A/EAN-13 accuracy benchmark comparing ZXing-wasm, ZXing-js, html5-qrcode, Quagga2 and paid SDKs was found. Test on the household's own phones with 20–30 pantry items.
- Official STRICH, Scandit and Scanbot price pages were not reachable.

## 5. Going native: store fees, Expo EAS, TestFlight, PWA vs native

### Takeaway
- **Store fees:** Apple Developer Program $99/year (recurring), Google Play $25 once.
- **Expo EAS Free:** 15 Android + 15 iOS builds/month, enough for a household; Starter is $19/month.
- **iOS distribution:** TestFlight needs the paid Apple membership, and builds expire after 90 days.
- **PWA trade-off:** saves $99/year, at the cost of requiring "Add to Home Screen" for iOS push and doing WASM barcode scanning instead of ML Kit/VisionKit.

### Cited Findings
- **Apple fee:** $99 per year; waivable for nonprofits, education and government. Enterprise program $299/year (one source). — [appradar store fees](https://appradar.com/blog/google-play-apple-app-store-fees), [choicely](https://www.choicely.com/tutorials/how-much-does-it-cost-to-publish-an-app), [splitmetrics](https://splitmetrics.com/blog/google-play-apple-app-store-fees/) (third-party; developer.apple.com not reachable)
- **Google Play fee:** $25 one-time registration, no annual fee. — [appradar](https://appradar.com/blog/google-play-apple-app-store-fees), [playcode](https://playcode.io/blog/how-much-does-it-cost-to-publish-an-app) (third-party)
- **Expo EAS Free:** 15 Android and 15 iOS low-priority builds/month, 60 min CI/CD workflows, store submission, 1K MAU for EAS Update. No overage charges on Free; builds stop until the 1st of the next month. — [Expo billing plans](https://docs.expo.dev/billing/plans/), [Expo pricing](https://expo.dev/pricing.md)
- **Expo EAS Starter:** $19/month, includes $45 build credit and 3,000 EAS Update MAU. — [Expo billing plans](https://docs.expo.dev/billing/plans/)
- **TestFlight:** requires the paid $99 program. Up to 100 internal testers and 10,000 external testers. The first external build needs App Review. Builds are testable for up to 90 days. — [newly.app TestFlight guide, Sept 2026](https://newly.app/guides/ios-testflight), [buildfire](https://help.buildfire.com/how-to-test-your-app-with-apple-testflight-before-it-goes-live), [analyticsinsight](https://www.analyticsinsight.net/app-development/apple-developer-program-membership-costs-and-benefits) (third-party)
- **Free Apple account:** allows personal on-device testing but no TestFlight or App Store (third-party). — [newly.app: test on your own phone, Oct 2026](https://newly.app/guides/test-on-your-own-phone)
- **Offline sync in the browser:** Background Sync works on Chrome/Android but not Safari or Firefox, so a PWA's offline queue must replay on app open (Sept research). — [MDN Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)

### Inferences
- **Android only:** a native Android build sideloaded or on the Play internal track costs $25 once.
- **iPhones in the household:** either use the PWA (free; Home Screen install needed) or pay $99/year. Without the paid program, a free-account build installed from Xcode expires quickly and must be re-signed (my understanding from training knowledge; **unverified** this session).
- **Push and camera:** native gets reliable push via APNs/FCM (Expo Push wraps both) and ML Kit/VisionKit scanning. For 2–4 known users the PWA's gaps are onboarding friction, not blockers.

### Gaps
- Apple's and Google's official fee pages were not reachable.
- The validity period of free-account (personal team) iOS builds was not confirmed this session.

## 6. Monthly totals for one household of 2–4 users (excluding AI and domain)

### Takeaway
- **Cheapest robust-enough:** **$0/month** (Supabase Free + Vercel Hobby or Cloudflare Free + pg_cron + VAPID Web Push + zxing-wasm PWA).
- **Recommended:** **$25/month** (Supabase Pro for no-pause, daily backups and a spend cap, with everything else free). $35 with a `dev` project in the same Pro org.
- **Native apps:** add about $8.25/month for iOS ($99/year) plus $25 once for Android.

### Cited Findings (line items, sources as above)
| Line item | Cheapest | Recommended | Source |
|---|---|---|---|
| Database, auth, realtime, cron | Supabase Free $0 (pauses after 1 week idle, no backups) | Supabase Pro $25/month (incl. $10 compute credit = 1 Micro project; backups 7 days; never paused) | [Supabase pricing](https://supabase.com/pricing) |
| Second (`dev`) project | 2nd free project $0 | +~$10/month if in the Pro org, or keep Free/local | [Supabase compute](https://supabase.com/docs/guides/platform/manage-your-usage/compute) |
| Web hosting and API routes | Vercel Hobby $0 (personal only) or Cloudflare Workers Free $0 (10 ms CPU) | Vercel Hobby $0; if commercial, Cloudflare Workers Paid $5 or Vercel Pro $20/seat | [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Scheduled jobs (weekly plan, per-minute reminder dispatcher) | pg_cron $0 | pg_cron $0 | [Supabase Cron](https://supabase.com/docs/guides/cron) |
| Push | VAPID Web Push $0 | VAPID Web Push $0 (FCM/Expo Push $0 if native) | [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) |
| Barcode scanning | zxing-wasm / barcode-detector $0 | same $0 | [barcode-detector README](https://cdn.jsdelivr.net/npm/barcode-detector@3.1.3/README.md) |
| Native apps (optional) | $0 (PWA) | iOS $99/year ≈ $8.25/month; Android $25 once; Expo EAS Free $0 | [appradar](https://appradar.com/blog/google-play-apple-app-store-fees), [Expo plans](https://docs.expo.dev/billing/plans/) |
| **Monthly total** | **$0** | **$25** (PWA), **$35** with Pro `dev`, **~$33** with an iOS native app, **~$45–53** if commercial on Vercel Pro (+$20) | computed |

**Alternative stacks priced the same way:**
- **Cloudflare (Workers + D1 + Cron Triggers):** $0 on Free if every request stays under 10 ms CPU; realistically $5 on Paid. Auth is DIY or a third party (**unverified** cost). — [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- **Firebase Blaze:** about $0 usage (Auth 50K MAU free, Firestore 50K reads and 20K writes per day, 3 free Scheduler jobs, FCM free), but it needs a card on file and has no hard cap (**unverified**). Data is non-relational. — [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Cloud Scheduler pricing](https://cloud.google.com/scheduler/pricing?hl=pt-BR)
- **Paid barcode SDK:** STRICH would add $99/month, or Dynamsoft from about $125/month ($1,499/year). That is 4–5x the whole recommended stack. — [Capterra STRICH](https://www.capterra.com/p/10020686/STRICH/pricing/), [Dynamsoft pricing](https://www.dynamsoft.com/barcode-reader/pricing/)

### Inferences
- **Recommended stack:** stay on Supabase (already in use; Postgres plus RLS fits a shared pantry with per-user logs). Use Next.js PWA on Vercel Hobby, or Cloudflare Workers if commercial use is likely. pg_cron dispatches jobs every minute, VAPID handles push, and `barcode-detector`/zxing-wasm handles scanning. Move only `prod` to Pro ($25) once a second household member's data matters, and run `dev` locally with the Supabase CLI to avoid the extra ~$10.
- **What dominates the cost:** at 2–4 users Supabase Pro is the only real infrastructure cost. AI tokens (if the restart re-adds an in-app Agent; see `running-cost.md`: ~$10/user/month on gpt-5.4-mini) would dominate the total.

### Gaps
- Custom domain cost not researched (optional; a `*.vercel.app` or `*.workers.dev` subdomain is free per training knowledge, **unverified** this session).
- Totals rely on Sept 30 official checks plus October third-party summaries. Re-open supabase.com/pricing, vercel.com/pricing and developer.apple.com once network access allows.
