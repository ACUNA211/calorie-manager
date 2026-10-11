# Artifact shell and the Meal Times tab

Type: build
Status: open
Assignee:
Blocked by: None

## What to build

The first end-to-end slice. Supabase tables for Member settings (Calorie Target, planning band) and Meal Times (name, time, weekdays, calorie range, kind: Set with one number / Planned / If room). The single artifact with tabs (Today, Plan, Shopping list, Recipes, Meal Times, Week view; empty placeholders except Meal Times), reading and writing Supabase through the Member's connector. The Meal Times tab is the full editor from #03's week grid: rows are Meal Times, columns are weekdays, tap a cell to toggle a day, tap a name to edit, add and delete, day totals against the aim and target under each column, Target and band in the toolbar. An overlap on the same day asks whether the new one replaces the other there.

## Done when

- The Member can set up his real Meal Times and Target on his phone and they persist in Supabase
- Reopening the artifact shows the same data
- Works at phone width

## Notes

Tables live in the existing Supabase project alongside grocery_list. Glossary: Meal Time (not "category" or "slot").
