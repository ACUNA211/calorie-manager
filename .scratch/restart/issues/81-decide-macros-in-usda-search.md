# 81: Decide: show macros on USDA search results?

**Type:** your task (not for an agent)

**What to do:** On the Foods page (ticket 14), a USDA result shows calories only, because the existing `usda_search` database function returns calories only. Macros appear once the food is saved to the Food Library. Say yes or no to changing `usda_search` so results carry protein, carbs and fat too (a new migration; costs nothing extra but makes each search response bigger). Write the answer in ticket 14's Comments.

Ticket 18 (Scan finds a food) raises the same question: a scanned product found only in USDA currently waits for you to press Save before its macros show. Pick: auto-save scanned USDA products into the Food Library (macros at once), or keep the Save button. Write that answer in ticket 18's Comments.

Ticket 26 (Scan into the Pantry) adds one more. Write it in ticket 26's Comments: a scanned package's weight comes from the weight your Household set on that food, or else from a serving whose label names a package (can, bottle, pack, box, jar...); a plain serving like "1 cup" is never taken as the package, so the app asks once. Keep the package-word guess, or always ask?

Ticket 20 (Type in a label) adds two more. Write them in ticket 20's Comments:

- **Calorie check tolerance.** A typed label asks you to confirm when its calories differ from 4·carbs + 4·protein + 9·fat by more than 10 kcal or 20 %, whichever is bigger. The value ranges live in `web/src/lib/label.js`. Keep these limits or give new ones.
- **When Open Food Facts is busy or down.** "Type in the label" is hidden then (so a product that OFF does know isn't typed in twice), and shown only when OFF answers "not found". Keep that, or always offer it?

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

**Unblocks:** 14, 18, 20, 26

- [ ] Answer written in ticket 14's Comments
- [ ] Scan auto-save answer written in ticket 18's Comments
- [ ] Package-weight answer written in ticket 26's Comments
- [ ] Two label answers written in ticket 20's Comments
