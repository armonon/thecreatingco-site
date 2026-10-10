import XCTest
@testable import ScenePilotCore

final class WorkflowTests: XCTestCase {
    func testWorkspaceRestoresAndRepairsInvalidPersistence() throws {
        XCTAssertEqual(WorkspaceLayout.restore(Data("broken".utf8)), WorkspaceLayout())
        var layout = WorkspaceLayout(); layout.mediaWidth = 270; layout.upperFraction = 0.55
        XCTAssertEqual(WorkspaceLayout.restore(try JSONEncoder().encode(layout)), layout)
        layout.version = 99; XCTAssertEqual(WorkspaceLayout.restore(try JSONEncoder().encode(layout)), WorkspaceLayout())
        layout.version = 1; layout.mediaWidth = 99999; layout.inspectorWidth = -10; layout.upperFraction = 99
        let repaired = WorkspaceLayout.restore(try JSONEncoder().encode(layout))
        XCTAssertEqual(repaired.mediaWidth, 400); XCTAssertEqual(repaired.inspectorWidth, 264); XCTAssertEqual(repaired.upperFraction, 0.8)
    }
    func testWorkspaceFitsRequiredViewportMatrix() {
        for (width,height) in [(1000.0,628.0),(1280,728),(1440,828),(1920,1008)] {
            let p = WorkspaceLayout().positions(width: width, height: height)
            XCTAssertGreaterThanOrEqual(p.left, 218); XCTAssertGreaterThanOrEqual(p.right - p.left, 310)
            XCTAssertGreaterThanOrEqual(width - p.right, 264)
            XCTAssertGreaterThanOrEqual(height - p.top, 230); XCTAssertGreaterThanOrEqual(p.top, 300)
        }
    }
    func fixture() -> Project {
        var p = Project(name: "Workflow")
        let media = Media(path: "/tmp/source.mov", duration: 20, hasVideo: true, hasAudio: true)
        p.media = [media]
        var clip = Clip(assetId: media.id, trackId: p.sequences[0].tracks[0].id, start: 2, duration: 6)
        clip.sourceStart = 2; clip.rate = 2
        p.sequences[0].videoClips = [clip]; return p
    }
    func testTrimHeadPreservesOutPointAndSourceMapping() throws {
        let p = fixture(), clip = p.sequences[0].videoClips[0]
        let next = try Edit.trim(p, sequenceId: p.mainSequenceId, clipId: clip.id, edge: .head, to: 3)
        let trimmed = next.sequences[0].videoClips[0]
        XCTAssertEqual(trimmed.start, 3); XCTAssertEqual(trimmed.duration, 5); XCTAssertEqual(trimmed.sourceStart, 4)
        XCTAssertEqual(trimmed.start + trimmed.duration, clip.start + clip.duration)
    }
    func testTrimTailAndInvalidTrimLeaveInputUnchanged() throws {
        let p = fixture(), id = p.sequences[0].videoClips[0].id
        XCTAssertEqual(try Edit.trim(p, sequenceId: p.mainSequenceId, clipId: id, edge: .tail, to: 7).sequences[0].videoClips[0].duration, 5)
        for time in [Double.nan, -1, 1.999, 100] { XCTAssertThrowsError(try Edit.trim(p, sequenceId: p.mainSequenceId, clipId: id, edge: .tail, to: time)) }
        XCTAssertEqual(p.sequences[0].videoClips[0].duration, 6)
    }
    func testSlipKeepsTimelineAndUsesPlaybackRate() throws {
        let p = fixture(), clip = p.sequences[0].videoClips[0]
        let next = try Edit.slip(p, sequenceId: p.mainSequenceId, clipId: clip.id, by: 1).sequences[0].videoClips[0]
        XCTAssertEqual(next.sourceStart, 2 + 2 / 30.0, accuracy: 0.00001); XCTAssertEqual(next.start, clip.start); XCTAssertEqual(next.duration, clip.duration)
        XCTAssertThrowsError(try Edit.slip(p, sequenceId: p.mainSequenceId, clipId: clip.id, by: 500))
    }
    func testDuplicateAndRippleAreTrackLocalAndUndoable() throws {
        var p = fixture(); let clip = p.sequences[0].videoClips[0]
        let other = Clip(assetId: p.media[0].id, trackId: p.sequences[0].tracks[1].id, start: 10, duration: 2)
        p.sequences[0].videoClips.append(other)
        let duplicate = try Edit.duplicate(p, sequenceId: p.mainSequenceId, clipId: clip.id)
        XCTAssertEqual(duplicate.sequences[0].videoClips[1].start, 8)
        XCTAssertNotEqual(duplicate.sequences[0].videoClips[1].id, clip.id)
        let rippled = try Edit.rippleDelete(duplicate, sequenceId: p.mainSequenceId, clipId: clip.id)
        XCTAssertEqual(rippled.sequences[0].videoClips[0].start, 2)
        XCTAssertEqual(rippled.sequences[0].videoClips.last, other)
        var history = DocumentHistory(duplicate); try history.apply(rippled); history.undo(); XCTAssertEqual(history.project, duplicate); history.redo(); XCTAssertEqual(history.project, rippled)
        XCTAssertThrowsError(try Edit.duplicate(duplicate, sequenceId: p.mainSequenceId, clipId: clip.id))
    }
    func testLockedEditingAndOverlappingRippleRefuse() throws {
        var p = fixture(); let clip = p.sequences[0].videoClips[0]
        p.sequences[0].tracks[0].locked = true
        XCTAssertThrowsError(try Edit.trim(p, sequenceId: p.mainSequenceId, clipId: clip.id, edge: .head, to: 3))
        XCTAssertThrowsError(try Edit.slip(p, sequenceId: p.mainSequenceId, clipId: clip.id, by: 1))
        XCTAssertThrowsError(try Edit.duplicate(p, sequenceId: p.mainSequenceId, clipId: clip.id))
        XCTAssertThrowsError(try Edit.rippleDelete(p, sequenceId: p.mainSequenceId, clipId: clip.id))
        p.sequences[0].tracks[0].locked = false
        var overlap = clip; overlap.id = "overlap"; overlap.start += 1
        p.sequences[0].videoClips.append(overlap)
        XCTAssertThrowsError(try Edit.rippleDelete(p, sequenceId: p.mainSequenceId, clipId: clip.id))
    }
    func testSplitPreservesFadeEnvelopeAcrossRepeatedSplits() throws {
        var p = fixture(); let id = p.sequences[0].videoClips[0].id
        p.sequences[0].videoClips[0].fadeIn = 3; p.sequences[0].videoClips[0].fadeOut = 2
        p = try Edit.split(p, sequenceId: p.mainSequenceId, clipId: id, at: 3)
        XCTAssertEqual(p.sequences[0].videoClips[0].fadeIn, 3)
        XCTAssertEqual(p.sequences[0].videoClips[1].fadeWindow, FadeWindow(offset: 1, duration: 6))
        let rightId = p.sequences[0].videoClips[1].id
        p = try Edit.split(p, sequenceId: p.mainSequenceId, clipId: rightId, at: 4)
        XCTAssertEqual(p.sequences[0].videoClips[2].fadeWindow, FadeWindow(offset: 2, duration: 6))
        XCTAssertEqual(try Project.decode(p.encoded()), p)
    }
    func testSnapBothEndsAndStableTie() {
        XCTAssertEqual(TimelineSnap.start(2.1, duration: 1, anchors: [3], tolerance: 0.15, frameRate: 30), 2)
        XCTAssertEqual(TimelineSnap.start(2, duration: 1, anchors: [2.2,1.8], tolerance: 0.3, frameRate: 30), 1.8)
        XCTAssertEqual(TimelineSnap.start(-3, duration: 1, anchors: [], tolerance: 0.3, frameRate: 30), 0)
        XCTAssertEqual(TimelineSnap.start(.nan, duration: 1, anchors: [], tolerance: 0.3, frameRate: 30), 0)
    }
    func testVersionOneMigratesAndVersionTwoCarriesPresentation() throws {
        var p = fixture()
        var raw = try JSONSerialization.jsonObject(with: p.encoded()) as! [String: Any]; raw["version"] = 1
        XCTAssertEqual(try Project.decode(JSONSerialization.data(withJSONObject: raw)), p)
        var t = ClipTransform(); t.x = 0.2; t.fill = true; t.rotation = 30; t.flipH = true
        p.sequences[0].videoClips[0].transform = t
        XCTAssertEqual(try Project.decode(p.encoded()), p)
        p.sequences[0].videoClips[0].transform?.scale = .infinity; XCTAssertThrowsError(try p.encoded())
    }
    func testLegacyArchiveIsByteExactIncludingUnknownFeatures() throws {
        let source = Data("{ \"format\":\"scenepilot-cut\",\"version\":2,\"project\":\"Archive\",\"videoClips\":[],\"baseCuts\":[{}],\"assets\":[],\"customVendorThing\":{\"preserve\":true}}\n".utf8)
        let report = try LegacyCompatibility.inspect(source)
        XCTAssertEqual(report.clipCount, 0, "Canonical empty timeline must supersede legacy arrays")
        XCTAssertTrue(report.findings.contains { $0.contains("customVendorThing") })
        var p = fixture(); p.legacyArchive = try LegacyArchive(filename: "original.scenepilot.json", data: source)
        XCTAssertEqual(try Project.decode(p.encoded()).legacyArchive?.data, source)
        XCTAssertTrue(report.text.contains("not a native timeline conversion"))
    }
    func testLegacyRejectsFutureMalformedAndRemoteSources() throws {
        for json in ["{}", "{\"format\":\"scenepilot-cut\",\"version\":true}", "{\"format\":\"scenepilot-cut\",\"version\":3}", "{\"format\":\"scenepilot-cut\",\"assets\":[1]}"] { XCTAssertThrowsError(try LegacyCompatibility.inspect(Data(json.utf8))) }
        let data = Data("{\"format\":\"scenepilot-cut\",\"mainAsset\":{\"name\":\"remote\",\"kind\":\"video\",\"sourcePath\":\"https://example.com/media\"}}".utf8)
        XCTAssertNil(try LegacyCompatibility.inspect(data).media[0].path)
    }
}
