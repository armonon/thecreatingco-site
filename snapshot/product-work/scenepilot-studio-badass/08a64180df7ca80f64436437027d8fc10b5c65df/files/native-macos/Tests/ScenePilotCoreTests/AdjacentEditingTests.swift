import XCTest
@testable import ScenePilotCore

final class AdjacentEditingTests: XCTestCase {
    func fixture(fps: Int = 30) -> Project {
        var p = Project(name: "Adjacent editing")
        p.sequences[0].frameRate = fps
        let media = Media(path: "/tmp/adjacent-source.mov", duration: 60, hasVideo: true, hasAudio: true)
        p.media = [media]
        let lane = p.sequences[0].tracks[0].id
        p.sequences[0].videoClips = (0..<3).map { index in
            var c = Clip(assetId: media.id, trackId: lane, start: Double(index * 4), duration: 4, id: "clip-\(index)")
            c.sourceStart = 5; c.rate = Double(index + 1); return c
        }
        p.sequences[0].videoClips.append(Clip(assetId: media.id, trackId: p.sequences[0].tracks[1].id, start: 2, duration: 5, id: "other-track"))
        return p
    }

    func testRollPreservesOuterBoundsAndRateAdjustedSourceOut() throws {
        for fps in [24,25,30,50,60] {
            for frames in [-2, -1, 1, 2] {
                let p = fixture(fps: fps), delta = Double(frames) / Double(fps)
                let next = try Edit.roll(p, sequenceId: p.mainSequenceId, clipId: "clip-0", by: frames)
                let before = p.sequences[0].videoClips, after = next.sequences[0].videoClips
                XCTAssertEqual(after[0].duration, 4 + delta, accuracy: 1e-9)
                XCTAssertEqual(after[0].start, 0); XCTAssertEqual(after[0].sourceStart, 5)
                XCTAssertEqual(after[1].start, after[0].start + after[0].duration, accuracy: 1e-9)
                XCTAssertEqual(after[1].sourceStart, 5 + delta * 2, accuracy: 1e-9)
                XCTAssertEqual(after[1].sourceStart + after[1].duration * after[1].rate, 13, accuracy: 1e-9)
                XCTAssertEqual(after[1].start + after[1].duration, 8, accuracy: 1e-9)
                XCTAssertEqual(after[2], before[2]); XCTAssertEqual(after[3], before[3])
                XCTAssertEqual(next.sequences[0].duration, p.sequences[0].duration)
            }
        }
    }

    func testSlidePreservesSelectedSourceAndAllOuterBounds() throws {
        for frames in [-30, -1, 1, 30] {
            let p = fixture(), delta = Double(frames) / 30
            let next = try Edit.slide(p, sequenceId: p.mainSequenceId, clipId: "clip-1", by: frames)
            let a = next.sequences[0].videoClips
            var expected = p.sequences[0].videoClips[1]; expected.start += delta
            XCTAssertEqual(a[1], expected)
            XCTAssertEqual(a[0].start, 0); XCTAssertEqual(a[0].duration, 4 + delta, accuracy: 1e-9)
            XCTAssertEqual(a[2].start, 8 + delta, accuracy: 1e-9)
            XCTAssertEqual(a[2].sourceStart, 5 + delta * 3, accuracy: 1e-9)
            XCTAssertEqual(a[2].sourceStart + a[2].duration * a[2].rate, 17, accuracy: 1e-9)
            XCTAssertEqual(a[2].start + a[2].duration, 12, accuracy: 1e-9)
            XCTAssertEqual(a[3], p.sequences[0].videoClips[3])
            XCTAssertEqual(try Project.decode(next.encoded()), next)
        }
    }

    func testRollSlideUndoAndRedoAreSingleTransactions() throws {
        let p = fixture()
        var h = DocumentHistory(p)
        let roll = try Edit.roll(p, sequenceId: p.mainSequenceId, clipId: "clip-0", by: 1)
        try h.apply(roll); h.undo(); XCTAssertEqual(h.project, p); XCTAssertFalse(h.canUndo)
        h.redo(); XCTAssertEqual(h.project, roll)
        let slide = try Edit.slide(roll, sequenceId: p.mainSequenceId, clipId: "clip-1", by: -1)
        try h.apply(slide); h.undo(); XCTAssertEqual(h.project, roll); h.redo(); XCTAssertEqual(h.project, slide)
    }

    func testLocksGapsOverlapsAndMissingNeighborsRefuseWithoutMutation() throws {
        let original = fixture()
        for variant in 0..<4 {
            var p = original
            if variant == 0 { p.sequences[0].tracks[0].locked = true }
            if variant == 1 { p.sequences[0].videoClips[1].start += 0.1 }
            if variant == 2 { p.sequences[0].videoClips[1].start -= 0.1 }
            if variant == 3 { p.sequences[0].videoClips.remove(at: 0) }
            let snapshot = p
            XCTAssertThrowsError(try Edit.roll(p, sequenceId: p.mainSequenceId, clipId: "clip-0", by: 1))
            XCTAssertThrowsError(try Edit.slide(p, sequenceId: p.mainSequenceId, clipId: "clip-1", by: 1))
            XCTAssertEqual(p, snapshot)
        }
        XCTAssertThrowsError(try Edit.roll(original, sequenceId: original.mainSequenceId, clipId: "clip-2", by: 1))
        XCTAssertThrowsError(try Edit.slide(original, sequenceId: original.mainSequenceId, clipId: "clip-0", by: 1))
        XCTAssertThrowsError(try Edit.slide(original, sequenceId: original.mainSequenceId, clipId: "clip-2", by: 1))
    }

