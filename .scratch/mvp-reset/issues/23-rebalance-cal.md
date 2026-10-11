# /rebalance-cal and the heading-over warning

Type: build
Status: open
Assignee:
Blocked by: [Today: confirm planned meals](22-today-confirm-planned-meals.md)

## What to build

Today shows when the day is heading over the Target (red bar and a short hint to say `/rebalance-cal`). The `/rebalance-cal` skill: reads today's log and the rest of the plan and offers up to three options in chat under Rebalance's rules (only Cooks already planned; never Set Meal Times or logged meals; never a Planned Portion below its range; shrink in ¼ servings or drop If room times; rest of the week only when asked, each later day's smallest covering change). The Member picks one; the Agent writes it; the Plan tab and Today show the change.

## Done when

- A real over-day gets three valid options and the chosen one is applied
- None of the rules above is ever broken in testing

## Notes

Option rules from #08's resolution; the on-phone cards are dropped (decision Q8).
