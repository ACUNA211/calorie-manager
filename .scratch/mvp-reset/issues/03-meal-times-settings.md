# What does setting up Meal Times look like?

Type: prototype
Status: resolved
Assignee:
Blocked by: 

## Question

Mock up the Meal Times settings. Each Meal Time has a name, a time, the weekdays it applies to, a calorie range, and a kind: **Fixed** (already decided, such as Tuesday work lunch, with its calories set aside), **Open required** or **Open optional**. While editing one, show the other Meal Times on those days with their ranges, plus each day's totals against the Calorie Target and the planning band (90–100% of the target by default, editable). Warn when the Fixed and Open required minimums on a day already go over the target. How does a weekday-specific Meal Time sit alongside an everyday one? Where are the Calorie Target and planning band edited?

## Comments

**Resolution (2026-10-01):** layout **B, the week grid**, from [the prototype](../prototypes/03-meal-times-PROTOTYPE.html?variant=B) (A and C are kept in the file for reference).
- **The page:** one row per Meal Time (sorted by time) and one column per weekday, Sunday to Saturday. Tapping a cell switches that day on or off straight away; tapping a name opens the editor under the grid (name, time, kind, days with Every day / Mon–Fri / Weekend shortcuts, calories), and the grid previews the edit before Save.
- **Day totals:** under each column, the day's range (Set + Planned minimums to every maximum) and a small bar against the aim and the target. A day whose Set + Planned minimums go over the target turns red with a warning; a day whose maximums can't reach the aim gets a softer note.
- **Calorie Target and planning band** are edited in a toolbar at the top of the same page.
- **Kinds renamed** to **Set** (already decided; one calorie number, set aside), **Planned** (the Agent must fill it, inside a min–max range) and **If room** (the Agent fills it only while calories are left; Rebalance may drop it). The map, the open tickets and CONTEXT.md use the new names.
- **Weekday-specific vs everyday:** they are separate Meal Times with their own days. When one overlaps another on the same day within 45 minutes, the app asks whether it replaces the other on those days ("Take Tue off Lunch") or keeps both.