    func testHandlesAndMinimumFrameAreEnforced() throws {
        var p = fixture()
        // The right clip cannot reveal media before source time zero.
        p.sequences[0].videoClips[1].sourceStart = 0
        XCTAssertThrowsError(try Edit.roll(p, sequenceId: p.mainSequenceId, clipId: "clip-0", by: -1))
        p = fixture(); p.sequences[0].videoClips[2].sourceStart = 0
        XCTAssertThrowsError(try Edit.slide(p, sequenceId: p.mainSequenceId, clipId: "clip-1", by: -1))
        p = fixture(); p.media[0].duration = 17; p.sequences[0].videoClips[0].sourceStart = 13
        XCTAssertThrowsError(try Edit.roll(p, sequenceId: p.mainSequenceId, clipId: "clip-0", by: 1))
        XCTAssertThrowsError(try Edit.slide(p, sequenceId: p.mainSequenceId, clipId: "clip-1", by: 1))
        p = fixture()
        for frames in [-120, 120, Int.max, Int.min] {
            XCTAssertThrowsError(try Edit.roll(p, sequenceId: p.mainSequenceId, clipId: "clip-0", by: frames))
            XCTAssertThrowsError(try Edit.slide(p, sequenceId: p.mainSequenceId, clipId: "clip-1", by: frames))
        }
        p.sequences[0].videoClips[1].sourceStart = 10 // Enough left handles at 2× speed.
        let oneFrame = try Edit.roll(p, sequenceId: p.mainSequenceId, clipId: "clip-0", by: -119)
        XCTAssertEqual(oneFrame.sequences[0].videoClips[0].duration, 1 / 30.0, accuracy: 1e-9)
    }

    func testNeighborFadesClampButSelectedSlideEnvelopeSurvives() throws {
        var p = fixture()
        p.sequences[0].videoClips[1].fadeIn = 3; p.sequences[0].videoClips[1].fadeOut = 1
        p.sequences[0].videoClips[1].fadeWindow = FadeWindow(offset: 1, duration: 5)
        p.sequences[0].videoClips[2].fadeIn = 3; p.sequences[0].videoClips[2].fadeOut = 1
        let slide = try Edit.slide(p, sequenceId: p.mainSequenceId, clipId: "clip-1", by: 30)
        XCTAssertEqual(slide.sequences[0].videoClips[1].fadeWindow, p.sequences[0].videoClips[1].fadeWindow)
        XCTAssertEqual(slide.sequences[0].videoClips[2].fadeIn, 3)
        XCTAssertEqual(slide.sequences[0].videoClips[2].fadeOut, 0)
        let roll = try Edit.roll(p, sequenceId: p.mainSequenceId, clipId: "clip-0", by: 30)
        XCTAssertNil(roll.sequences[0].videoClips[1].fadeWindow)
        XCTAssertEqual(roll.sequences[0].videoClips[1].fadeOut, 0)
        XCTAssertEqual(try Edit.roll(p, sequenceId: p.mainSequenceId, clipId: "clip-0", by: 0), p)
        XCTAssertEqual(try Edit.slide(p, sequenceId: p.mainSequenceId, clipId: "clip-1", by: 0), p)
    }

    func testUnsortedCanonicalArrayIsNotReordered() throws {
        var p = fixture(); p.sequences[0].videoClips.reverse()
        let next = try Edit.slide(p, sequenceId: p.mainSequenceId, clipId: "clip-1", by: 1)
        XCTAssertEqual(next.sequences[0].videoClips.map(\.id), p.sequences[0].videoClips.map(\.id))
    }

    func testTrackLocksAreEnforcedByCoreNotJustMenus() throws {
        var p = fixture(); p.sequences[0].tracks.insert(Track(name: "Middle"), at: 1)
        let id = p.sequences[0].tracks[0].id
        p.sequences[0].tracks[1].locked = true
        XCTAssertThrowsError(try Edit.moveTrack(p, sequenceId: p.mainSequenceId, trackId: id, by: 1))
        XCTAssertThrowsError(try Edit.moveTrack(p, sequenceId: p.mainSequenceId, trackId: id, by: Int.max))
        p.sequences[0].tracks[1].locked = false; p.sequences[0].tracks[0].locked = true
        XCTAssertThrowsError(try Edit.moveTrack(p, sequenceId: p.mainSequenceId, trackId: id, by: 1))
        p.sequences[0].tracks[0].locked = false
        let down = try Edit.moveTrack(p, sequenceId: p.mainSequenceId, trackId: id, by: Int.max)
        XCTAssertEqual(down.sequences[0].tracks.last?.id, id)
        let up = try Edit.moveTrack(down, sequenceId: p.mainSequenceId, trackId: id, by: Int.min)
        XCTAssertEqual(up, p)
    }
}
