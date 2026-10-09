# StemDeck dependency security review — 2026-10-07

Reviewer: native GPT-6.1 Sol child, independent of patch author. This is not a Sonnet review; the parent reported Sonnet unavailable for insufficient provider credits. Task ownership/lease remains with parent CORE-STEMDECK-SEC-001. No queue, source, authentication, payment, access, credentials, deployment or push changes performed.

## Identity and scope

- Checkout `/Users/agentsattari/code/core-product-lab/stemdeck`, branch `core-lab/stemdeck-audit-20261007`, HEAD `8c06f816e47bc2405e20f8941e19a4697d5c7c3f`.
- Reviewed company/lab AGENTS.md and DIRECTIVE.md. Scoped local dependency repair is authorized; broader Sattari/access/payment behavior is not.
- `git diff --stat`: only package-lock.json, 10 additions / 6 deletions. Exactly proxy-addr 2.0.7 → 2.0.8 and source-map-js 1.2.1 → 1.2.2, corresponding resolved URLs/integrities, and proxy-addr funding metadata. No package.json changes, dependency-edge changes or application-source changes. Existing dependency ranges accommodate both patch upgrades.
- Installed versions independently checked: proxy-addr 2.0.8, source-map-js 1.2.2. Runtime `/opt/homebrew/opt/node@22/bin/node`, v22.23.2.

## Security evidence

Read parent-generated `stemdeck-audit-before.json` and `stemdeck-audit-after.json`: critical GHSA-jqcg-44mw-7w3h affects proxy-addr <2.0.8; high GHSA-68fv-2mgg-jv7q affects source-map-js <1.2.2. After-report has zero vulnerabilities and unchanged dependency totals (586). This is review of saved npm audit evidence, not a claim of independent advisory lookup or production qualification.

proxy-addr is an Express transitive runtime dependency; source-map-js is marked dev-only. The staff Netlify login path directly imports neither upgraded package; its revocation and throttle decisions are implemented in unchanged local server modules. source-map-js may participate in test/build tooling, so dependency non-import alone is not proof of no indirect effects.

## Failed test investigation: exact evidence

Parent baseline: 2233 passed. Parent patched full run: 2232 passed / 1 failed, expected 429 but actual 200 at staff-login.test.js:173, test `stops exempting every device after "sign out everywhere"`. Saved full run starts 16:59:42 and lasts 89.38 seconds, spanning 17:00, a fixed 15-minute throttle-window boundary. Exact per-attempt timestamps are absent, so this historical failure cannot be conclusively attributed from the log alone.

Parent focused rerun: 16/16 passed, start 17:01:37. Independent command:

```
/opt/homebrew/opt/node@22/bin/node node_modules/vitest/vitest.mjs run tests/netlify-functions/staff-login.test.js --reporter=dot
```

Independent result: 16/16 passed, start 17:02:35, duration 3.89 seconds.

Code evidence: `server/loginThrottle.js` computes `Math.floor(now / GLOBAL_WINDOW_MS)` where GLOBAL_WINDOW_MS is 900000. On a new window it resets the global count to zero. The test performs 30 wrong-password attempts using real Date.now (each password check uses synchronous scrypt), then expects the next sign-in to be globally throttled. It does not pin the clock; crossing a window invalidates that expectation even when revocation works correctly.

### Deterministic experiment without editing source

Using programmatic Vitest, an in-memory pre-transform selected only the failing test and inserted a Date.now spy after revokeAllSessions. Same installed patched dependencies, same source/auth behavior. Clock 1791392399999 has offset 899999 within its 900000-ms window. Control holds that clock fixed; treatment advances it by 2 ms after attempt index 14, putting 15 guesses in each window. Control: 1 passed / 15 skipped (1.27 seconds). Treatment: 1 failed / 15 skipped (1.02 seconds), reproducing exactly expected 429 / actual 200. Output emitted `REVIEW_EXPERIMENT FIXED_WINDOW [{"state":"pass"}]` and `REVIEW_EXPERIMENT CROSSES_WINDOW [{"state":"fail"}]`.

Exact executable experiment (run from checkout using Node22 `--input-type=module`):

```js
import { createVitest } from 'vitest/node';
const target = '/tests/netlify-functions/staff-login.test.js';
for (const crossing of [false, true]) {
  const ctx = await createVitest('test', {
    root: process.cwd(), run: true, maxWorkers: 1, reporters: ['dot'],
  }, { plugins: [{ name: 'review-clock-boundary', enforce: 'pre', transform(code, id) {
    if (!id.endsWith(target)) return;
    let out = code.replace(
      `it('stops exempting every device after "sign out everywhere"'`,
      `it.only('stops exempting every device after "sign out everywhere"'`
    );
    out = out.replace(
      `await revokeAllSessions({});\n    for (let i = 0; i < THROTTLE_SETTINGS.GLOBAL_LIMIT; i += 1) await wrong(\`10.9.2.\${i}\`);`,
      `await revokeAllSessions({});\n    let clock = 1791392399999;\n    vi.spyOn(Date, 'now').mockImplementation(() => clock);\n    for (let i = 0; i < THROTTLE_SETTINGS.GLOBAL_LIMIT; i += 1) { await wrong(\`10.9.2.\${i}\`); ${crossing ? 'if (i === 14) clock += 2;' : ''} }`
    );
    if (out === code) throw Error('Transform not applied');
    return out;
  }}] });
  await ctx.start(['tests/netlify-functions/staff-login.test.js']);
  console.log('REVIEW_EXPERIMENT', crossing ? 'CROSSES_WINDOW' : 'FIXED_WINDOW',
    JSON.stringify(ctx.state.getFiles().map(f => ({ state: f.result?.state }))));
  await ctx.close();
}
process.exitCode = 0; // experiment intentionally contains a failing treatment
```

## Conclusion and next action

The dependency repair is narrow and addresses both saved advisories. A pre-existing real-clock/fixed-window mismatch is deterministically demonstrated and explains the exact failure signature without changing dependencies or auth behavior. Strong evidence favors test timing over dependency regression; do not call the historical failure conclusively proven or the entire patched suite green.

Keep the security patch isolated. Parent should retain full-run failure plus both focused passes and this experiment as evidence, then rerun required full checks at a non-boundary time or with separately reviewed test clock stabilization. Track a separate test-reliability issue: pin/restore Date.now for global-throttle tests and explicitly test rollover. No production auth defect is established here, and no access/payment behavior change is recommended or authorized. Existing PR/release gates remain; this is not deployment approval.

### Suggested test-only stabilization, validated in memory

Parent explicitly confirmed test-only clock stabilization is authorized QA scope. No source edits were made while parent's full run was active. Minimal patch suggestion inside the affected test:

```js
const clock = vi.spyOn(Date, 'now').mockReturnValue(1_791_392_400_000);
try {
  // Existing test body unchanged: first login, revoke, guesses, assertion.
} finally {
  clock.mockRestore();
}
```

This timestamp starts a fixed window and covers the complete test; real timers remain enabled. Programmatic Vitest pre-transform applied exactly this wrapper only to the affected test in memory (without .only), then ran the entire staff-login.test.js suite: 16/16 passed, start 17:04:10, duration 3.85 seconds. Suggested patch therefore has independent focused-suite verification, but still requires parent application and any required full checks. It is an optional separate QA change, not part of the reviewed lock-only diff.
