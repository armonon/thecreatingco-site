import XCTest
import AVFoundation
import ScenePilotCore
@testable import ScenePilotMedia

extension MediaTests {
    /// A Pro `scenepilot-cut` document, translated, rendered by the real native engine.
    @MainActor func testTranslatedProProjectRendersLikeItsHandAuthoredNativeEquivalent() async throws {
        let env = ProcessInfo.processInfo.environment
        guard let redPath = env["SCENEPILOT_NATIVE_QA_MEDIA"], let bluePath = env["SCENEPILOT_NATIVE_QA_SECOND"], let patternPath = env["SCENEPILOT_NATIVE_QA_PATTERN"] else { throw XCTSkip("Supply generated native fixtures.") }
        let red = try await NativeMedia.inspect(URL(fileURLWithPath: redPath))
        let blue = try await NativeMedia.inspect(URL(fileURLWithPath: bluePath))
        let pattern = try await NativeMedia.inspect(URL(fileURLWithPath: patternPath))
        let cut: [String: Any] = [
            "format": "scenepilot-cut", "version": 2, "project": "Pro → Native", "duration": 3,
            "effects": ["punchPreset": "off", "shakePreset": "off", "strobePreset": "off", "stutterPreset": "off", "speedPreset": "off", "echoPreset": "off",
                        "lookPreset": "none", "dropRampEnabled": false, "audioReactive": false, "mirrorMode": 0, "streak": 0, "transitionType": "none", "montageEnabled": true],
            "settings": ["aspect": "16:9", "exportFrameRate": 30, "exportMaxDimension": 640, "colorCurve": "none"],
            "tracks": [["id": "v2", "name": "V2", "enabled": true, "blend": "normal", "opacity": 100, "hue": 0, "saturation": 100, "brightness": 100, "glow": 0, "fadeIn": 0.2, "fadeOut": 0]],
            "assets": [["id": "red", "name": "red.mp4", "kind": "video", "sourcePath": redPath], ["id": "blue", "name": "blue.mp4", "kind": "video", "sourcePath": bluePath],
                       ["id": "pattern", "name": "pattern.mp4", "kind": "video", "sourcePath": patternPath]],
            "videoClips": [
                ["id": "c1", "assetId": "pattern", "trackId": "__base__", "start": 0, "duration": 1.5, "sourceStart": 0.5, "fadeIn": 0.3, "flipH": true],
                ["id": "c2", "assetId": "blue", "trackId": "__base__", "start": 1.5, "duration": 1.5, "fadeOut": 0.6],
                ["id": "o1", "assetId": "red", "trackId": "v2", "start": 0.5, "duration": 2, "overlay": ["scale": 50, "opacity": 60],
                 "transformKeyframes": [["id": "k0", "time": 0, "x": -0.2, "y": 0, "scale": 1, "rotation": 0, "opacity": 1, "easing": "ease-out"],
                                        ["id": "k1", "time": 2, "x": 0.2, "y": 0, "scale": 1.5, "rotation": 0, "opacity": 1, "easing": "linear"]]],
            ],
        ]
        let result = try LegacySceneTranslation.translate(JSONSerialization.data(withJSONObject: cut), filename: "cut.scenepilot.json",
                                                          linked: ["red": red, "blue": blue, "pattern": pattern])
        let translated = try XCTUnwrap(result.project, result.report)

        // The same scene, authored by hand with native semantics: gamma blending, overlay
        // constants folded into its keys, the track fade applied to its clip, pictures muted.
        var authored = Project(name: "Hand authored"); authored.media = [red, blue, pattern]; authored.blendSpace = .gamma
        var s = authored.sequences[0]; s.width = 640; s.height = 360; s.frameRate = 30
        s.tracks = [Track(name: "V2", id: "v2"), Track(name: "Base", id: "base")]
        func cover(flipH: Bool = false, scale: Double = 1) -> ClipTransform { var t = ClipTransform(); t.fill = true; t.flipH = flipH; t.scale = scale; return t }
        var c1 = Clip(assetId: pattern.id, trackId: "base", start: 0, duration: 1.5, id: "c1"); c1.sourceStart = 0.5; c1.gain = 0; c1.fadeIn = 0.3; c1.transform = cover(flipH: true)
        var c2 = Clip(assetId: blue.id, trackId: "base", start: 1.5, duration: 1.5, id: "c2"); c2.gain = 0; c2.fadeOut = 0.6; c2.transform = cover()
        var o1 = Clip(assetId: red.id, trackId: "v2", start: 0.5, duration: 2, id: "o1"); o1.gain = 0; o1.fadeIn = 0.2; o1.opacity = 0.6; o1.transform = cover(scale: 0.5)
        o1.motion = ClipMotion(keyframes: [MotionKeyframe(time: 0, value: MotionValue(x: -0.2, scale: 0.5, opacity: 0.6), easing: .easeOut),
                                           MotionKeyframe(time: 2, value: MotionValue(x: 0.2, scale: 0.75, opacity: 0.6))])
        s.videoClips = [o1, c1, c2]; authored.sequences[0] = s

        let times = [0.25, 1.0, 1.8, 2.55, 2.9]
        let fromPro = try await motionGenerator(translated), byHand = try await motionGenerator(authored)
        for time in times {
            XCTAssertLessThan(pixelError(try pixels(fromPro, at: time), try pixels(byHand, at: time)), 1, "Translated scene differs from its native equivalent at \(time)s")
        }
        // Each translated feature visibly changes the picture (the comparison above isn't vacuous).
        var unflipped = translated; unflipped.sequences[0].videoClips[unflipped.sequences[0].videoClips.firstIndex { $0.id == "c1" }!].transform?.flipH = false
        let unflippedFrames = try await motionGenerator(unflipped)
        XCTAssertGreaterThan(pixelError(try pixels(fromPro, at: 0.25), try pixels(unflippedFrames, at: 0.25)), 5, "flip")
        var bare = translated; bare.sequences[0].videoClips.removeAll { $0.id == "o1" }
        let bareFrames = try await motionGenerator(bare)
        XCTAssertGreaterThan(pixelError(try pixels(fromPro, at: 1.0), try pixels(bareFrames, at: 1.0)), 5, "overlay")
        // Gamma-space fade: code values scale linearly with the remaining ramp, like Pro's canvas.
        func meanBlue(_ bytes: [UInt8]) -> Double { stride(from: 2, to: bytes.count, by: 4).map { Double(bytes[$0]) }.reduce(0, +) / Double(bytes.count / 4) }
        // After the overlay ends: α = 0.667 at 2.6s and 0.167 at 2.9s. Gamma blending keeps
        // the 1:4 ratio of the ramp; linear light would give about 1:1.9.
        let early = meanBlue(try codeValues(fromPro, at: 2.6)), late = meanBlue(try codeValues(fromPro, at: 2.9))
        XCTAssertEqual(late / early, 0.25, accuracy: 0.03, "fade-out follows Pro's gamma-space ramp (\(late) / \(early))")
    }

