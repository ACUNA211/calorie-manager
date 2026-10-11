# Calorie Manager

A one-person calorie tracker that plans the week from Recipes, with an AI agent that drafts plans and Rebalances them, and later adapts to the food at home.

## Language

**Member**:
The one person using the app: their own account (a username and password), Calorie Target and Calorie Log. The MVP has exactly one; accounts are created by hand in the back end.
_Avoid_: user, profile, household

**Agent**:
Claude, working in a chat outside the app (typed or by voice) on the Member's data, which it reads and writes directly. It drafts the Meal Plan and talks a Rebalance through, usually started by a slash command. The app's screens hold no chat of their own. What the Member asks it for happens straight away; what it suggests waits for a yes. Logging and Recipes work without it.
_Avoid_: bot, assistant, chatbot

**Recipe**:
A named meal made of ingredients with amounts. Its calories come from its ingredients and are shared out by the weight of the cooked result ("makes N servings" as the fallback), so a Portion's calories follow how much of it is eaten. It can be starred and tagged with the Meal Times it suits (a hint the Agent prefers, not a rule), and copied as a variation that names its original but never changes with it. Entered by hand; cooking steps are a later phase.
_Avoid_: dish

**Meal Time**:
A named time the Member eats ("Breakfast 7:30", "Work lunch 12:00"), set for the weekdays it applies to, with a calorie range. It is one of three kinds: **Set** (the meal is already decided, such as a work lunch, so its calories, one number, are set aside and the plan works around them), **Planned** (the Agent must fill it, inside its range), or **If room** (the Agent fills it only while calories are left, and Rebalance may drop it). The name carries no meaning in the app.
_Avoid_: slot, breakfast/lunch/dinner as fixed categories, Eating Out, Fixed / Open required / Open optional

**Cook**:
One batch of a Recipe made on a given day. Its Portions are placed at several Meal Times (one Sunday chili feeds dinner plus two lunches), and the Shopping list counts its ingredients once, scaled to the servings it makes. Servings it makes but no Portion uses are spare.
_Avoid_: batch, meal prep (as a noun)

**Portion**:
How much of a Cook is eaten at one Meal Time, and so how many calories it gives.

**Meal Plan**:
The Member's plan for one week, Sunday to Saturday: Cooks and their Portions placed at Meal Times. Drafted by the Agent in the planning chat, edited on the grid, and approved.
_Avoid_: plan (alone), menu, schedule

**Calorie Target**:
The daily calorie ceiling the Member aims to stay under; a day counts as "under" against it. Typed in by hand and the same every day.
_Avoid_: goal, plan, budget

**Planning band**:
The range under the Calorie Target that the Agent aims each planned day to land in (90–100% of it by default, editable), so a day is neither planned right at the limit nor far below it. Meal Time ranges and the band are guides; the Target is the line.
_Avoid_: target range

**Calorie Log**:
The Member's record of what they actually ate and its calories, each entry at a Meal Time or another time. It may differ from the Meal Plan; a planned meal left unlogged on a past day shows as "not logged".
_Avoid_: diary, journal, tracker

**Food Library**:
The foods the app knows calories for. A food gets in when a Recipe needs it, when the Member picks it from a USDA FoodData Central search or barcode scan (including its Branded Foods), when it's typed in once from a label, or when an accepted Estimate is saved (marked *estimated* until replaced). Each food has calories per 100 g and its serving sizes in grams.
_Avoid_: food list, database

**Shopping list**:
The Member's one list of things to buy. Approving a Meal Plan adds a line per food in one shopping measure, ordered by store section; anything else (including non-food items) can be added by hand. Each line shows the date it was added and has one tick, meaning "covered": already at home or bought, it doesn't matter which. Unticked lines stay until the Member ticks them, whatever week they came from; their date shows how long they've waited. When a Cook later needs more, a new unticked line is added for the extra; ticked lines are never unticked. There is no separate grocery list.
_Avoid_: grocery list

**Rebalance**:
A command (`/rebalance-cal`) where the Agent proposes up to three changes after a day goes over: by default to the rest of today, or to the rest of the week if asked, using only Cooks already planned. It never touches Set Meal Times or meals already logged, and never takes a Planned one below its range. The app only shows that a day is heading over; the options come from the Agent. Nothing changes until the Member picks one.
_Avoid_: adjust, correct, fix

**Week view**:
The one stats page: each day of the week against the Calorie Target and planning band, the count of days under, and the week's average. Tapping a day opens it on Today, which is the only day view.
_Avoid_: stats, recap, analytics, day view

**Pantry** _(later phase, not in the MVP)_:
The food at home, tracked in the app so the Agent can adapt suggestions to it. In the MVP, ticking a Shopping list line as already at home stands in for it.
_Avoid_: inventory, fridge, stock

## Relationships

- A **Member** has one **Calorie Target**, one **Calorie Log**, a set of **Meal Times**, and one **Meal Plan** per week
- A **Meal Plan** holds **Cooks**; each **Cook** is one **Recipe** made once, with **Portions** placed at **Meal Times**
- Approving a **Meal Plan** builds its **Shopping list**
- A **Rebalance** changes **Portions** in the current **Meal Plan**, using what's left under the **Calorie Target**

## Flagged ambiguities

- "Plan" was used for both the weekly meal plan and a calorie goal. Resolved: **Meal Plan** and **Calorie Target**.
- "The band" means the **Planning band**; on screen it can read "Aim: 1,800–2,000".
