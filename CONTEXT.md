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
The questions a Member answers when joining (such as age, height, weight, activity and goal). A standard formula turns the answers into suggested Targets, which the Member accepts or edits. When a new weight is logged, an updated suggestion is offered, never applied on its own. Dependents get no suggested Targets. (open: the formula and questions, see `.scratch/restart/issues/01-targets-formula-research.md`)
_Avoid_: onboarding survey, quiz

**Targets**:
A Member's daily aims, set by hand or suggested from the Intake form. The **Calorie Target** is a ceiling: a day counts as "under" against it. Protein is a floor. A suggested Calorie Target never goes below the Member's **suggestion floor** (1,200 kcal for women, 1,500 for men by default), a per-Member setting that can be changed or turned off; a Target typed by hand ignores it. The floor is part of the formula, not a warning. Carbs and fat are optional ranges. Fibre, sugar and sodium are recorded and shown, but have no targets yet.
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
A spoken instruction ("tick off the milk") turned to text by the browser's own speech recognition, then rated by Jev into its three most likely meanings, shown as option cards. Code pulls out any amounts. Nothing changes until the Member picks one; if none is right, they say it again. The actions: tick a Shopping list line, add to the Shopping list, log a planned Portion, log something else, mark a Pantry item used up or partly used, and start a Rebalance.
_Avoid_: voice assistant, dictation

**Pantry**:
The food at home, shared by the Household, with exact amounts in grams or units. It goes up when a Shopping list line is ticked Bought (the planned amount) or a package is scanned in (its label weight, replacing the planned amount). It goes down when a Cook is marked made (all its ingredients) and when a Pantry food is eaten on its own (an apple is both a Pantry food and a Recipe ingredient). Any item can be corrected ("used up", "about half").
_Avoid_: inventory, fridge, stock

**Food Library**:
The foods the app knows calories and macros for, stored per 100 g with serving sizes in grams. A food gets in from a USDA FoodData Central search or barcode scan, from Open Food Facts when USDA misses (kept in its own table), or typed in once from a label (or read from a photo of the Nutrition Facts panel by a cheap AI call, then confirmed). Each food has an English and a Spanish name; the Spanish one is filled once by a translation API's free tier (a cheap AI call if none fits) and can be edited, and search matches both.
_Avoid_: food list, database

**Recipe**:
A named meal made of ingredients with amounts in grams. Its calories and macros come from its ingredients and are shared out by the weight of the cooked result ("makes N servings" as the fallback). It has ingredients and one free-text notes field (no cooking steps or cooking mode yet). It can be starred, tagged with the Meal Times it suits, and copied as a variation. The library belongs to the Household. A Recipe is typed in, or pasted as text or a link and parsed by one cheap AI call, then confirmed; a starter set may be imported from USDA MyPlate Kitchen. Its nutrition always comes from Food Library matches, never from the AI.
_Avoid_: dish

**Meal Time**:
A named time a Member eats ("Breakfast 7:30"), set for the weekdays it applies to, with a calorie range. Kinds: **Set** (already decided; its calories are set aside), **Planned** (the Agent must fill it, inside its range) and **If room** (filled only while calories are left; Rebalance may drop it). A **shared** Meal Time ("Family dinner 6:30") belongs to several Members and gets one Cook, with each Member's Portion sized by code to what they have left.
_Avoid_: slot, Fixed / Open required / Open optional

**Cook**:
One batch of a Recipe made on a given day, its Portions placed at several Meal Times and possibly for several Members. The Shopping list counts its ingredients once, scaled to the servings it makes.
_Avoid_: batch, meal prep (as a noun)

**Portion**:
How much of a Cook one Member eats at one Meal Time, and so how many calories and macros it gives. A logged Portion comes out of its Cook, not the Pantry.

**Leftovers**:
Servings of a made Cook that no logged Portion has used yet. They stay until eaten or thrown out; a shrunk Portion in a Rebalance adds to them. After 4 days (editable) they're flagged, and planning uses them, and opened Pantry items, first. Pantry items have no expiry dates.
_Avoid_: spare (as a noun)