    /// Pro's defaults (look, punch, zoom transitions, drop ramp) translate and each one
    /// renders through the native engine. Pixel agreement with Pro itself is measured by
    /// scripts/certify-engine-parity.mjs; this is the fast native regression.
    @MainActor func testProDefaultLookPunchZoomAndDropRampRenderNatively() async throws {
        guard let patternPath = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_PATTERN"] else { throw XCTSkip("Supply generated native fixtures.") }
        let pattern = try await NativeMedia.inspect(URL(fileURLWithPath: patternPath))
        let cut: [String: Any] = [
            "format": "scenepilot-cut", "version": 2, "project": "Pro defaults", "duration": 3, "effects": [String: Any](),
            "beats": stride(from: 0.0, through: 3, by: 0.25).map { $0 }, "sections": [["start": 0, "end": 3, "energy": 0.8]],
            "renderAnalysis": ["accents": [0, 1, 2], "dropRamp": ["dropTime": 2.4]],
            "settings": ["aspect": "16:9", "exportFrameRate": 30, "exportMaxDimension": 640, "colorCurve": "none"],
            "assets": [["id": "pattern", "name": "pattern.mp4", "kind": "video", "sourcePath": patternPath]],
            "videoClips": [["id": "a", "assetId": "pattern", "trackId": "__base__", "start": 0, "duration": 2.4],
                           ["id": "b", "assetId": "pattern", "trackId": "__base__", "start": 2.4, "duration": 0.6, "sourceStart": 0.2, "flipH": true]],
        ]
        let result = try LegacySceneTranslation.translate(JSONSerialization.data(withJSONObject: cut), filename: "defaults.scenepilot.json", linked: ["pattern": pattern])
        let full = try XCTUnwrap(result.project, result.report)
        func variant(look: Bool = false, punch: Bool = false, zoom: Bool = false, ramp: Bool = false) -> Project {
            var p = full, s = p.sequences[0]
            if !look { s.look = nil }
            if !punch { s.punch = nil }
            for i in s.videoClips.indices { if !zoom { s.videoClips[i].transitionIn = nil }; if !ramp { s.videoClips[i].speedRamp = nil } }
            p.sequences[0] = s; return p
        }
        let plain = try await motionGenerator(variant())
        func differs(_ project: Project, at time: Double) async throws -> Double { pixelError(try pixels(try await motionGenerator(project), at: time), try pixels(plain, at: time)) }

        let graded = try await differs(full, at: 1.2)
        XCTAssertGreaterThan(graded, 3, "the look kernel compiles and grades the frame")
        let punched = try await differs(variant(punch: true), at: 1.0 + 1.0 / 30)
        let zoomIn = try await differs(variant(zoom: true), at: 2.4), settled = try await differs(variant(zoom: true), at: 2.7)
        XCTAssertGreaterThan(punched, 3, "an accented beat punches the picture lane")
        XCTAssertGreaterThan(zoomIn, 5, "the cut zooms in")
        XCTAssertLessThan(settled, 1, "and settles after 0.22 s")
        let ramped = try await motionGenerator(variant(ramp: true))
        XCTAssertGreaterThan(pixelError(try pixels(ramped, at: 1.0), try pixels(plain, at: 1.0)), 5, "the ramp runs the source ahead")
        XCTAssertLessThan(pixelError(try pixels(ramped, at: 2.3), try pixels(ramped, at: 2.3 + 2.0 / 30)), 1, "then freezes into the drop")
    }

