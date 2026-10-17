# React + Vite PWA on Cloudflare Pages, with Supabase and Edge Functions

Status: accepted (2026-10-17)

## Context

ADR 0002 makes the app a Household PWA that must work offline (Shopping list and logging), switch between English and Spanish, scan barcodes on Android and iPhone, sign several people in, run Schedules and call AI, Jev and USDA without exposing keys. It may be sold later. The single-HTML artifact can't reasonably carry that, and Vercel Hobby is non-commercial only.

## Decision

- **App:** React + Vite, built as a PWA (service worker, Home Screen install, Web Push), with translation files for every string and the ZXing WebAssembly decoder for Scan.
- **Hosting:** Cloudflare Pages (free, commercial use allowed).
- **Backend:** Supabase for Postgres with row-level security per Household, Auth with invite links, Storage for label photos, and pg_cron for Schedules.
- **Server code:** Supabase Edge Functions make every AI, Jev, translation and USDA call, apply the AI cap, and hold the keys.
- The existing Supabase data moves into the new Household tables, with the current person as its first Member; old Meal Plans and Shopping list lines are kept as history.

## Consequences

- No Next.js or Vercel; server logic lives in Edge Functions and Postgres.
- Offline sync for the Shopping list and logging is ours to build (a local queue that replays on reconnect).
