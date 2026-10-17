# 17: Barcode phone test

**What to build:** Port the old barcode test page into the app as a hidden test screen using the `barcode-detector` polyfill built on zxing-wasm (self-host the .wasm file). It opens the rear camera, reads UPC-A, UPC-E, EAN-13 and EAN-8, and shows the code. Run it on both Household Android phones and one iPhone (installed app), and write down the results.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 03 (Home Screen install and offline app shell)

**Status:** ready-for-agent

- [ ] The test screen reads a UPC-A and an EAN-13 from real packages
- [ ] Uses the native `BarcodeDetector` where it works and the zxing-wasm polyfill otherwise
- [ ] Results (phone, browser, read time, misses) recorded in the ticket's comments
- [ ] The old `@zxing/library` dependency isn't used
