# ScenePilot release qualification

ScenePilot release claims fail closed. Passing unit tests or producing a build is necessary but does not prove that an editor feels predictable, a long roto stays on the same person, or a preview visually matches its export.

## Automated evidence pack

Run the standard qualification campaign:

```bash
npm run qa:product
```

It records TypeScript/lint, the deterministic regression suite, Electron's background
direct-to-disk stream, the worker-safe PCM mix/encode path, Chromium/FFmpeg pixel parity,
generated real-media native rendering, long-form roto-memory behavior, 4K/20,000-clip and
eight-track PCM performance budgets, and the Browser Lite production build. Reports and complete
logs are written under ignored `outputs/qualification/` directories.

Use `--full` for both production targets, a ten-minute generated mixed-format native export,
repeated 4K exports/cancellation/interrupted-save
checks, and (on macOS) an isolated 32 MB disk-full save/retry test:

```bash
npm run qa:product -- --full
```

The generated `qualification-report.json` contains machine information, elapsed times, evidence paths, every gate, and one release verdict. The verdict remains `pending` until the perceptual review is signed.

## Perceptual evidence

The evidence pack contains `review-instructions.md` and `perceptual-review.json`. A reviewer must use real, licensed footage, complete every task, attach evidence, identify the exact app commit, and record the SHA-256 of the source-media bundle.

Keep the generated `appSourceSha256`: review approval is bound to the actual candidate
source, not merely a manually entered commit. Evidence paths must name existing,
nonempty files beneath the review JSON's directory (no outside paths or escaping
symlinks). Copy the review and its evidence together when handing it to CI. Task IDs
must be unique; a missing attachment, changed candidate, malformed score, or missing
reviewer invalidates the approval. Documentation-only changes do not invalidate the
source fingerprint. Changing source during qualification fails the candidate check.

After packaging, run `node scripts/certify-package.mjs`. This checks bundled source,
models, notices, native engine discovery and signatures, and separately reports
Developer ID/Gatekeeper acceptance. A locally valid ad-hoc signature is not approval
to distribute publicly. This check does not substitute for a clean-machine install.

Once completed, enforce the release gate:

```bash
npm run qa:product:release -- --full --review=/absolute/path/perceptual-review.json
```

Exit code `1` means automated failure. Exit code `2` means automated evidence passed but required perceptual evidence is missing or incomplete. Only exit code `0` means the release gate passed.

## Blind comparisons

For color, roto, motion, audio, or UI changes where expectation bias matters, create a JSON manifest:

```json
{
  "comparisons": [
    {
      "id": "roto-hair-01",
      "leftPath": "baseline.mp4",
      "rightPath": "candidate.mp4",
      "question": "Which result has the cleaner temporally stable hair edge?"
    }
  ]
}
```

Then prepare a randomized review pack:

```bash
npm run qa:blind-review -- --manifest=/absolute/path/comparisons.json --seed=release-43
```

Give only the generated `reviewer/` directory to the evaluator. Keep `private/review-key.json` hidden until the completed scores are locked.

Human evaluation may remain pending while unrelated engineering continues, but a pending review can never be represented as a passed professional release.
