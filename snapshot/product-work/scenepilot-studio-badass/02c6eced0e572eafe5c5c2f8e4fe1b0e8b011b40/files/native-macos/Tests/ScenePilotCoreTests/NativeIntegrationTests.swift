import XCTest
@testable import ScenePilotCore

final class NativeIntegrationTests: XCTestCase {
    func testCollectedProjectMovesAndRemainsPortableAfterSave() throws {
        let temp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: temp, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: temp) }
        let source = temp.appendingPathComponent("source.mov"); try Data([1,2,3]).write(to: source)
        var p = Project(); p.media = [Media(path: source.path, duration: 1, hasVideo: true, hasAudio: false)]
        let folder = temp.appendingPathComponent("Collected")
        let document = try ProjectCollection.collect(p, to: folder)
        XCTAssertThrowsError(try ProjectCollection.collect(p,to:folder))
        let copy = try ProjectStore.load(document)
        XCTAssertEqual(try Data(contentsOf: URL(fileURLWithPath:copy.media[0].path)),Data([1,2,3]))
        try ProjectStore.save(copy,to:document)
        let moved = temp.appendingPathComponent("Moved"); try FileManager.default.moveItem(at:folder,to:moved)
        let reopened = try ProjectStore.load(moved.appendingPathComponent(document.lastPathComponent))
        XCTAssertTrue(reopened.media[0].path.hasPrefix(moved.path))
        XCTAssertEqual(try Data(contentsOf:URL(fileURLWithPath:reopened.media[0].path)),Data([1,2,3]))
        p.media[0].path = temp.appendingPathComponent("missing.mov").path
        let failed = temp.appendingPathComponent("Failed")
        XCTAssertThrowsError(try ProjectCollection.collect(p,to:failed)); XCTAssertFalse(FileManager.default.fileExists(atPath:failed.path))
        var raw = try JSONSerialization.jsonObject(with: copy.encoded()) as! [String:Any]
        var media = raw["media"] as! [[String:Any]]; media[0]["path"] = "Media/../../escape"; raw["media"] = media
        let unsafe = temp.appendingPathComponent("unsafe.json"); try JSONSerialization.data(withJSONObject:raw).write(to:unsafe)
        XCTAssertThrowsError(try ProjectStore.load(unsafe))
    }
    func testIsolationPreservesOuterEditsAndAudioAndRoundTrips() throws {
        var p = Project(); let media = Media(path: "/tmp/source.mov", duration: 10, hasVideo: true, hasAudio: true)
        p.media = [media]
        var clip = Clip(assetId: media.id, trackId: p.sequences[0].tracks[0].id, start: 2, duration: 2)
        clip.sourceStart = 3; clip.rate = 2; clip.gain = 0.4; clip.fadeIn = 0.5; clip.mask = ClipMask(shape: .ellipse)
        p.sequences[0].videoClips = [clip]
        let alpha = Media(path: "/tmp/alpha.mov", duration: 4, hasVideo: true, hasAudio: false)
        let next = try Edit.isolate(p, sequenceId: p.mainSequenceId, clipId: clip.id, matte: alpha)
        let instance = next.sequences[0].videoClips[0], comp = next.sequences[1]
        XCTAssertEqual(instance.id, clip.id); XCTAssertNil(instance.assetId); XCTAssertEqual(instance.sourceStart, 0)
        XCTAssertEqual(instance.rate, 2); XCTAssertEqual(instance.gain, 0.4); XCTAssertEqual(instance.mask, clip.mask)
        XCTAssertEqual(comp.videoClips[1].sourceStart, 3); XCTAssertEqual(comp.videoClips[1].duration, 4)
        XCTAssertEqual(comp.videoClips[1].gain, 1); XCTAssertEqual(comp.videoClips[1].matte?.sourceClipId, comp.videoClips[0].id)
        XCTAssertEqual(try Project.decode(next.encoded()), next)
        var history = DocumentHistory(p); try history.apply(next); history.undo(); XCTAssertEqual(history.project, p)
        var short = alpha; short.duration = 1; XCTAssertThrowsError(try Edit.isolate(p, sequenceId: p.mainSequenceId, clipId: clip.id, matte: short))
    }
    func legacy(_ modifications: [String: Any] = [:]) throws -> Data {
        var raw: [String: Any] = ["format":"scenepilot-cut", "version":2, "project":"Legacy", "assets":[["id":"video","name":"source.mov","kind":"video","sourcePath":"/tmp/source.mov"]],
            "videoClips":[["id":"cut","assetId":"video","trackId":"v1","start":1.0,"duration":2.0,"sourceStart":3.0,"playbackRate":2.0]],
            "baseCuts":[["bad":"must not be used"]], "settings":["aspect":"9:16","exportFrameRate":25,"exportMaxDimension":1920]]
        raw.merge(modifications) { _, b in b }; return try JSONSerialization.data(withJSONObject: raw)
    }
    func testLegacyRebuildKeepsCanonicalRangesAspectAndExactArchive() throws {
        let data = try legacy(), source = Media(path: "/tmp/source.mov", duration: 20, hasVideo: true, hasAudio: true)
        let p = try LegacyEditorialRebuild.rebuild(data, filename: "old.json", linked: ["video":source])
        XCTAssertEqual(p.sequences[0].width, 1080); XCTAssertEqual(p.sequences[0].height,1920); XCTAssertEqual(p.sequences[0].frameRate,25)
        let clip = p.sequences[0].videoClips[0]
        XCTAssertEqual(clip.sourceStart,3); XCTAssertEqual(clip.rate,2); XCTAssertEqual(clip.start,1); XCTAssertEqual(clip.gain,0)
        XCTAssertEqual(p.legacyArchive?.data,data); XCTAssertEqual(try Project.decode(p.encoded()),p)
    }
    func testLegacyRefusesOfflineReverseAndBrokenRanges() throws {
        let source = Media(path: "/tmp/source.mov", duration: 20, hasVideo: true, hasAudio: false)
        XCTAssertThrowsError(try LegacyEditorialRebuild.rebuild(legacy(), filename:"old.json",linked:[:]))
        for extra: [String:Any] in [["reversed":true],["timeRemap":[["time":0]]],["duration":100],["start":true],["overlay":["compositionId":"nested"]]] {
            var clip: [String:Any] = ["id":"cut","assetId":"video","start":0,"duration":1,"sourceStart":0]
            clip.merge(extra) { _,b in b }
            XCTAssertThrowsError(try LegacyEditorialRebuild.rebuild(legacy(["videoClips":[clip]]), filename:"old.json",linked:["video":source]))
        }
    }
}
