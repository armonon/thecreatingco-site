import XCTest
@testable import ScenePilotCore

final class ProjectTests: XCTestCase {
    func fixture() -> Project {
        var project = Project(name: "QA")
        let asset = Media(path: "/tmp/fixture.mp4", duration: 10, hasVideo: true, hasAudio: true)
        project.media = [asset]
        project.sequences[0].videoClips = [Clip(assetId: asset.id, trackId: project.sequences[0].tracks[1].id, start: 0, duration: 6)]
        return project
    }
    func testRoundTrip() throws { let p = fixture(); XCTAssertEqual(try Project.decode(p.encoded()), p) }
    func testBrowserProjectRejectedWithoutFlattening() { XCTAssertThrowsError(try Project.decode(Data("{\"format\":\"scenepilot-cut\",\"version\":2}".utf8))) }
    func testFutureVersionRejected() throws { var p = fixture(); p.version += 1; XCTAssertThrowsError(try p.encoded()) }
    func testInvalidTimingRejected() throws { var p = fixture(); p.sequences[0].videoClips[0].duration = 30; XCTAssertThrowsError(try p.validated()) }
    func testDuplicateIDsRejected() { var p = fixture(); p.media.append(p.media[0]); XCTAssertThrowsError(try p.validated()) }
    func testNonFiniteRejected() { var p = fixture(); p.sequences[0].videoClips[0].gain = .nan; XCTAssertThrowsError(try p.validated()) }
    func testSplitPreservesSourceTimeAndDuration() throws {
        var p = fixture(); p.sequences[0].videoClips[0].rate = 1.5
        let s = p.sequences[0]
        p = try Edit.split(p, sequenceId: s.id, clipId: s.videoClips[0].id, at: 2)
        XCTAssertEqual(p.sequences[0].videoClips.map(\.duration), [2,4])
        XCTAssertEqual(p.sequences[0].videoClips[1].sourceStart, 3)
        XCTAssertEqual(Set(p.sequences[0].videoClips.map(\.id)).count, 2)
    }
    func testLockedSplitRejected() { var p = fixture(); p.sequences[0].tracks[1].locked = true; XCTAssertThrowsError(try Edit.split(p, sequenceId: p.mainSequenceId, clipId: p.sequences[0].videoClips[0].id, at: 2)) }
    func testTrackOrderDoesNotRewriteClips() throws { let p = fixture(); let s = p.sequences[0]; let next = try Edit.moveTrack(p, sequenceId: s.id, trackId: s.tracks[1].id, by: -1); XCTAssertEqual(next.sequences[0].videoClips, s.videoClips); XCTAssertEqual(next.sequences[0].tracks[0].id, s.tracks[1].id) }
    func testOccupiedTrackCannotBeDeleted() { let p = fixture(); XCTAssertThrowsError(try Edit.removeTrack(p, sequenceId: p.mainSequenceId, trackId: p.sequences[0].tracks[1].id)) }
    func testUndoRedoAndSaveRevision() throws {
        let p = fixture(); var h = DocumentHistory(p); var next = p; next.name = "Changed"
        try h.apply(next); XCTAssertTrue(h.dirty); h.markSaved(p); XCTAssertTrue(h.dirty)
        h.undo(); XCTAssertEqual(h.project, p); XCTAssertFalse(h.dirty)
        h.redo(); XCTAssertEqual(h.project, next); h.markSaved(next); XCTAssertFalse(h.dirty)
    }
    func testDependencyCycleRejected() {
        var p = fixture(); var second = Sequence(name: "Comp"); second.videoClips = p.sequences[0].videoClips
        second.videoClips[0].trackId = second.tracks[0].id
        p.sequences.append(second)
        p.sequences[0].videoClips.append(Clip(compositionId: second.id, trackId: p.sequences[0].tracks[0].id, start: 0, duration: 1))
        p.sequences[1].videoClips.append(Clip(compositionId: p.mainSequenceId, trackId: second.tracks[0].id, start: 0, duration: 1))
        XCTAssertThrowsError(try p.validated())
    }
    func testAtomicSaveAndLoad() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let file = root.appendingPathComponent("test.json"); let p = fixture()
        try ProjectStore.save(p, to: file); XCTAssertEqual(try ProjectStore.load(file), p)
        var bad = p; bad.version = 9
        XCTAssertThrowsError(try ProjectStore.save(bad, to: file)); XCTAssertEqual(try ProjectStore.load(file), p)
    }
    func testSaveCannotOverwriteLegacyOrMedia() throws {
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".json")
        let legacy = Data("{\"format\":\"scenepilot-cut\",\"version\":2}".utf8)
        try legacy.write(to: file)
        defer { try? FileManager.default.removeItem(at: file) }
        XCTAssertThrowsError(try ProjectStore.save(fixture(), to: file))
        XCTAssertEqual(try Data(contentsOf: file), legacy)
    }
    func testReusedCompositionGraphValidatesWithoutExponentialTraversal() throws {
        var p = fixture()
        for i in 0..<24 {
            var comp = Sequence(name: "Shared \(i)")
            let child = p.sequences.last!.id
            comp.videoClips = (0..<2).map { _ in Clip(compositionId: child, trackId: comp.tracks[0].id, start: 0, duration: 1) }
            p.sequences.append(comp)
        }
        XCTAssertNoThrow(try p.validated())
    }
}
