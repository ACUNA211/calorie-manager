# How are the Agent's markdown files organised?

Type: grilling
Status: resolved
Assignee: ACUNA211
Blocked by:

## Question

The Agent's behaviour is defined in markdown files, and app data lives in the database. How are those files split (one base persona plus one file per job: planning, Rebalance, recaps, check-ins, food logging)? Where do they live (in the repo, deployed with the app), and who edits them: only the developer, or Members through Settings? Does the Agent keep any memory of a Member beyond the database (for example notes it writes about habits), and if so, where?

## Comments

**Grilling (2026-09-30):** The developer asked whether the md files hold the data. They don't: they're only instructions, and all data stays in Supabase. The developer set a hard limit that no single call goes over 100K tokens.

**Spec gap from #18 (2026-09-30):** Writing the bake-off tests showed that the code-level hard-rule checks conflicted with #03, which lets a Member break their own hard rule after a warning. This is settled with a `member_override` flag on the write tools (see "Hard rules are enforced twice" below).

## Answer

**The md files are instructions only.** They describe how the Agent behaves, the rules it follows, and when and why to use each tool. All Household data (Pantry, Calorie Log, Meal Plan, Preferences…) stays in Supabase and reaches the Agent through a per-call snapshot and read/write tools.

### Files
- **Split for editing, always loaded together** in a fixed order as one cached block at the start of every call: `persona.md` (tone, "supports the app, doesn't replace it"), `rules.md` (hard/soft Preferences, the 50% floor, never proposing a skipped meal, Calorie Target warnings), `logging.md`, `planning.md`, `rebalance.md` (including the skipped-meal reasons and help lines from #08), `recaps.md`, `checkins.md`, `grocery.md`.
- **Job briefs** in `jobs/*.md` (Friday reflection and planning, 9:30pm Recap, Check-in, unbought-ingredient alert…) are added at the end only for the scheduled run they belong to.
- **Location:** in the repo at `app/agent/`, bundled at build time. A change means a commit and a deploy.
- **Editors:** only the developer, through git. Members shape the Agent through their own data (Preferences, Schedules, Favorites, Calorie Target, dish feedback). A free-text "custom instructions" box could be considered in phase 2.
- **Tool descriptions** live in code next to each tool's Zod schema. The md files refer to tools by name and say when to use them.
- **Hard rules are enforced twice:** they're written in `rules.md`, and the write tools check them again in code (hard Preferences, the 50% floor, no skipped meal proposed, Kitchen Tools). A tool refuses a Meal Plan or Rebalance that breaks one and returns the reason, so the model tries again.
- **Member override (follows #03's "warns but allows"):** plan and log write tools take a `member_override` flag. Without it, a write that breaks a hard Preference is refused with the reason. The Agent then shows the warning and asks "Still want it?", and calls again with `member_override: true` only after the Member says yes. The override:
  - covers only the Member's **own** hard rules (allergy, hard diet, hard dislike) and a missing Kitchen Tool, and only for a change the Member asked for. It is never used on something the Agent suggested, including Meal Plan drafts and Rebalance options.
  - can't override the other Member's hard rule on a shared meal (phase 3). That meal can still be taken off the shared plan and logged just for the Member.
  - doesn't apply to the 50% floor or the no-skipped-meal rule. Those only limit what the Agent proposes. A Member who shrinks or skips a meal themselves goes through #08's skipped-meal confirmation instead.
  - is recorded in the Activity Log as "overrode: <rule>", with undo.
- **Spanish (phase 3):** one English set of files that says "reply in the Member's language", plus a small `es.md` for tone and the Spanish help-line numbers.
- **Testing:** the bake-off prompts (#18) become a test set run by hand with `npm run agent:eval` before deploying a change under `app/agent/`. It isn't run in CI, because each run spends real API money.

### What each call contains
| Part | Estimated tokens |
|---|---|
| Agent md files + tool schemas (the same every call, cached) | ~8,000 |
| Snapshot: date and time, Member and language, Calorie Target, hard and soft Preferences | ~400 |
| Snapshot: today's Meal Plan, Calorie Log and forecast | ~700 |
| Snapshot: open Check-ins or a live Rebalance, Agent notes | ~400 |
| Chat history: the last 20 messages of that Member's chat | ~2,000–3,000 |
| **Start of a normal call** | **~12,000** |

- Everything else (the rest of the week's plan, Pantry, Grocery List, past days, Favorites, Kitchen Tools, Food Library, FoodData Central) is fetched with a read tool when needed.
- Expected peaks: a food log ~15K, and the Friday reflection plus planning ~30–40K.
- **Hard limit: 100K tokens in any single call**, enforced in code. Each tool result is capped at about 4K tokens (FoodData Central returns the top 5 matches, and the Pantry is trimmed to the fields that matter). If a call would still go over, the oldest chat messages are dropped first. If it's still over after that, the tool loop stops and the Agent asks the Member. The total spent across a conversation is covered by the $10/month cap (#12) and the cost estimate (#17), not by this limit.

### Agent notes (the Agent's memory)
- A short per-Member list in the database, **at most 15 short lines** (~300 tokens), loaded into every call. When it's full, the Agent merges or replaces a line instead of adding one.
- **Allowed:** habits and practical preferences ("orders pizza most Fridays", "hates Sunday meal prep").
- **Never stored:** mood, body image, weight feelings, skipped-meal reasons, or anything that already has a home elsewhere (Preferences, Favorites, Calorie Target). For those, the Agent suggests the proper setting instead.
- **The Agent asks before saving** ("Want me to remember that?"), following #05. Saved notes are logged in the Activity Log with undo.
- **Visible and editable** under ☰ → Settings → Agent notes. Following #13, both Members can see them.
