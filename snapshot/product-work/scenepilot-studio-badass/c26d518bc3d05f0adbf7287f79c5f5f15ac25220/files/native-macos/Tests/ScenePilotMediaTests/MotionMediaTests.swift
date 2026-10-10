import XCTest
import AVFoundation
import ScenePilotCore
@testable import ScenePilotMedia

extension MediaTests {
    func motionFixture() async throws -> Project {
        guard let path = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_PATTERN"] else { throw XCTSkip("Supply generated native pattern media.") }
        let asset = try await NativeMedia.inspect(URL(fileURLWithPath: path))
        var p = Project(name: "Native motion QA"); p.media = [asset]; p.sequences[0].width = 640; p.sequences[0].height = 360
        var clip = Clip(assetId: asset.id, trackId: p.sequences[0].tracks[0].id, start: 0, duration: 2, id: "animated")
        clip.motion = ClipMotion(keyframes: [MotionKeyframe(time: 0, value: MotionValue(x: -0.2, scale: 0.6, opacity: 0.3), easing: .smooth), MotionKeyframe(time: 1.5, value: MotionValue(x: 0.2, y: 0.1, scale: 0.8, rotation: 90))])
        p.sequences[0].videoClips = [clip]; return p
    }
    func motionGenerator(_ p: Project, sequenceId: String? = nil) async throws -> AVAssetImageGenerator {
        let built = try await NativeMedia.build(p, sequenceId: sequenceId ?? p.mainSequenceId)
        let gen = AVAssetImageGenerator(asset: built.composition); gen.videoComposition = built.videoComposition; return gen
    }
    func pixelError(_ a: [UInt8], _ b: [UInt8]) -> Double { zip(a,b).map { abs(Double($0) - Double($1)) }.reduce(0,+) / Double(a.count) }

    func testAnimatedPixelsMatchEvaluatedPoseAndSurviveSplitTrim() async throws {
        let p = try await motionFixture(), original = p.sequences[0].videoClips[0]
        let animated = try await motionGenerator(p)
        let split = try Edit.split(p, sequenceId: p.mainSequenceId, clipId: original.id, at: 0.5)
        let splitFrames = try await motionGenerator(split)
        let trimmed = try Edit.trim(p, sequenceId: p.mainSequenceId, clipId: original.id, edge: .head, to: 0.5)
        let trimFrames = try await motionGenerator(trimmed)
        for time in [0.6, 1.0, 1.4, 1.8] {
            var frozen = p; let pose = original.motionValue(atLocalTime: time)
            frozen.sequences[0].videoClips[0].motion = nil
            frozen.sequences[0].videoClips[0].transform = pose.applying(to: ClipTransform())
            frozen.sequences[0].videoClips[0].opacity = pose.opacity
            let staticFrames = try await motionGenerator(frozen)
            let expected = try pixels(animated, at: time)
            XCTAssertLessThan(pixelError(expected, try pixels(staticFrames, at: time)), 1, "Native animation differs from evaluated pose at \(time)")
            XCTAssertLessThan(pixelError(expected, try pixels(splitFrames, at: time)), 1, "Split restarted animation")
            XCTAssertLessThan(pixelError(expected, try pixels(trimFrames, at: time)), 1, "Trim restarted animation")
        }
        XCTAssertGreaterThan(pixelError(try pixels(animated, at: 0.2), try pixels(animated, at: 1.4)), 15, "Animation must visibly change the rendered picture")
    }
    @MainActor func testReusedNestedMotionAtDifferentRatesAndMP4Parity() async throws {
        guard let outputPath = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_OUTPUT"] else { throw XCTSkip("Supply generated native output path.") }
        var p = try await motionFixture()
        var child = p.sequences[0]; child.id = "motion-child"; child.name = "Animated composition"
        let track = p.sequences[0].tracks[0].id
        var fast = Clip(compositionId: child.id, trackId: track, start: 0, duration: 1); fast.rate = 2
        var slow = Clip(compositionId: child.id, trackId: track, start: 1, duration: 3); slow.rate = 0.5; slow.sourceStart = 0.5
        p.sequences[0].videoClips = [fast,slow]; p.sequences.append(child)
        // A second nesting level must not multiply the child's own animation rate twice.
        var wrapper = p.sequences[0]; wrapper.id = "wrapper"; p.sequences.append(wrapper)
        p.sequences[0].videoClips = [Clip(compositionId: wrapper.id, trackId: track, start: 0, duration: 4)]
        let built = try await NativeMedia.build(p, sequenceId: p.mainSequenceId)
        let parent = AVAssetImageGenerator(asset: built.composition); parent.videoComposition = built.videoComposition
        let childFrames = try await motionGenerator(p, sequenceId: child.id)
        for (time, childTime) in [(0.3,0.6),(0.6,1.2),(1.4,0.7),(2.2,1.1),(3.4,1.7)] {
            XCTAssertLessThan(pixelError(try pixels(parent, at: time), try pixels(childFrames, at: childTime)), 2, "Nested animation clock mismatch at \(time)")
        }
        let output = URL(fileURLWithPath: outputPath).deletingLastPathComponent().appendingPathComponent("motion-master.mp4")
        try await NativeExporter().export(built, to: output)
        let actual = AVAssetImageGenerator(asset: AVURLAsset(url: output))
        for time in [0.2,0.6,1.4,2.2,3.4] {
            XCTAssertLessThan(pixelError(try pixels(parent, at: time), try pixels(actual, at: time)), 8, "Animated preview/export mismatch at \(time)")
        }
        let info = try await NativeMedia.inspect(output)
        XCTAssertTrue(info.hasVideo && info.hasAudio); XCTAssertEqual(info.duration, 4, accuracy: 0.08)
    }
}
