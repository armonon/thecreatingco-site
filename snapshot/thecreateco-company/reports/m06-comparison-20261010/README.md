# M06 — comparison-page opportunities (internal recommendation)

**Date:** 2026-10-10 (Pacific)  
**Scope:** bounded desk research for useful, truthful comparison-page candidates. This is not demand/SEO research, customer validation, product qualification, or authorization to publish. Unknown demand and search volume remain unknown.

## Recommendation

Prioritize one draft concept: **“Glyph Studio vs Calligraphr vs Glyphr Studio: which custom-font workflow fits?”** Frame it as a task-fit guide, not a winner/loser page. These are real, directly overlapping browser font-making alternatives, and their published differences can be described concretely. Our existing evidence is unusually specific for the first-font/export path, but is still a narrow subset—not full product readiness.

Keep two candidates in reserve, gated on evidence:

1. **“Browser stem splitter vs Fadr: what can you do free, and what output do you need?”** Only invest after the already-owned Split quality/device benchmark supplies a supported-job result. Current official Fadr material establishes feature/price tiers, not comparative output quality.
2. **“Local captions workflow vs Kapwing: editing/export trade-offs”** is a lower-priority candidate. Our captions path has meaningful lifecycle/output gaps, so a fair page would currently mostly explain why it is not yet an equivalent alternative. Revisit after existing PROGRAM18-CAPTIONS-LIFECYCLE-001 work; do not create a new product or duplicate that task.

No traffic, ranking, search-volume, conversion, or buyer-intent dataset was accessed. The ordering is based on evidence/readiness and page usefulness, **not** estimated SEO opportunity.

## Opportunity comparison

| Rank | Candidate page | What a reader could compare factually now | Our qualification boundary | Decision |
|---|---|---|---|---|
| 1 | Glyph Studio vs Calligraphr vs Glyphr Studio | Draw/edit glyphs and export a font vs Calligraphr's documented tier limits vs Glyphr Studio's free, browser-based editor/import/export positioning. Pricing/features are volatile; show retrieval date and link official sources. | Narrow standalone Glyph fixture: drawn A/V/H/o plus kerning, portable project, save/restore, TTF/OTF/SVG; actual Inkscape CLI use/reopen evidence. Not broad OS install, Figma/Adobe/Canva compatibility, every character, or all font-production needs. | Prepare fact-checkable draft outline; retain existing free core. Do not call Glyph “best” absent reader criteria. |
| 2 | Split vs Fadr | Official Fadr Basic/Plus descriptions and price; Split's intended local/browser workflow can be explained only to the extent supported in existing project evidence. | Split remains an unqualified candidate for separation quality, representative devices, recovery, and end-to-end use; existing PROGRAM18-SPLIT-SESSION-001 owns that proof. No output-quality win, speed win, or cheaper total-cost claim established. | Wait for benchmark; then decide whether a comparison is genuinely useful. |
| 3 | Captions vs Kapwing | Kapwing's official tier page states watermark/720p/4-minute Free exports and paid auto-subtitling limits; useful reference for workflow constraints. | Our Captions has no current qualified real-speech/edit/reopen/output journey; MP4 delivery is not proven in the inspected path (WebM burn-in limitations noted in prior audit). The Oct 7 working-tree snapshot also had 193 dirty/untracked entries, so source observations are not attributed cleanly to HEAD. | Defer until the existing lifecycle task resolves gaps; no equivalence claim now. |

## Claims matrix: supported vs unknown/unsafe

| Topic | Supported factual claim (with scope/date) | Unknown or unsafe claim to avoid |
|---|---|---|
| Glyph — our workflow | The Oct 7 report documents pointer-drawn A/V/H/o, kerning, portable project and save/restore/export; the Oct 7 destination report documents actual TTF/OTF/SVG and fixture use in Inkscape 1.4.2 macOS CLI. | “Works in every font app/OS,” manual installation is frictionless, or the full product/release is ready. Figma, Adobe, Canva, physical mobile/touch, Windows/Linux and manual font installation were not established there. |
| Glyph — alternatives | On 2026-10-10, Calligraphr's official pricing page returned 200 and listed Free/Pro limits (75/600 characters, 1/20 concurrent fonts; $10 for one month or $6/month for a six-month upgrade). Glyphr Studio's official home page returned 200 and describes itself as free/open-source/browser-based, no signup, with SVG/OTF/TTF/WOFF import and font export. | Competitors are inferior, less capable, less private, slower, or have worse output. No comparative product test was run. Do not imply price parity or stable pricing without dated citations. |
| Split — alternatives | Fadr's official home page returned 200 on 2026-10-10: Basic is free and lists basic stems/MP3; Plus is listed as $10/month or $100/year with broader stem categories. Prior Oct 7 official-source audit also records upload/output tier details. | Our separator is higher quality/faster/more private or supports a particular media/device range better. These have not been demonstrated by a controlled benchmark. “Local” alone is not a quality or privacy-superiority result. |
| Captions — alternatives | Kapwing official pricing page returned 200 on 2026-10-10: Free export watermark, up to 4 minutes and 720p; listed auto-subtitling allowance up to 10 minutes Free and up to 1,000 minutes/month Pro, with Pro $16/member/month annual or $24 monthly. | Direct equivalent feature comparison, better accuracy, better output, lower total cost, or an upload/privacy claim. No matched-workflow comparison or our complete output lifecycle was verified. |
| Market opportunity | None. | Search volume, demand, ranking likelihood, CAC, sales, conversion, or revenue. No keyword tool, analytics baseline, customer interviews, or current sales dataset was used for M06. |

