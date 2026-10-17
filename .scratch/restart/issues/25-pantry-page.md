# 25: Pantry page

**What to build:** The Household's Pantry from `CONTEXT.md`: a list of foods at home with exact amounts (grams or units). Add an item by searching a food and entering an amount. Correct an item as "used up", "about half" or a typed amount. Sorted by store section.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 14 (Food search page), 08 (Move shared tables into the Household)

**Status:** ready-for-agent

- [ ] Every Member of the Household sees and edits the same Pantry
- [ ] Adding the same food twice adds to its amount instead of a second row
- [ ] "Used up" sets it to zero and hides it; "about half" halves it
- [ ] Amounts show in the Member's units
