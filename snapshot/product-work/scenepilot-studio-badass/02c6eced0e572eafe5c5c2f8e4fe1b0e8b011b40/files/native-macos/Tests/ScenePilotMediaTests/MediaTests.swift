import XCTest
import AVFoundation
import CoreGraphics
import ScenePilotCore
@testable import ScenePilotMedia

final class MediaTests: XCTestCase {
    func pixels(_ generator: AVAssetImageGenerator, at seconds: Double) throws -> [UInt8] {
        generator.requestedTimeToleranceBefore = .zero; generator.requestedTimeToleranceAfter = .zero
        let image = try generator.copyCGImage(at: CMTime(seconds: seconds, preferredTimescale: 600_000), actualTime: nil)
        var bytes = [UInt8](repeating: 0, count: 32 * 18 * 4)
        try bytes.withUnsafeMutableBytes { raw in
            guard let context = CGContext(data: raw.baseAddress, width: 32, height: 18, bitsPerComponent: 8, bytesPerRow: 32 * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw ProjectError.invalid("Cannot inspect native pixels.") }
            context.draw(image, in: CGRect(x: 0, y: 0, width: 32, height: 18))
        }
        return bytes
    }
    func testMissingMediaFailsClearly() async { do { _ = try await NativeMedia.inspect(URL(fileURLWithPath: "/no-such-native-qa-file.mp4")); XCTFail("Should fail") } catch { XCTAssertTrue(error.localizedDescription.contains("unavailable")) } }
    @MainActor func testRollAndSlideChangeActualCutFramesAndExportMatches() async throws {
        guard let redPath = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_MEDIA"],
              let bluePath = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_SECOND"],
              let outputPath = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_OUTPUT"] else { throw XCTSkip("Supply generated native fixtures.") }
        let red = try await NativeMedia.inspect(URL(fileURLWithPath: redPath)), blue = try await NativeMedia.inspect(URL(fileURLWithPath: bluePath))
        var p = Project(name: "Adjacent edit pixel QA"); p.media = [red, blue]
        p.sequences[0].width = 640; p.sequences[0].height = 360
        let track = p.sequences[0].tracks[0].id
        p.sequences[0].videoClips = (0..<3).map { index in
            var clip = Clip(assetId: index == 1 ? blue.id : red.id, trackId: track, start: Double(index) * 0.6, duration: 0.6, id: "shot-\(index)")
            clip.sourceStart = 0.5; return clip
        }
        let original = try await NativeMedia.build(p, sequenceId: p.mainSequenceId)
        let rolledProject = try Edit.roll(p, sequenceId: p.mainSequenceId, clipId: "shot-0", by: 6)
        let rolled = try await NativeMedia.build(rolledProject, sequenceId: p.mainSequenceId)
        let slidProject = try Edit.slide(p, sequenceId: p.mainSequenceId, clipId: "shot-1", by: 6)
        let slid = try await NativeMedia.build(slidProject, sequenceId: p.mainSequenceId)
        func generator(_ built: BuiltSequence) -> AVAssetImageGenerator {
            let gen = AVAssetImageGenerator(asset: built.composition); gen.videoComposition = built.videoComposition; return gen
        }
        let before = generator(original), roll = generator(rolled), slide = generator(slid)
        XCTAssertGreaterThan(Int(try pixels(before, at: 0.7)[2]), 150, "Original middle shot is blue")
        XCTAssertGreaterThan(Int(try pixels(roll, at: 0.7)[0]), 150, "Rolling out holds the red shot longer")
        XCTAssertGreaterThan(Int(try pixels(slide, at: 0.7)[0]), 150, "Sliding right extends the left shot")
        XCTAssertGreaterThan(Int(try pixels(before, at: 1.3)[0]), 150)
        XCTAssertGreaterThan(Int(try pixels(slide, at: 1.3)[2]), 150, "Sliding right delays the right shot")
        XCTAssertEqual(slid.duration, original.duration, accuracy: 0.00001)
        XCTAssertEqual(rolled.duration, original.duration, accuracy: 0.00001)
        let output = URL(fileURLWithPath: outputPath).deletingLastPathComponent().appendingPathComponent("adjacent-master.mp4")
        try await NativeExporter().export(slid, to: output)
        let actual = AVAssetImageGenerator(asset: AVURLAsset(url: output))
        for time in [0.3, 0.7, 1.3, 1.6] {
            let expected = try pixels(slide, at: time), encoded = try pixels(actual, at: time)
            let differences = zip(expected, encoded).map { abs(Double($0) - Double($1)) }
            XCTAssertLessThan(differences.reduce(0, +) / Double(differences.count), 8, "Slide preview/export mismatch at \(time)")
        }
        let exported = try await NativeMedia.inspect(output)
        XCTAssertTrue(exported.hasAudio); XCTAssertTrue(exported.hasVideo)
        XCTAssertEqual(exported.duration, original.duration, accuracy: 0.08)
    }
    func testSplitInsideFadesPreservesActualPixels() async throws {
        guard let source = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_MEDIA"] else { throw XCTSkip("Supply real media.") }
        let asset = try await NativeMedia.inspect(URL(fileURLWithPath: source))
        var p = Project(); p.media = [asset]; p.sequences[0].width = 640; p.sequences[0].height = 360
        var clip = Clip(assetId: asset.id, trackId: p.sequences[0].tracks[0].id, start: 0, duration: 2)
        clip.fadeIn = 1; clip.fadeOut = 1; p.sequences[0].videoClips = [clip]
        let split = try Edit.split(p, sequenceId: p.mainSequenceId, clipId: clip.id, at: 0.5)
        let a = try await NativeMedia.build(p, sequenceId: p.mainSequenceId), b = try await NativeMedia.build(split, sequenceId: p.mainSequenceId)
        let before = AVAssetImageGenerator(asset: a.composition); before.videoComposition = a.videoComposition
        let after = AVAssetImageGenerator(asset: b.composition); after.videoComposition = b.videoComposition
        for time in [0.2, 0.5, 0.8, 1.2, 1.8] {
            let x = try pixels(before, at: time), y = try pixels(after, at: time)
            let mae = zip(x,y).map { abs(Double($0) - Double($1)) }.reduce(0,+) / Double(x.count)
            XCTAssertLessThan(mae, 1, "Split changed picture at \(time)s")
        }
        // The audio mixer must inherit the original fade, not restart it at the cut.
        let audio = b.audioMix.inputParameters
        XCTAssertEqual(audio.count, 2)
        for parameters in audio {
            var start: Float = 0, end: Float = 0, range = CMTimeRange.zero
            if parameters.getVolumeRamp(for: CMTime(seconds: 0.8, preferredTimescale: 600), startVolume: &start, endVolume: &end, timeRange: &range), range.duration.seconds > 0, range.start.seconds <= 0.8, range.end.seconds >= 0.8 {
                let interpolated = Double(start) + (Double(end) - Double(start)) * (0.8 - range.start.seconds) / range.duration.seconds
                XCTAssertEqual(interpolated, 0.8, accuracy: 0.001)
            }
        }
    }
    func testNativeFitFillAndPositionScaleActuallyChangePixels() async throws {
        guard let source = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_MEDIA"] else { throw XCTSkip("Supply real media.") }
        let asset = try await NativeMedia.inspect(URL(fileURLWithPath: source))
        var p = Project(); p.media = [asset]; p.sequences[0].width = 360; p.sequences[0].height = 640
        let clip = Clip(assetId: asset.id, trackId: p.sequences[0].tracks[0].id, start: 0, duration: 2)
        p.sequences[0].videoClips = [clip]
        func sample(_ project: Project) async throws -> [UInt8] {
            let result = try await NativeMedia.build(project, sequenceId: project.mainSequenceId)
            let gen = AVAssetImageGenerator(asset: result.composition); gen.videoComposition = result.videoComposition
            return try pixels(gen, at: 0.5)
        }
        let fit = try await sample(p)
        XCTAssertLessThan(fit[0], 10, "Fit should letterbox a landscape source in a portrait frame")
        var transform = ClipTransform(); transform.fill = true
        p.sequences[0].videoClips[0].transform = transform
        let fill = try await sample(p)
        XCTAssertGreaterThan(fill[0], 100, "Fill should cover the portrait corner with red")
        // Use contained geometry for the translation check; fill deliberately
        // extends the uncropped source beyond the canvas before transforms.
        transform.fill = false; transform.scale = 0.5; transform.x = 0.25; p.sequences[0].videoClips[0].transform = transform
        let shifted = try await sample(p)
        let left = (9 * 32 + 1) * 4, right = (9 * 32 + 24) * 4
        XCTAssertLessThan(shifted[left], 10); XCTAssertGreaterThan(shifted[right], 100)
    }
    func testEmptySequenceRefusesExportPreparation() async { let p = Project(); do { _ = try await NativeMedia.build(p, sequenceId: p.mainSequenceId); XCTFail("Should fail") } catch { XCTAssertTrue(error.localizedDescription.contains("Add a clip")) } }
    @MainActor func testNativeRender() async throws {
        guard let source = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_MEDIA"], let output = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_OUTPUT"] else { throw XCTSkip("Set SCENEPILOT_NATIVE_QA_MEDIA and SCENEPILOT_NATIVE_QA_OUTPUT for real AVFoundation/Metal export.") }
        let asset = try await NativeMedia.inspect(URL(fileURLWithPath: ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_PATTERN"] ?? source))
        var p = Project(name: "Native QA"); p.media = [asset]
        p.sequences[0].width = 640; p.sequences[0].height = 360
        var clip = Clip(assetId: asset.id, trackId: p.sequences[0].tracks[0].id, start: 0, duration: min(asset.duration, 2))
        clip.exposure = -0.25; clip.saturation = 0.5; clip.blur = 2
        var transform = ClipTransform(); transform.rotation = 13; transform.scale = 0.8; transform.flipH = true; transform.x = 0.1
        clip.transform = transform
        p.sequences[0].videoClips = [clip]
        let built = try await NativeMedia.build(p, sequenceId: p.mainSequenceId)
        XCTAssertTrue(built.playerItem().videoComposition?.customVideoCompositorClass == NativeCompositor.self)
        let exporter = NativeExporter()
        try await exporter.export(built, to: URL(fileURLWithPath: output))
        let rendered = try await NativeMedia.inspect(URL(fileURLWithPath: output))
        XCTAssertTrue(rendered.hasVideo); XCTAssertEqual(rendered.duration, clip.duration, accuracy: 0.08)
        let preview = AVAssetImageGenerator(asset: built.composition); preview.videoComposition = built.videoComposition
        let actual = AVAssetImageGenerator(asset: AVURLAsset(url: URL(fileURLWithPath: output)))
        let a = try pixels(preview, at: 0.5), b = try pixels(actual, at: 0.5)
        let difference = zip(a,b).enumerated().filter { $0.offset % 4 != 3 }.map { abs(Double($0.element.0) - Double($0.element.1)) }
        let mae = difference.reduce(0,+) / Double(difference.count)
        XCTAssertLessThan(mae, 8, "Preview and compressed export diverged: RGB MAE \(mae)")
        XCTAssertGreaterThan(a.enumerated().filter { $0.offset % 4 == 0 }.map { Int($0.element) }.max() ?? 0, 20, "Black output must not pass parity")
        XCTAssertFalse(exporter.busy)
    }

    func testAudioMixDoublesTwoQuietTracks() async throws {
        guard let source = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_MEDIA"] else { throw XCTSkip("Supply generated audio/video fixtures.") }
        let asset = try await NativeMedia.inspect(URL(fileURLWithPath: source))
        guard asset.hasAudio else { throw XCTSkip("Fixture needs audio.") }
        var p = Project(); p.media = [asset]
        var clip = Clip(assetId: asset.id, trackId: p.sequences[0].tracks[0].id, start: 0, duration: 2); clip.gain = 0.25
        p.sequences[0].videoClips = [clip]
        func rms(_ project: Project) async throws -> Double {
            let built = try await NativeMedia.build(project, sequenceId: project.mainSequenceId)
            let reader = try AVAssetReader(asset: built.composition)
            let output = AVAssetReaderAudioMixOutput(audioTracks: built.composition.tracks(withMediaType: .audio), audioSettings: [AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 48000, AVNumberOfChannelsKey: 1, AVLinearPCMBitDepthKey: 32, AVLinearPCMIsFloatKey: true, AVLinearPCMIsNonInterleaved: false])
            output.audioMix = built.audioMix; reader.add(output)
            XCTAssertTrue(reader.startReading())
            var squares = 0.0, count = 0
            while let sample = output.copyNextSampleBuffer() {
                guard let block = CMSampleBufferGetDataBuffer(sample) else { continue }
                let length = CMBlockBufferGetDataLength(block)
                var values = [Float](repeating: 0, count: length / MemoryLayout<Float>.size)
                let status = values.withUnsafeMutableBytes { CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: length, destination: $0.baseAddress!) }
                XCTAssertEqual(status, kCMBlockBufferNoErr)
                squares += values.reduce(0) { $0 + Double($1 * $1) }; count += values.count
            }
            XCTAssertEqual(reader.status, .completed)
            return sqrt(squares / Double(max(1, count)))
        }
        let single = try await rms(p)
        clip.id = UUID().uuidString; clip.trackId = p.sequences[0].tracks[1].id; p.sequences[0].videoClips.append(clip)
        let mixed = try await rms(p)
        XCTAssertGreaterThan(single, 0.001); XCTAssertEqual(mixed / single, 2, accuracy: 0.03)
    }

