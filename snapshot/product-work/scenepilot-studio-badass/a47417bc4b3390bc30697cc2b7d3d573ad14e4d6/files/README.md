# ScenePilot Studio

ScenePilot is a beat-aware music video editor that analyzes video or audio,
builds an editable first cut, and carries that arrangement into a professional
timeline and layered motion-composition workflow.

## Product editions

- **Browser Lite** is the focused, private first-cut editor: Auto Director,
  Master Sequence and local 1080p H.264 delivery.
- **Desktop Pro** adds multi-track video and audio, decoded waveforms, clip
  volume automation, professional trim tools, nested compositions, masks,
  parenting, nulls, precomps, value graphs, semantic person and arbitrary-object
  rotoscoping, media bins, proxies, recovery history, 4K profiles and a
  persistent render queue.

Source media remains on the editor's machine in both editions.

## Development

```bash
npm install
npm run dev:web   # editor with HMR at http://localhost:5173
```

The editor is a client-side app, so `npm run dev:web` (plain Vite) is the
fastest way to work on it. Open it in **Chrome or Edge** (rendering uses
WebCodecs).

`npm run dev` starts the full vinext/RSC + Cloudflare Worker dev server, but a
current framework bug breaks client hydration in that mode — use `dev:web` for
the editor. The production/worker build is unaffected:

```bash
npm run build && npm run start   # production server at http://localhost:3000
```

## Validation

```bash
npm test
npm run lint
```

## macOS application

```bash
npm run desktop:dist
```

This command makes an ad-hoc-signed Apple Silicon **preview**, not a notarized public release. The app checks the public GitHub Releases channel at startup and through **Help → Check for Updates**.

Public packaging runs only for version tags or manual release dispatch, not every
push to `main`. It requires the completed `docs/release-review.json` qualification
record, a Developer ID Application identity (`MACOS_SIGNING_IDENTITY` / `CSC_NAME`),
the signing certificate/password, and Apple notarization credentials. Missing
qualification or credentials stop publication instead of silently shipping an
unnotarized installer. See `docs/release-qualification.md` for the review format.
