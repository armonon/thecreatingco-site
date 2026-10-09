# OpenAI-only review policy — 2026-10-07

Owner instruction: Armon, #creative-council, message 1557556492570464297.
Use ChatGPT/OpenAI rather than Claude for all future reviews, including fallbacks.

Updated workspace AGENTS.md, company/lab directives and model routes, lab README,
company director + lab cycle + lab weekly live scheduled prompts (read back), and
marketing review routing, independent consensus and validation retries. Retained
non-review marketing creative routes and all reviewer caps/approval gates. Legacy
role keys remain for database compatibility; actual reviewer models are OpenAI.

If OpenAI is unavailable, reviews enter WAITING rather than switching to Claude.
22 marketing-engine tests pass, including every review route, independent two-model
consensus, unavailable-OpenAI behavior, and unchanged non-review provider fallback.
Log: review-routing-tests.log. Schedule receipts: ../automation/openai-review-policy-verified.json.
Historical briefs, execution receipts and failed Claude attempts were not rewritten.
Persistent preference: /Users/agentsattari/memory/review-model-preference.md.
