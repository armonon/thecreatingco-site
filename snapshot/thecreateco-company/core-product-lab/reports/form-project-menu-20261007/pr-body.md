## Repair
- Keep Project/Open/Export inside desktop viewports by sizing action columns to their content instead of equal-width side columns.
- Preserve Back/Form identity and all compact controls, including the suite menu; repair compact cascade sizing and provide a third header row at 320px.
- Add a real-browser regression with actual OCCT geometry, menu-driven Save/Open, keyboard STEP export, GLB download and Escape focus restoration. No forced clicks or native mocks.

## Verification
- Pinned Node22.23.2: typecheck/lint, web and desktop frontend builds PASS; unit1527/1527, budgets15/15 PASS; production audit0.
- Fine and emulated coarse-pointer modes, widths1440/1280/1100/768/390/320: actual save/open field comparison, keyboard STEP and GLB downloads PASS, zero page errors. Repeated against the built frontend.
- Independent OpenAI review approved CSS and regression script with no blocking findings.
- STEP/GLB signature/length checks here prove download validity, not independent output geometry fidelity; earlier PR4 contains separate geometry proof.
- Initial Node26 default-run jsdom/localStorage failures retained as environment findings; no assertions removed. Qualified suite uses the same Node22 baseline as the prior checkpoint.

## Release status
Stacked on PR4. No merge/deploy or workflow retry. Required remote CI is still blocked by GitHub account billing/spending; passing local checks does not override that gate.
