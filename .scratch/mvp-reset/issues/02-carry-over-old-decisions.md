# Which of the old map's decisions carry over?

Type: grilling
Status: resolved
Assignee:
Blocked by: 

## Question

The old map ([Calorie Manager MVP](../../mvp/map.md)) holds 20 resolved decisions made for a much bigger MVP. Go through each one and mark it **keep**, **trim** (say what changes) or **drop** for this map. Likely kept or trimmed: phone app or website (#01), calorie sources (#02), stack and hosting (#11/#12), sign-in (#13), Agent files (#16), adding food (#20) and the Agent-estimates question (#26). Likely mostly dropped: autonomy and schedules (#05), the Meal Plan shape (#06, now replaced by Meal Times, Cooks and the planning band), Pantry precision (#04), the Grocery List rules (#07), the old automatic Rebalance (#08), the dashboard (#09), notifications (#14) and Recaps (#15). Also clean CONTEXT.md of terms this map no longer uses (Pantry, Check-in, Busy Day, Prep Session and others) or mark them as later-phase.

## Comments

**Resolution (2026-10-01):** grilled with the user. Old decision numbers refer to [the old map](../../mvp/map.md).

**Keep**
- #01 Phone app or website: an installable PWA, phone-first, fully usable in a laptop browser.
- #06 (only this part): the week runs Sunday to Saturday.

**Trim**
- #11/#12 Stack: TypeScript, a Next.js PWA (Tailwind + shadcn/ui) in `app/`, Vercel Hobby, Supabase (Postgres + Auth; free `dev` and `prod` projects, SQL migrations, no Docker), a nightly `pg_dump` GitHub Action, the Agent in Vercel route handlers, AI through the AI SDK on a paid key. Dropped: the pg_cron Schedules runner, VAPID push, the offline queue. The model still waits on the bake-off; the spending cap moves to [#10](10-ai-cost.md).
- #13 Sign-in: **username and password** through Supabase Auth's password login (hashed by Supabase, nothing custom). The username maps to a hidden placeholder email (`name@users.calorie.local`) because Supabase needs one. No public sign-up: accounts are made by hand in the Supabase dashboard. Stay signed in until sign-out. Forgotten passwords are reset by hand; no verification or reset emails. No Google sign-in, allowlist or second-Member rules.
- #03 Calorie Target: typed in by hand, the same every day, plus the planning band (90–100% by default, editable). Preferences (allergies, diets, dislikes) are dropped.
- #05 Autonomy: only the rule that what the Member asks for happens straight away and what the Agent suggests waits for a yes; nothing is approved automatically. No Schedules, Check-ins, recaps or Activity Log.
- #02 Calorie sources and #20 Adding food: USDA FoodData Central (with Branded Foods, per [#01](01-packaged-food-databases.md)). Typed text like "2 eggs and toast with butter" is split by a **local, non-AI parser** for simple "amount + food" parts joined by "and" or commas; AI is called once only for parts left unmatched, marked estimated. #20's one box, Food Library first, live matches (recent and frequent first) and confirm card are the starting point for [#07](07-today-and-logging.md); the Pantry tick and Chat cards are dropped. Logging and plan edits get an **Undo toast** instead of an Activity Log.
- #16 Agent files: markdown files are instructions only, data stays in Supabase, they live in `app/agent/` and load as one cached block; tool descriptions sit in code next to the Zod schemas, write tools re-check hard rules, the token caps stay, changes are tested with `npm run agent:eval`. Dropped: Agent notes, `jobs/`, the check-in, recap and grocery files, `member_override`.

**Drop**
- #04 Pantry precision, #08 old Rebalance, #09 dashboard (its prototype is background for #07), #10 language (English only, no translation file), #14 notifications, #17 running cost (replaced by [#10](10-ai-cost.md), which may reuse its research and free-tier cliffs), #19 other pages, and the old open #26 Agent estimates (split between #07 and #10).
- #07 Grocery List: dropped, but "one measure per food", "one line per food across Cooks" and store-section ordering are inputs for [#06](06-shopping-list.md).
- #15 Recaps: dropped; the rule "a day with an unlogged meal is grey and not counted" is an input for [#09](09-week-view.md).
- The rest of #06 (the 25/30/35/10 split, Busy Days, prep limits, Eating-out learning, Favorites, Kitchen Tools): replaced by Meal Times, Cooks and the planning band.
- All of the old safety rails (low-target warning, never proposing a skipped meal, the skipped-meal support flow). Rebalance's rule about Open required ranges stays, as part of how Meal Times work.
- The offline shopping list.
- **One person:** the data model has one Member and no Household; no per-Member Portions or second-Member groundwork. Extra eaters are considered when a Cook is designed, if ever.
- The old Phases section: everything in it moves to the map's End goal, to be revisited after a few days or weeks of using the MVP.

CONTEXT.md was rewritten to match: Household, Preferences, Missing Ingredient, Busy Day, Prep Session, Favorites, Kitchen Tools, Schedule, Recap, Check-in, Activity Log and Agent notes are removed; Grocery List became Shopping list and Stats became Week view; Pantry is marked later-phase.