**Meal Plan**:
The Household's plan for one week, Sunday to Saturday: Cooks and their Portions placed at Members' Meal Times. Drafted by the Agent on a Schedule, then changed on the grid by hand, by **Swap** (the Agent offers three other Recipes for one Cook) or by **Redraft** (a typed or spoken note for the whole week, such as "less chicken"), and approved. There is no planning chat.
_Avoid_: plan (alone), menu, schedule

**Calorie Log**:
A Member's record of what they actually ate, with calories and macros. Other Members see only what's on the shared Meal Plan and an on track / over flag per day, unless the Member shares everything; weight stays private unless shared. Every adult sees Dependents' logs. Each entry is at a Meal Time or another time. Logging is plain code: scan, search, pick a Portion, or a Voice command.
_Avoid_: diary, journal, tracker

**Shopping list**:
The Household's one list of things to buy, built from the approved Meal Plan: each line is what the Meal Plan needs minus what the Pantry holds. Anything else can be added by hand. A line is ticked **Bought** (adds its amount to the Pantry) or **Have it** (corrects the Pantry to say it's there).
_Avoid_: grocery list

**Rebalance**:
After a Member's day goes over, Jev rates what they said (how far over, which meal, what kind of fix they want), then fixed formulas pick the change from Cooks already planned. It never touches Set Meal Times or meals already logged, and never takes a Planned one below its range. Nothing changes until the Member picks.
_Avoid_: adjust, correct, fix

**Preferences**:
What the Agent plans from. Household Preferences: cuisines, cooking time on weeknights and weekends, equipment, how often meals repeat, how many leftovers are fine, and a budget feel. Member Preferences: favourites and dislikes (soft), and **Hard rules** (allergies, foods they won't eat, diet rules such as vegetarian or halal). Code filters out any Recipe that breaks a Hard rule for anyone eating it before the Agent sees it.
_Avoid_: settings, restrictions

**Schedule**:
A job that runs on its own: the weekly Meal Plan draft (once a week, Friday 6pm by default, changeable by the Owner, then a notification), building the Shopping list when the Meal Plan is approved, reminders around each Meal Time, and reminders on cook days. Approval is always by hand. Each Member picks which reminders they get, delivered by Web Push.
_Avoid_: cron, automation

**Scan**:
Reading a barcode with the phone camera. What it does fits the screen: on the Pantry it adds the package, on the Shopping list it ticks the line Bought, and on Today it shows the food with **Add to Pantry** and **Eaten** (logged at the current Meal Time). A food is looked up once and then kept in the Food Library.

**Week view**:
The stats page, per Member: each day's calories and macros against Targets and the Planning band, days under, the week's average and a weight trend. A small Household panel shows Cooks made vs planned and Leftovers thrown out. No streaks or badges.
_Avoid_: stats, recap, analytics

**AI cap**:
A $5/month hard limit per AI provider, plus an in-app counter that stops AI calls when it is reached.

## Ground rules

- Android and iPhone are both supported from day one (Web Push on iPhone needs the app on the Home Screen).
- Every screen is in English or Spanish, switched per Member, with all text kept in translation files so more languages can follow. Each Member picks display units (metric or US); everything is stored in grams, and the Shopping list uses the units stores sell in.
- The Shopping list and logging work offline and sync later; planning, Scan lookups and Voice commands need a connection.
- Grocery prices are out of the first version; Preferences keep only a budget feel.
- No safety rails (no low-Target warning or support links). Exercise and burned calories are a later phase; the Calorie Target covers activity.

## Relationships

- A **Household** has Members, one **Pantry**, one Recipe library, one **Meal Plan** per week and one **Shopping list**
- A **Member** has **Targets**, one **Calorie Log** and a set of **Meal Times**
- A **Meal Plan** holds **Cooks**; each Cook is one **Recipe** made once, with **Portions** for Members at their Meal Times
- Approving a **Meal Plan** adds what the **Pantry** lacks to the **Shopping list**; logging a **Cook** takes its ingredients out of the Pantry
- A **Rebalance** changes **Portions** in the current Meal Plan for one Member

## Flagged ambiguities

- "Plan" was used for both the weekly meal plan and a calorie goal. Resolved: **Meal Plan** and **Targets**.
- "Text to speech" for Voice commands means speech-to-text: the Member speaks, the app reads it.
