# 09: Move personal tables to Members

**What to build:** The existing personal tables become per Member: Meal Times, Portions, the Calorie Log, and the one-row settings (which becomes a per-Member settings row). Add `member_id` (and the Household through the Member) with policies. Portions' unique key becomes (member, Meal Time, date). Move current rows to the Owner's Member.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 05 (Households and Members)

**Status:** ready-for-agent

- [ ] Meal Times, Portions and Calorie Log rows each have a Member; current rows belong to the Owner
- [ ] The one-row settings table is replaced by one settings row per Member, with the current Calorie Target and Planning band kept
- [ ] Portions are unique per (member, Meal Time, date)
- [ ] Policies let adults see their own rows and their Dependents' rows (tested); other Members' visibility is ticket 33
