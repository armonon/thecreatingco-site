## Scoped checkpoint

Preserve backdrop alpha for normal single-pass, neutral-BlendIf, unstyled adjustments at partial master/fill/pass opacity and with masks. Keep existing full-strength fast path and styled/non-normal behavior.

## Evidence

- Node22 engine: 1436 pass,10 skips; types and full strict lint pass.
- Actual renderer probes: Chromium/Firefox/WebKit 24/24 each; not full app UI qualification.
- 195840 grayscale/alpha observations: exact alpha, <=2 premultiplied-byte RGB error.
- Independent OpenAI review; report under company reports/luma-adjustment-variants-20261008.

## Gates and remaining scope

Stacked on PR8; do not merge unqualified downstack work. Full production/native builds not run at this checkpoint due nearly exhausted disk; prior-head builds do not qualify this head. Styled/non-normal/multi-pass/BlendIf, full UI persistence and product/platform qualification remain incomplete. No deployment, release, account changes, or Actions billing retry.
