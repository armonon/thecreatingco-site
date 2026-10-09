# Form audit evidence bundle

Source baseline: detached worktree commit `b5abdd1de5f71fe0244ef9a651a6d983067541ff`; local development server served `/studio`. Screenshots are synthetic/default local project UI, not a customer's data or a desktop/live release capture.

- `form-model-ui.png` — inspected Model workspace, captured with Google Chrome headless + SwiftShader WebGL at 1440×1000. SHA-256 `f9de66836e61217bbd8e5a0c892b049063b31cd95a5b28ffa3f78517b79f2bef`.
- `form-studio-swiftshader.png` — Start Center capture prior to setting the onboarding-complete local preference. SHA-256 `fb47a89555c96d13d7574dbcdeb5af2171cd746d432acbf2dadc73a798d83202`.
- `form-studio.png` — first default-headless capture shows the WebGL context runtime error with GPU disabled; SwiftShader resolved rendering for the inspected screenshot. This is a headless-browser limitation signal, not evidence of a supported-device GPU defect.
- `workspace-smoke-node22.log` — full isolated workspace-smoke output (92/100 pass; eight assertions fail as detailed in the report).
- `unit-node22.log` — full isolated Node 22 unit repeat (1,518 pass / 8 fail; exact names in report).

- `npm-audit-production.json` — raw `npm audit --omit=dev --json` output from the isolated source worktree; exit 1 with 3 advisories.
- `build-node22.log` — captured Node 22.23.2 web production build output; exit 0 with documented chunk/externalization/route-analysis warnings.
