import XCTest
import AVFoundation
import ScenePilotCore
@testable import ScenePilotMedia

extension MediaTests {
    func compositingFixture() async throws -> Project {
        var p = try await motionFixture()
        var child = p.sequences[0]; child.id = "group-child"; child.name = "Pattern group"
        child.videoClips[0].motion = nil
        var second = child.videoClips[0]; second.id = "overlapping-child"; second.trackId = child.tracks[1].id
        second.transform = ClipTransform(); second.transform?.x = 0.1; child.videoClips.append(second)
        var group = Clip(compositionId: child.id, trackId: p.sequences[0].tracks[1].id, start: 0, duration: 2, id: "group")
        group.opacity = 0.7; group.blur = 3; group.exposure = 0.3; group.saturation = 0.4
        group.mask = ClipMask(shape: .ellipse); group.mask?.feather = 5
        group.motion = ClipMotion(keyframes: [MotionKeyframe(time: 0, value: MotionValue(x: -0.1, scale: 0.8, opacity: 0.7)),MotionKeyframe(time: 1.5, value: MotionValue(x: 0.1, scale: 0.9, rotation: 20, opacity: 0.9))])
        var provider = Clip(assetId: p.media[0].id, trackId: p.sequences[0].tracks[0].id, start: 0, duration: 2, id: "provider")
        provider.mask = ClipMask(shape: .rectangle); provider.mask?.width = 0.8; provider.mask?.feather = 10
        provider.motion = ClipMotion(keyframes: [MotionKeyframe(time: 0, value: MotionValue(x: -0.1)),MotionKeyframe(time: 1.5, value: MotionValue(x: 0.1))])
        provider.gain = 0 // Matte-only picture sources retain audio unless explicitly muted.
        group.matte = ClipMatte(sourceClipId: provider.id, mode: .luma)
        p.sequences[0].videoClips = [provider,group]; p.sequences.append(child); return p
    }
    @MainActor func testGroupEffectsMasksMattesSurviveSplitAndMatchExport() async throws {
        guard let outputPath = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_OUTPUT"] else { throw XCTSkip("Supply generated native output path.") }
        let p = try await compositingFixture()
        let built = try await NativeMedia.build(p, sequenceId: p.mainSequenceId)
        let frames = AVAssetImageGenerator(asset: built.composition); frames.videoComposition = built.videoComposition
        let split = try Edit.split(p, sequenceId: p.mainSequenceId, clipId: "group", at: 0.5)
        let splitFrames = try await motionGenerator(split)
        let trimmed = try Edit.trim(p, sequenceId: p.mainSequenceId, clipId: "group", edge: .head, to: 0.5)
        let trimmedFrames = try await motionGenerator(trimmed)
        var bare = p; bare.sequences[0].videoClips[1].matte = nil
        // Keep the provider hidden with a second consumer? No: remove it entirely for
        // this comparison, otherwise a visible provider could mask a broken consumer.
        bare.sequences[0].videoClips.removeFirst()
        let bareFrames = try await motionGenerator(bare)
        XCTAssertGreaterThan(pixelError(try pixels(frames, at: 1), try pixels(bareFrames, at: 1)), 5, "Luma matte must visibly change real footage")
        for time in [0.6,1.0,1.4,1.8] {
            let expected = try pixels(frames, at: time)
            XCTAssertLessThan(pixelError(expected, try pixels(splitFrames, at: time)), 1)
            XCTAssertLessThan(pixelError(expected, try pixels(trimmedFrames, at: time)), 1)
        }
        let output = URL(fileURLWithPath: outputPath).deletingLastPathComponent().appendingPathComponent("compositing-master.mp4")
        try await NativeExporter().export(built, to: output)
        let decoded = AVAssetImageGenerator(asset: AVURLAsset(url: output))
        for time in [0.2,0.6,1.0,1.4,1.8] { XCTAssertLessThan(pixelError(try pixels(frames, at: time), try pixels(decoded, at: time)), 8, "Group/matte export differs from preview at \(time)s") }
        let info = try await NativeMedia.inspect(output); XCTAssertTrue(info.hasVideo && info.hasAudio)
        XCTAssertEqual(info.duration, 2, accuracy: 0.08)
    }
    func testReusedMattedGroupAtDifferentRatesKeepsItsOwnScope() async throws {
        var p = try await compositingFixture()
        var child = p.sequences[0]; child.id = "matted-child"; p.sequences.append(child)
        let track = p.sequences[0].tracks[0].id
        var fast = Clip(compositionId: child.id, trackId: track, start: 0, duration: 1); fast.rate = 2
        var slow = Clip(compositionId: child.id, trackId: track, start: 1, duration: 3); slow.rate = 0.5; slow.sourceStart = 0.5
        p.sequences[0].videoClips = [fast,slow]
        let parent = try await motionGenerator(p), source = try await motionGenerator(p, sequenceId: child.id)
        for (time, childTime) in [(0.3,0.6),(0.6,1.2),(1.4,0.7),(2.2,1.1),(3.4,1.7)] {
            XCTAssertLessThan(pixelError(try pixels(parent, at: time), try pixels(source, at: childTime)), 2)
        }
    }
}
