# How does food get into the Calorie Log?

Type: prototype
Status: open
Assignee:
Blocked by:

## Question

Make a rough mock-up of logging food and react to it. #02 set how "2 eggs and toast" becomes items with calories (the LLM splits it, FoodData Central looks each item up, and an LLM estimate is marked as estimated). #09 put a + quick-entry button next to the Agent chat box. #04 subtracts food from the Pantry only after the Member confirms it came from there. What does the confirmation look like before the food lands in the Calorie Log: a card with each item, its grams and calories, and which meal slot it goes in? Is the + button the same flow as chat or a separate form? How does a Member fix a wrong match or amount, both before confirming and after it's logged? How is an estimated item shown, and can it be swapped for a Food Library match? How do eating out, a planned meal eaten "as planned", and food logged for the other Member (#13) fit in?

Cost angle (#17): chat food logging is the biggest AI job (~28%), and ~55% of the AI bill is the uncached start of each Agent turn. Can a Member log straight from a Food Library search with no Agent call at all, with the Agent only used for free text or foods the library doesn't have yet? How good does the search need to be (typos, synonyms like "eggs" vs "egg, whole, raw", recent and frequent foods first, Dishes as well as single foods) for that to be the default path?
