# 75: Phone check: barcode reads

**Type:** your task (not for an agent)

**What to do:** Open `<Pages URL>/?test=barcode` on both Household Android phones and one iPhone, tap Start camera and scan real packages: at least one UPC-A and one EAN-13. Copy the on-screen log into ticket 17's results table (phone, browser, engine, read time, misses).

**Blocked by:** 73 (Deploy the app to Cloudflare Pages)

**Status:** done

**Unblocks:** 17

- [x] UPC-A and EAN-13 read on every phone
- [x] Results table in ticket 17 filled in

## Comments

- 2026-10-18: Sergio ran the test on both Household Android phones and the iPhone: UPC-A and EAN-13 read on every phone. Per-phone numbers (engine, read time, misses) were not recorded, by his choice; see ticket 17.