## Sources and evidence

### Internal capability/limit evidence

- [Focused web utilities README](../2026-10-07-web-utilities/README.md), dated Oct 7 Pacific: competitor anchors and no measured market-size/search-volume dataset.
- [Asset readiness](../2026-10-07-web-utilities/asset-readiness.md), inspected Oct 7–8: precise Glyph, Split, and Captions scope; existing task ownership; Glyph fixture evidence; Split/Captions limitations.
- [Audio market audit](../2026-10-07-web-utilities/audio-market.md), accessed Oct 7: official Fadr tier summary, explicit note that quality statements are not independent measurements, and proposed bounded benchmark gates.
- [Glyph destination qualification](../glyph-destination-20261007/README.md), dated Oct 7: narrow real destination proof and explicit untested destinations/limitations.

### Deterministic official-source retrieval receipts

Retrieved 2026-10-10 UTC with Python `urllib.request.urlopen`, explicit 12-second timeout, 2 MB read cap, and HTML text extraction. Each JSON stores URL, retrieval time, HTTP status/final URL, content type, byte count, and short relevant excerpts (not a full-page dump):

- [Calligraphr pricing receipt](calligraphr_pricing.json) — `https://www.calligraphr.com/en/pricing/` (200).
- [Glyphr Studio home receipt](glyphr_home.json) — `https://www.glyphrstudio.com/` (200).
- [Fadr home receipt](fadr_home.json) — `https://fadr.com/` (200).
- [Kapwing pricing receipt](kapwing_pricing.json) — `https://www.kapwing.com/pricing` (200).

Receipts are snapshots of the fetched pages, not guarantees of current terms. Confirm official pages again immediately before drafting/publishing any price or feature comparison.

## Validation plan and next action

1. Draft only the Glyph comparison outline first: define reader jobs (short personal lettering vs broader font construction/import/export), cite each claim inline, and include a “choose by workflow” table. Explicitly say the sample fixture and tested destination are narrow. Preserve competitor caveats and links.
2. Fact-check every changing feature/price against the linked official pages on draft day. Do not add uncited unsupported competitor claims or inferred search keywords/volume. Keep the page unpublished; no publication authority was part of M06.
3. Have an independent reviewer audit claim-to-source mapping and product-scope wording. If the page cannot help a reader choose without claiming a winner, stop rather than pad it.
4. Next concrete action: prepare the unpublished Glyph outline against the two font-competitor receipts and internal Glyph evidence, then use the existing authorized marketing/content review path to decide whether it merits further work. Do not send messages, alter product/pricing, or duplicate Split/Captions qualification tasks.

**Status:** research complete; recommendation is internal/draft-only. No external messages, publication, product edits, pricing changes, purchases, or queue changes made.

## Director verification and checkpoint

Sol director (`openai/gpt-6.1-sol`, exposed by session status); bounded native worker requested `gpt-6-luna` (actual worker identity/usage not exposed). No Astra call.

2026-10-10 queue reconciliation: Split lifecycle remains BLOCKED, but its exact `e3f0123` was pushed on Oct 9; scoped 18 tests/types/lint/build passed, while native reload/quota, real inference/four-WAV/listening/device qualification remains absent. Captions lifecycle remains BLOCKED; `02c6ece` was pushed on Oct 9 with 16 deterministic tests, while pinned compiler, browser/codec and portable authored lifecycle remain unqualified. Earlier dirty-source counts are historical, not current checkout observations. These checkpoints do not establish a comparative product win or release readiness.

Director checked all four HTTP200 bounded-byte receipts and relevant excerpts against the report, matched Glyph scope to the dated destination evidence, and reconciled existing Split/Captions task gates without rerunning product workflows. Research acceptance met; not publication approval or independent release review. Cost preflight advisory decision: continue, unset budgets remain unknown and confer no new spend authority.

Push state: research-only report/receipts; no task-owned code edits or code commit resulted, so no push was needed. No merge, deployment, release or external message.
