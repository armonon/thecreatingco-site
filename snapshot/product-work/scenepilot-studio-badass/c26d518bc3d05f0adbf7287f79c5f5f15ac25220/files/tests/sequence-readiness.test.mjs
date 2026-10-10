import assert from "node:assert/strict";
import test from "node:test";
import { autoPreviewStatusLabel, hasRenderableSequence, shotMatchSequenceCount } from "../lib/sequence-readiness.ts";

test("auto preview reflects analysis, built edits, and media-ready states", () => {
  assert.equal(autoPreviewStatusLabel({ hasMainMedia: false, assetCount: 0, placementCount: 0, baseCutCount: 0 }), "WAITING FOR MEDIA");
  assert.equal(autoPreviewStatusLabel({ hasMainMedia: true, assetCount: 0, placementCount: 0, baseCutCount: 0 }), "MEDIA READY");
  assert.equal(autoPreviewStatusLabel({ hasMainMedia: true, assetCount: 3, placementCount: 12, baseCutCount: 0 }), "12 HITS READY");
  assert.equal(autoPreviewStatusLabel({ hasMainMedia: true, assetCount: 1, placementCount: 0, baseCutCount: 4 }), "4 CUTS READY");
  assert.equal(autoPreviewStatusLabel({ hasMainMedia: false, hasCompositionContent: true, assetCount: 0, placementCount: 1, baseCutCount: 0 }), "1 COMP READY");
  assert.equal(autoPreviewStatusLabel({ hasMainMedia: true, assetCount: 1, placementCount: 0, baseCutCount: 4, analyzing: true }), "ANALYZING MEDIA");
});

test("renderable sequences include placement-driven and montage-driven edits", () => {
  assert.equal(hasRenderableSequence({ hasMainMedia: false, assetCount: 2, placementCount: 10, baseCutCount: 0 }), true);
  assert.equal(hasRenderableSequence({ hasMainMedia: false, hasCompositionContent: true, assetCount: 0, placementCount: 1, baseCutCount: 0 }), true);
  assert.equal(hasRenderableSequence({ hasMainMedia: true, assetCount: 2, placementCount: 10, baseCutCount: 0 }), true);
  assert.equal(hasRenderableSequence({ hasMainMedia: true, assetCount: 2, placementCount: 0, baseCutCount: 3, montageEnabled: true }), true);
  assert.equal(hasRenderableSequence({ hasMainMedia: true, assetCount: 2, placementCount: 0, baseCutCount: 3, montageEnabled: false }), false);
});

test("clip-first sequences render without a main source, but bin-only and disabled edits do not", () => {
  for (const hasMainMedia of [false, true]) {
    assert.equal(hasRenderableSequence({ hasMainMedia, assetCount: 3, placementCount: 0, baseCutCount: 2 }), true);
    assert.equal(hasRenderableSequence({ hasMainMedia, assetCount: 3, placementCount: 0, baseCutCount: 0 }), false);
    assert.equal(hasRenderableSequence({ hasMainMedia, assetCount: 3, placementCount: 0, baseCutCount: 2, montageEnabled: false }), false);
    assert.equal(hasRenderableSequence({ hasMainMedia, assetCount: 3, placementCount: 1, baseCutCount: 2, montageEnabled: false }), true);
  }
});

test("shot-match count prefers V1 cuts but falls back to placement-built edits", () => {
  assert.equal(shotMatchSequenceCount(6, 20), 6);
  assert.equal(shotMatchSequenceCount(0, 20), 20);
  assert.equal(shotMatchSequenceCount(0, 0), 0);
});
