import XCTest
@testable import ScenePilotCore

final class CompositingTests: XCTestCase {
    func fixture() -> Project {
        var p = Project(); p.media = [Media(path: "/tmp/matte.mov", duration: 10, hasVideo: true, hasAudio: true)]
        p.sequences[0].videoClips = (0..<3).map { Clip(assetId: p.media[0].id, trackId: p.sequences[0].tracks[0].id, start: 0, duration: 2, id: "c\($0)") }
        return p
    }
    func testMaskAndMattePersistAndUndoAtomically() throws {
        let p = fixture(); var mask = ClipMask(shape: .ellipse); mask.feather = 8; mask.inverted = true
        let masked = try Edit.mask(p, sequenceId: p.mainSequenceId, clipId: "c0", value: mask)
        let matted = try Edit.matte(masked, sequenceId: p.mainSequenceId, clipId: "c0", value: ClipMatte(sourceClipId: "c1", mode: .luma, inverted: true))
        XCTAssertEqual(try Project.decode(matted.encoded()), matted); XCTAssertEqual(matted.version, 7)
        var history = DocumentHistory(p); try history.apply(masked); try history.apply(matted)
        history.undo(); XCTAssertEqual(history.project, masked); history.undo(); XCTAssertEqual(history.project, p)
        history.redo(); history.redo(); XCTAssertEqual(history.project, matted)
    }
    func testCyclesMissingAndAudioMatteProvidersRefuse() throws {
        var p = fixture()
        for source in ["c0","missing"] { XCTAssertThrowsError(try Edit.matte(p, sequenceId: p.mainSequenceId, clipId: "c0", value: ClipMatte(sourceClipId: source))) }
        p = try Edit.matte(p, sequenceId: p.mainSequenceId, clipId: "c0", value: ClipMatte(sourceClipId: "c1"))
        p = try Edit.matte(p, sequenceId: p.mainSequenceId, clipId: "c1", value: ClipMatte(sourceClipId: "c2"))
        XCTAssertThrowsError(try Edit.matte(p, sequenceId: p.mainSequenceId, clipId: "c2", value: ClipMatte(sourceClipId: "c0")))
        p.media[0].hasVideo = false; XCTAssertThrowsError(try p.validated())
    }
    func testLockedAndInvalidMaskEditsRefuse() throws {
        var p = fixture(); p.sequences[0].tracks[0].locked = true
        XCTAssertThrowsError(try Edit.mask(p, sequenceId: p.mainSequenceId, clipId: "c0", value: ClipMask(shape: .rectangle)))
        XCTAssertThrowsError(try Edit.matte(p, sequenceId: p.mainSequenceId, clipId: "c0", value: ClipMatte(sourceClipId: "c1")))
        p.sequences[0].tracks[0].locked = false
        for width in [0, -1, Double.infinity, Double.nan, 17] {
            var mask = ClipMask(shape: .ellipse); mask.width = width
            XCTAssertThrowsError(try Edit.mask(p, sequenceId: p.mainSequenceId, clipId: "c0", value: mask))
        }
        var mask = ClipMask(shape: .rectangle); mask.feather = -1
        XCTAssertThrowsError(try Edit.mask(p, sequenceId: p.mainSequenceId, clipId: "c0", value: mask))
    }
    func testProviderDeleteAndSplitRefuseWithoutDamagingConsumers() throws {
        var p = fixture(); p = try Edit.matte(p, sequenceId: p.mainSequenceId, clipId: "c0", value: ClipMatte(sourceClipId: "c1"))
        XCTAssertThrowsError(try Edit.transact(p, sequenceId: p.mainSequenceId) { $0.videoClips.removeAll { $0.id == "c1" } })
        XCTAssertThrowsError(try Edit.split(p, sequenceId: p.mainSequenceId, clipId: "c1", at: 1))
        let split = try Edit.split(p, sequenceId: p.mainSequenceId, clipId: "c0", at: 1)
        XCTAssertEqual(split.sequences[0].videoClips.filter { $0.matte?.sourceClipId == "c1" }.count, 2)
        let unlinked = try Edit.matte(p, sequenceId: p.mainSequenceId, clipId: "c0", value: nil)
        XCTAssertNoThrow(try Edit.split(unlinked, sequenceId: p.mainSequenceId, clipId: "c1", at: 1))
    }
    func testGroupPresentationAndAudioFadesAreSupported() throws {
        var p = fixture(); var child = p.sequences[0]; child.id = "child"; p.sequences.append(child)
        var group = Clip(compositionId: child.id, trackId: p.sequences[0].tracks[0].id, start: 0, duration: 2)
        group.opacity = 0.5; group.exposure = 1; group.saturation = 0.2; group.blur = 10
        group.mask = ClipMask(shape: .ellipse); group.transform = ClipTransform(); group.transform?.rotation = 45
        p.sequences[0].videoClips = [group]
        XCTAssertEqual(try Project.decode(p.encoded()), p)
        XCTAssertNoThrow(try Edit.motionKey(p, sequenceId: p.mainSequenceId, clipId: group.id, at: 0))
        p.sequences[0].videoClips[0].fadeIn = 1; XCTAssertNoThrow(try p.validated())
    }
}
