# Shopping list built on Approve

Type: build
Status: open
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
