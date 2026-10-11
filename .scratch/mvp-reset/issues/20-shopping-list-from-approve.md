# Shopping list built on Approve

Type: build
Status: built
Assignee:
Blocked by: [Plan tab: resize, remove and Approve](19-plan-edits-and-approve.md)

## What to build

Extend the existing `grocery_list` table (keep its 4 rows and columns) with: the food a line came from, the Meal Plan/Cook it came from (null for hand-added), a shopping measure and amount, and a store section. On Approve, add one line per food from the approved Cooks' servings made, in one shopping measure from its Food Library serving sizes, rounded up. The Shopping list tab: lines by store section (from the USDA category, movable and remembered), one ✔ meaning covered (`purchased`), the date added (`created_at`) so overdue lines stand out, add-by-hand. Nothing is ever ticked automatically. Retire the old grocery list artifact once this works.

## Done when

- Approving a real week fills the list correctly
- Hand-added and old unticked lines stay as they were
- The old grocery artifact is no longer needed

## Notes

Supersedes #06's two-tab design.

## Comments

Built 2026-10-10: `grocery_list` extended (`food_id`, `meal_plan_id`, `source`, `grams`, `store_section`); `approve_meal_plan` / `sync_shopping_list` add one line per food in its largest serving size, rounded up; Shopping tab by store section with one tick, date added (amber after 7 days), add by hand, edit quantity/section (remembered for the food), delete. Tested on throwaway data. The old Grocery List artifact can be deleted once Sergio is happy.
