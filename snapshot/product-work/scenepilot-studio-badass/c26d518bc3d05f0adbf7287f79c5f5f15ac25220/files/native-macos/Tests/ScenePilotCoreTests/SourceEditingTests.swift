import XCTest
@testable import ScenePilotCore

final class SourceEditingTests: XCTestCase {
    func fixture() -> Project {
        var p = Project(); p.media = [Media(path: "/tmp/source.mov", duration: 30, hasVideo: true, hasAudio: true)]
        var clip = Clip(assetId: p.media[0].id, trackId: p.sequences[0].tracks[0].id, start: 0, duration: 10, id: "original")
        clip.sourceStart = 2; clip.rate = 2; clip.fadeIn = 4
        p.sequences[0].videoClips = [clip, Clip(assetId: p.media[0].id, trackId: p.sequences[0].tracks[1].id, start: 0, duration: 10)]
        return p
    }
    func edit(_ p: Project, _ mode: SourceEditMode) throws -> Project {
        try Edit.placeSource(p, sequenceId: p.mainSequenceId, assetId: p.media[0].id, trackId: p.sequences[0].tracks[0].id,
                             range: SourceRange(start: 1, end: 3), at: 3, mode: mode, clipId: "new")
    }
    func testInsertSplitsAndPreservesRateFadeAndOtherTracks() throws {
        let p = fixture(), next = try edit(p, .insert), clips = next.sequences[0].videoClips
        XCTAssertEqual(clips.count, 4); XCTAssertEqual(clips[0].duration, 3)
        XCTAssertEqual(clips[1].start, 5); XCTAssertEqual(clips[1].sourceStart, 8); XCTAssertEqual(clips[1].duration, 7)
        XCTAssertEqual(clips[1].fadeWindow, FadeWindow(offset: 3, duration: 10))
        XCTAssertEqual(clips[2], p.sequences[0].videoClips[1]); XCTAssertEqual(clips[3].sourceStart, 1)
        XCTAssertEqual(try Project.decode(next.encoded()), next)
    }
    func testOverwritePreservesBothOutsideFragmentsAndUndo() throws {
        let p = fixture(), next = try edit(p, .overwrite), clips = next.sequences[0].videoClips
        XCTAssertEqual(clips[0].duration, 3); XCTAssertEqual(clips[1].start, 5)
        XCTAssertEqual(clips[1].duration, 5); XCTAssertEqual(clips[1].sourceStart, 12)
        XCTAssertEqual(clips[1].fadeWindow, FadeWindow(offset: 5, duration: 10))
        var history = DocumentHistory(p); try history.apply(next); history.undo(); XCTAssertEqual(history.project, p)
        history.redo(); XCTAssertEqual(history.project, next)
    }
    func testInvalidRangesLocksAndMatteLinksAreAtomic() throws {
        var p = fixture(); p.sequences[0].tracks[0].locked = true
        XCTAssertThrowsError(try edit(p, .insert)); p.sequences[0].tracks[0].locked = false
        p.sequences[0].videoClips[1].matte = ClipMatte(sourceClipId: "original")
        XCTAssertThrowsError(try edit(p, .insert)); XCTAssertThrowsError(try edit(p, .overwrite))
        for range in [SourceRange(start: 3, end: 1), SourceRange(end: .nan), SourceRange(end: 31), SourceRange(end: 0.001)] {
            XCTAssertThrowsError(try range.validate(duration: 30, frameRate: 30))
        }
    }
}
