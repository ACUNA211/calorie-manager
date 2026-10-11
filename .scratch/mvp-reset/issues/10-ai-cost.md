# What does this MVP's AI cost each month?

Type: research
Status: resolved
Assignee:
Blocked by: [Which of the old map's decisions carry over?](02-carry-over-old-decisions.md)

## Question

Re-estimate the monthly AI cost for this much smaller Agent: one planning conversation a week, occasional Rebalance conversations, and single-shot estimates when logging finds no match. Build on the old [What does it cost to run each month?](../../mvp/issues/17-running-cost.md) and its research, using the model and Agent-file decisions [Which of the old map's decisions carry over?](02-carry-over-old-decisions.md) keeps. From #08: Rebalance options are worked out without AI; the Agent is only called when the Member opens its chat card, so Rebalance conversations are rarer than first assumed. Say how big each conversation is likely to be, the cost per call on the candidate models, and whether the old spending cap and usage ledger still make sense.

## Comments

**Resolution (2026-10-10):** not needed. [ADR 0001](../../../docs/adr/0001-artifact-and-claude-chat-instead-of-built-app.md) moves the Agent into Claude chat and skills, so there's no AI API bill; the in-app Estimate and label reading run on the Member's Claude account.
