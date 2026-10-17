# Calorie Manager

A Household calorie and macro tracker that plans the week from Recipes and the shared Pantry, with cheap, bounded AI: a model drafts the Meal Plan, and Jev rates Rebalances and Voice commands. See [ADR 0002](docs/adr/0002-household-pwa-with-cheap-ai.md). _Restart in progress: terms marked (open) are still being grilled._

## Language

**Household**:
The people who share one Pantry, one Recipe library, one Meal Plan per week and one Shopping list. A person belongs to exactly one Household. Joining is by an invite link from the Owner.
_Avoid_: family, group, team

**Member**:
A person in a Household with their own Targets and Calorie Log. Most Members have their own login. A **Dependent** is a Member without a login (such as a child) whose food is logged by another Member.
_Avoid_: user, profile

**Owner**:
The Member who created the Household. They invite others and approve the Meal Plan, or allow other Members to approve it. Every Member can edit the Pantry, Recipes and the Shopping list.
_Avoid_: admin

**Intake form**:
The questions a Member answers when joining (such as age, height, weight, activity and goal). A standard formula turns the answers into suggested Targets, which the Member accepts or edits.
_Avoid_: onboarding survey, quiz

**Targets**:
A Member's daily aims, set by hand or suggested from the Intake form. The **Calorie Target** is a ceiling: a day counts as "under" against it. Protein is a floor. Carbs and fat are optional ranges. Fibre, sugar and sodium are recorded and shown, but have no targets yet.
_Avoid_: goal, plan, budget

**Planning band**:
The range under the Calorie Target that each planned day aims to land in (90–100% by default, editable). Meal Time ranges and the band are guides; the Target is the line.
_Avoid_: target range

**Agent**:
The AI the app calls, and only for three jobs: drafting the Meal Plan, Rebalance and Voice commands. It works through code that checks its output. What a Member asks for happens straight away; what the Agent suggests waits for a yes.
_Avoid_: bot, assistant, chatbot

**Jev**:
TypeSafe AI's decision model. It doesn't write text; it answers typed questions (a choice, a score, a yes/no) with probabilities. Used for Rebalance and Voice commands, behind an interface that can switch to another decision model or a cheap text model.

**Voice command**:
A spoken instruction ("tick off the milk") turned to text, then rated by Jev into its most likely meanings, shown as options. Nothing changes until the Member picks one; if none is right, they say it again.
_Avoid_: voice assistant, dictation

**Pantry**:
The food at home, shared by the Household, with exact amounts in grams or units. A scan adds one package at its label weight. Logging a Cook takes its ingredients off. Any item can be corrected ("used up", "about half").
_Avoid_: inventory, fridge, stock

**Food Library**:
The foods the app knows calories and macros for, stored per 100 g with serving sizes in grams. A food gets in from a USDA FoodData Central search or barcode scan, from Open Food Facts when USDA misses (kept in its own table), or typed in once from a label.
_Avoid_: food list, database

**Recipe**:
A named meal made of ingredients with amounts in grams. Its calories and macros come from its ingredients and are shared out by the weight of the cooked result ("makes N servings" as the fallback). It can be starred, tagged with the Meal Times it suits, and copied as a variation. The library belongs to the Household.
_Avoid_: dish

**Meal Time**:
A named time a Member eats ("Breakfast 7:30"), set for the weekdays it applies to, with a calorie range. Kinds: **Set** (already decided; its calories are set aside), **Planned** (the Agent must fill it, inside its range) and **If room** (filled only while calories are left; Rebalance may drop it). (open: Meal Times shared by several Members)
_Avoid_: slot, Fixed / Open required / Open optional

**Cook**:
One batch of a Recipe made on a given day, its Portions placed at several Meal Times and possibly for several Members. The Shopping list counts its ingredients once, scaled to the servings it makes.
_Avoid_: batch, meal prep (as a noun)

**Portion**:
How much of a Cook one Member eats at one Meal Time, and so how many calories and macros it gives.

**Meal Plan**:
The Household's plan for one week, Sunday to Saturday: Cooks and their Portions placed at Members' Meal Times. Drafted by the Agent on a Schedule, edited on the grid, and approved.
_Avoid_: plan (alone), menu, schedule

**Calorie Log**:
A Member's record of what they actually ate, with calories and macros, each entry at a Meal Time or another time. Logging is plain code: scan, search, pick a Portion, or a Voice command.
_Avoid_: diary, journal, tracker

**Shopping list**:
The Household's one list of things to buy, built from the approved Meal Plan minus what the Pantry already holds, plus anything added by hand. Ticking a line means "covered"; a bought line adds to the Pantry. (open: details carried over from the MVP)
_Avoid_: grocery list

**Rebalance**:
After a Member's day goes over, Jev rates what they said (how far over, which meal, what kind of fix they want), then fixed formulas pick the change from Cooks already planned. It never touches Set Meal Times or meals already logged, and never takes a Planned one below its range. Nothing changes until the Member picks.
_Avoid_: adjust, correct, fix

**AI cap**:
A $5/month hard limit per AI provider, plus an in-app counter that stops AI calls when it is reached.

## Relationships

- A **Household** has Members, one **Pantry**, one Recipe library, one **Meal Plan** per week and one **Shopping list**
- A **Member** has **Targets**, one **Calorie Log** and a set of **Meal Times**
- A **Meal Plan** holds **Cooks**; each Cook is one **Recipe** made once, with **Portions** for Members at their Meal Times
- Approving a **Meal Plan** adds what the **Pantry** lacks to the **Shopping list**; logging a **Cook** takes its ingredients out of the Pantry
- A **Rebalance** changes **Portions** in the current Meal Plan for one Member

## Flagged ambiguities

- "Plan" was used for both the weekly meal plan and a calorie goal. Resolved: **Meal Plan** and **Targets**.
- "Text to speech" for Voice commands means speech-to-text: the Member speaks, the app reads it.
