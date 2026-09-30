# Which AI model passes the bake-off?

Type: research
Status: open
Assignee:
Blocked by: 12, 16

## Question

#12 picks the cheapest model that handles this app's Agent correctly. Once the Agent's markdown files and tools exist, run about 20 real prompts through **gpt-5.4-mini**, **Gemini 3.8 Flash** (paid tier) and **Claude Sonnet 5.5** using the AI SDK. Examples: "2 eggs and toast" (split, look up FoodData Central, log), "swap Tuesday dinner", a Rebalance after going over, answering a Check-in, a Grocery List substitute, and the weekly reflection and planning. For each model, count the correct tool calls and correct calories, note any rule broken (hard Preferences, a meal below 50% of its share, a skipped meal proposed), and record the cost per prompt. Pick the cheapest model that gets them all right. The default until then is gpt-5.4-mini, with Sonnet 5.5 as the fallback. Keep the prompts as a repeatable test set for later model changes. Note that Gemini's promo price doubles from 2027-01-01.

## Comments
