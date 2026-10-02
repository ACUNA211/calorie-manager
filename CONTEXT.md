# Calorie Manager

A household calorie tracker that plans the week from Recipes, with an AI agent that drafts plans and Rebalances them, and later adapts to the food at home.

## Language

**Household**:
The group of people who share one home, one Pantry, and one app. Today: two Members. The MVP starts with one active Member; the second joins in phase 3.
_Avoid_: family, account, team

**Member**:
One person in a Household, with their own calorie target and Calorie Log.
_Avoid_: user, profile

**Pantry**:
The food the Household currently has at home. Members manage it directly in the app, not only through the Agent.
_Avoid_: inventory, fridge, stock

**Agent**:
The built-in AI that reflects on what Members did and recommends what to do next. Members can chat with it, but it supports the app rather than being the main way to use it.
_Avoid_: bot, assistant, chatbot

**Meal Plan**:
The Household's single plan for the week. Shared meals appear once, with a separate Portion for each Member.
_Avoid_: plan (alone), menu, schedule

**Portion**:
How much of a planned meal one Member eats, and so how many calories it gives them.

**Missing Ingredient**:
Something a Meal Plan needs that isn't in the Pantry.

**Grocery List**:
The Household's live list of things to buy. Members add to it at any time, and approving a Meal Plan merges in its Missing Ingredients plus anything the Agent recommends.
_Avoid_: shopping list

**Preferences**:
A Member's dislikes, allergies, and diet (for example vegetarian). Meal Plans and Agent recommendations respect them. Allergies are always **hard**. Diets and dislikes are each **hard** or **soft**. A **hard** Preference never appears in that Member's Portion. A **soft** dislike may be blended in where it can't be noticed, and the Agent says so openly.
_Avoid_: settings, profile

**Calorie Target**:
The daily calorie ceiling a Member aims to stay under to keep a deficit; a day counts as "under" against it. Typed in by hand in the MVP, then calculated from body stats and workouts in a later phase.
_Avoid_: goal, plan, budget

**Planning band**:
The range under the Calorie Target that the Meal Plan aims to land in (90–100% of it by default, editable). Meal Time ranges and the band are guides; the Target is the line.
_Avoid_: target range

**Calorie Log**:
One Member's record of what they actually ate and its calories. It may differ from the Meal Plan.
_Avoid_: diary, journal, tracker

**Food Library**:
The foods the app already knows calories for. A Member can search it, and the Agent can look up or estimate foods that aren't in it yet.
_Avoid_: food list, database

**Rebalance**:
The Agent proposing changes to a Member's remaining meals for the day when the day forecast (calories logged so far plus the rest of today's plan) goes over their Calorie Target, so they can still land under it. It is only a proposal until the Member picks an option.
_Avoid_: adjust, correct, fix

**Meal Time**:
A named time a Member eats ("Breakfast 7:30", "Work lunch 12:00"), set in Settings for the weekdays it applies to, with a calorie range. It is one of three kinds: **Fixed** (the meal is already decided, such as a work lunch, so its calories are set aside and the plan works around them), **Open required** (the plan must fill it), or **Open optional** (the plan may fill it, such as a snack). The name carries no meaning in the app.
_Avoid_: slot, breakfast/lunch/dinner as fixed categories, Eating Out

**Cook**:
One batch of a Recipe made on a given day. Its Portions are placed at several Meal Times (one Sunday chili feeds dinner plus two lunches), and the shopping list counts its ingredients once.
_Avoid_: batch, meal prep (as a noun)

**Busy Day**:
A tagged day when every meal must be quick: leftovers, eating out, or pre-cooked food.

**Prep Session**:
Weekend cooking planned ahead for later meals (for example Sunday cookies for the week's snacks). Its time counts on the weekend, not on the day the food is eaten.

**Favorites**:
Recipes and ingredients a Member likes, used by the Agent when planning. Starred by the Member, or added after the Agent asks.
_Avoid_: likes, saved

**Recipe**:
A named meal made of ingredients with amounts. Its calories come from its ingredients and are shared out by the weight of the cooked result, so a Portion's calories follow how much of it a Member eats. Cooking steps are a future phase.
_Avoid_: dish

**Kitchen Tools**:
The cooking equipment the Household owns (oven, air fryer, blender…). A Recipe that needs a missing tool is never put in the Meal Plan, though the Agent may mention it.
_Avoid_: equipment, appliances

**Schedule**:
An editable, per-Member setting for when the Agent acts on its own (weekly reflection and planning, recaps, meal-slot check-ins). Changed in the app or through chat.
_Avoid_: cron, timer

**Recap**:
A dashboard of how a Member did over a period (daily, weekly, monthly or a custom range), with the Agent's quick recommendations. The weekly Recap is the reflection that leads into planning.
_Avoid_: report, summary

**Stats**:
The full breakdown behind a Recap: each day's meals against the Meal Plan, a month calendar, and weekly tables. Opened from the Recap or the ☰ menu.
_Avoid_: analytics, history

**Check-in**:
A question the Agent raises on its own (leftovers, a skipped meal, an unbought ingredient), shown in chat and counted on the Chat tab's badge.
_Avoid_: nudge, reminder

**Activity Log**:
The list of every change the Agent made, each with an undo.
_Avoid_: history, audit

**Agent notes**:
A short list (at most 15 lines) of habits the Agent remembers about one Member, such as "hates Sunday meal prep". Saved only after the Member says yes, and visible and editable in Settings.
_Avoid_: memory, profile

## Relationships

- A **Household** has one or more **Members**, exactly one **Pantry**, and one **Meal Plan** per week
- A planned meal has one **Portion** per **Member** eating it
- Each **Member** has one **Calorie Target**, one **Calorie Log**, and their own **Preferences**
- A **Grocery List** is built from the upcoming **Meal Plan**'s **Missing Ingredients**
- A **Rebalance** changes the rest of today's **Meal Plan** for one **Member**, using what's left under their **Calorie Target**

## Flagged ambiguities

- "Restriction" (said by the Member) means a **hard** dislike; "Dislike" means a **soft** one.
- "Plan" was used for both the weekly meal plan and a calorie goal. Resolved: **Meal Plan** and **Calorie Target**.