    /// The stored code values, drawn in the frame's own color space so readback applies
    /// no color conversion. (`pixels(_:at:)` color-matches video-tagged frames to sRGB,
    /// which lifts mid-tones and would hide the blend math being measured here.)
    func codeValues(_ generator: AVAssetImageGenerator, at seconds: Double) throws -> [UInt8] {
        generator.requestedTimeToleranceBefore = .zero; generator.requestedTimeToleranceAfter = .zero
        let image = try generator.copyCGImage(at: CMTime(seconds: seconds, preferredTimescale: 600_000), actualTime: nil)
        var bytes = [UInt8](repeating: 0, count: 32 * 18 * 4)
        try bytes.withUnsafeMutableBytes { raw in
            guard let space = image.colorSpace, let context = CGContext(data: raw.baseAddress, width: 32, height: 18, bitsPerComponent: 8, bytesPerRow: 32 * 4, space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw ProjectError.invalid("Cannot inspect native code values.") }
            context.draw(image, in: CGRect(x: 0, y: 0, width: 32, height: 18))
        }
        return bytes
    }

    /// Native linear-light blending differs visibly from Pro's canvas, which blends
    /// gamma-encoded sRGB. The `gamma` blend space reproduces the canvas math, which is
    /// what lets the translator carry fades and opacity.
    @MainActor func testBlendSpaceLinearIsPhysicalAndGammaMatchesProCanvas() async throws {
        guard let bluePath = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_SECOND"] else { throw XCTSkip("Supply generated native fixtures.") }
        let blue = try await NativeMedia.inspect(URL(fileURLWithPath: bluePath))
        func render(opacity: Double, space: BlendSpace?) async throws -> Double {
            var p = Project(name: "Blend space"); p.media = [blue]; p.blendSpace = space; p.sequences[0].width = 640; p.sequences[0].height = 360
            var clip = Clip(assetId: blue.id, trackId: p.sequences[0].tracks[0].id, start: 0, duration: 2); clip.opacity = opacity; clip.gain = 0
            p.sequences[0].videoClips = [clip]
            let bytes = try codeValues(try await motionGenerator(p), at: 1)
            return stride(from: 2, to: bytes.count, by: 4).map { Double(bytes[$0]) }.reduce(0, +) / Double(bytes.count / 4)
        }
        func decode(_ v: Double) -> Double { let c = v / 255; return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
        func encode(_ l: Double) -> Double { (l <= 0.0031308 ? l * 12.92 : 1.055 * pow(l, 1 / 2.4) - 0.055) * 255 }
        for space in [BlendSpace.linear, .gamma] {
            let full = try await render(opacity: 1, space: space)
            let fullDefault = try await render(opacity: 1, space: space == .linear ? nil : space)
            XCTAssertEqual(full, fullDefault, accuracy: 0.5, "opaque pixels don't depend on blend space")
            for alpha in [0.25, 0.5, 0.75] {
                let partial = try await render(opacity: alpha, space: space)
                let linearLight = encode(alpha * decode(full)), proCanvas = alpha * full
                if space == .linear {
                    XCTAssertLessThan(abs(partial - linearLight), 6, "linear blend at \(alpha): measured \(partial), expected \(linearLight)")
                    XCTAssertGreaterThan(abs(partial - proCanvas), 15, "linear blend visibly differs from Pro at \(alpha)")
                } else {
                    XCTAssertLessThan(abs(partial - proCanvas), 3, "gamma blend at \(alpha): measured \(partial), Pro canvas \(proCanvas)")
                }
            }
        }
    }
}
