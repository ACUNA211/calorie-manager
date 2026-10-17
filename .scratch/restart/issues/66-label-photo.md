# 66: Label photo

**What to build:** For an unknown barcode, a "Take a photo of the label" option: the photo goes to a server function that makes one cheap AI vision call (through the AI cap helper) to read the Nutrition Facts panel, then pre-fills ticket 20's form for the Member to confirm. Photos are stored in Supabase Storage for the Household.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 20 (Type in a label for an unknown barcode), 12 (AI cap counter)

**Status:** ready-for-agent

- [ ] A clear label photo pre-fills name, serving size, calories and the six macros
- [ ] Nothing is saved until the Member confirms
- [ ] The call is recorded in the AI ledger and refused over the cap
- [ ] Tests use a recorded AI response