    @MainActor func testExportRefusesSourceOverwrite() async throws {
        guard let source = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_MEDIA"] else { throw XCTSkip("Supply generated media.") }
        let url = URL(fileURLWithPath: source), before = try Data(contentsOf: url)
        let asset = try await NativeMedia.inspect(url)
        var p = Project(); p.media = [asset]; p.sequences[0].videoClips = [Clip(assetId: asset.id, trackId: p.sequences[0].tracks[0].id, start: 0, duration: 2)]
        let built = try await NativeMedia.build(p, sequenceId: p.mainSequenceId)
        do { try await NativeExporter().export(built, to: url); XCTFail("Source overwrite must fail") } catch { XCTAssertTrue(error.localizedDescription.contains("Source media")) }
        XCTAssertEqual(try Data(contentsOf: url), before)
    }

    func testNestedCompositionAndTrackOrder() async throws {
        guard let source = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_MEDIA"], let other = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_SECOND"] else { throw XCTSkip("Supply two distinct real videos for layering QA.") }
        let red = try await NativeMedia.inspect(URL(fileURLWithPath: source)), blue = try await NativeMedia.inspect(URL(fileURLWithPath: other))
        var p = Project(); p.media = [red,blue]
        p.sequences[0].width = 640; p.sequences[0].height = 360
        var comp = ScenePilotCore.Sequence(name: "Nested", width: 640, height: 360)
        comp.videoClips = [Clip(assetId: red.id, trackId: comp.tracks[0].id, start: 0, duration: 2)]
        p.sequences.append(comp)
        let upper = p.sequences[0].tracks[0].id, lower = p.sequences[0].tracks[1].id
        p.sequences[0].videoClips = [Clip(compositionId: comp.id, trackId: upper, start: 0, duration: 2), Clip(assetId: blue.id, trackId: lower, start: 0, duration: 2)]
        func sample(_ project: Project) async throws -> [UInt8] {
            let built = try await NativeMedia.build(project, sequenceId: project.mainSequenceId)
            let gen = AVAssetImageGenerator(asset: built.composition); gen.videoComposition = built.videoComposition
            return try pixels(gen, at: 0.5)
        }
        let first = try await sample(p)
        p = try Edit.moveTrack(p, sequenceId: p.mainSequenceId, trackId: upper, by: 1)
        let second = try await sample(p)
        XCTAssertGreaterThan(Int(first[0]), Int(first[2]) + 80, "Upper nested red composition should cover blue")
        XCTAssertGreaterThan(Int(second[2]), Int(second[0]) + 80, "Reordered blue track should cover red")
    }
    @MainActor func testCanceledExportPreservesDestination() async throws {
        guard let source = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_MEDIA"] else { throw XCTSkip("Supply real media for cancellation QA.") }
        let asset = try await NativeMedia.inspect(URL(fileURLWithPath: source))
        var p = Project(); p.media = [asset]; p.sequences[0].videoClips = [Clip(assetId: asset.id, trackId: p.sequences[0].tracks[0].id, start: 0, duration: min(asset.duration,2))]
        let built = try await NativeMedia.build(p, sequenceId: p.mainSequenceId)
        let destination = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".mp4")
        let sentinel = Data("old master".utf8); try sentinel.write(to: destination)
        defer { try? FileManager.default.removeItem(at: destination) }
        let exporter = NativeExporter()
        let task = Task { try await exporter.export(built, to: destination) }; task.cancel()
        do { try await task.value; XCTFail("Canceled export unexpectedly succeeded") } catch {}
        XCTAssertEqual(try Data(contentsOf: destination), sentinel); XCTAssertFalse(exporter.busy)
    }
    @MainActor func testInFlightCancelPreservesMaster() async throws {
        guard let source = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_MEDIA"] else { throw XCTSkip("Supply media for in-flight cancellation.") }
        let asset = try await NativeMedia.inspect(URL(fileURLWithPath: source))
        var p = Project(); p.media = [asset]
        p.sequences[0].videoClips = (0..<60).map { Clip(assetId: asset.id, trackId: p.sequences[0].tracks[0].id, start: Double($0) * 2, duration: 2) }
        let built = try await NativeMedia.build(p, sequenceId: p.mainSequenceId)
        let destination = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".mp4")
        let original = Data("previous master".utf8); try original.write(to: destination)
        defer { try? FileManager.default.removeItem(at: destination) }
        let exporter = NativeExporter()
        let task = Task { try await exporter.export(built, to: destination) }
        for _ in 0..<100 where !exporter.busy { await Task.yield() }
        XCTAssertTrue(exporter.busy)
        try await Task.sleep(nanoseconds: 20_000_000)
        task.cancel()
        do { try await task.value; XCTFail("Canceled export unexpectedly completed") } catch {}
        XCTAssertEqual(try Data(contentsOf: destination), original); XCTAssertFalse(exporter.busy)
    }
}
