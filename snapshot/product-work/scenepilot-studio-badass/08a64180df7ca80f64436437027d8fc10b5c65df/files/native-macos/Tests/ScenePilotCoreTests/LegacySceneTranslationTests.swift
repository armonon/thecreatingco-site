import XCTest
@testable import ScenePilotCore

final class LegacySceneTranslationTests: XCTestCase {
    // A Pro project whose every rendered feature has an exact native equivalent.
    private func neutralCut() -> [String: Any] {
        [
            "format": "scenepilot-cut", "version": 2, "project": "Neutral Cut", "duration": 10,
            "effects": ["punchPreset": "off", "shakePreset": "off", "strobePreset": "off", "stutterPreset": "off", "speedPreset": "off",
                        "echoPreset": "off", "lookPreset": "none", "dropRampEnabled": false, "audioReactive": false, "mirrorMode": 0, "streak": 0,
                        "transitionType": "none", "montageEnabled": true,
                        "manualGrade": ["exposure": 1, "contrast": 1, "saturation": 1, "temperature": 0, "tint": 0, "bloom": 0, "vignette": 0, "grain": 0, "aberration": 0]],
            "settings": ["aspect": "16:9", "exportFrameRate": 30, "exportMaxDimension": 1920, "colorCurve": "none", "lut3dSource": NSNull()],
            "tracks": [["id": "v2", "name": "V2 · Overlay", "enabled": true, "blend": "normal", "opacity": 100, "hue": 0, "saturation": 100, "brightness": 100, "glow": 0, "fadeIn": 0, "fadeOut": 0]],
            "assets": [["id": "a", "name": "a.mp4", "kind": "video", "sourcePath": "/media/a.mp4"], ["id": "b", "name": "b.mp4", "kind": "video", "sourcePath": "/media/b.mp4"]],
            "mainAsset": ["name": "song.wav", "kind": "audio", "sourcePath": "/media/song.wav"],
            "videoClips": [
                ["id": "c1", "assetId": "a", "trackId": "__base__", "sectionId": "s", "start": 0, "duration": 4, "sourceStart": 1, "flipH": true,
                 "color": ["exposure": 1, "contrast": 1, "saturation": 1, "hue": 0, "temperature": 0, "tint": 0], "effects": [["id": "e", "type": "blur", "amount": 0.4, "enabled": false]]],
                ["id": "c2", "assetId": "b", "trackId": "__base__", "sectionId": "s", "start": 4, "duration": 6, "sourceStart": 0, "playbackRate": 2],
                ["id": "o1", "assetId": "a", "trackId": "v2", "sectionId": "manual", "start": 1, "duration": 2, "sourceStart": 0,
                 "overlay": ["scale": 150, "opacity": 100],
                 "transformKeyframes": [["id": "k0", "time": 0, "x": 0.1, "y": 0, "scale": 1, "rotation": 0, "opacity": 1, "easing": "ease-out"],
                                        ["id": "k1", "time": 2, "x": -0.1, "y": 0.2, "scale": 2, "rotation": 45, "opacity": 1, "easing": "linear"]]],
            ],
            "proState": ["masterGain": 1, "audioClips": [Any](), "colorManagement": ["workingSpace": "rec709", "displayTransform": "rec709-100", "toneMap": "bt2390"]],
            "analysis": ["tempoConfidence": 0.9],
        ]
    }
    private let linked: [String: Media] = [
        "a": Media(path: "/media/a.mp4", duration: 20, hasVideo: true, hasAudio: true, id: "m-a"),
        "b": Media(path: "/media/b.mp4", duration: 20, hasVideo: true, hasAudio: true, id: "m-b"),
        "__main__": Media(path: "/media/song.wav", duration: 10, hasVideo: false, hasAudio: true, id: "m-song"),
    ]
    private func data(_ root: [String: Any]) throws -> Data { try JSONSerialization.data(withJSONObject: root) }
    private func translate(_ root: [String: Any], linked: [String: Media]? = nil) throws -> SceneTranslationResult {
        try LegacySceneTranslation.translate(data(root), filename: "cut.scenepilot.json", linked: linked ?? self.linked)
    }
    private func edit(_ mutate: (inout [String: Any]) -> Void) -> [String: Any] { var root = neutralCut(); mutate(&root); return root }
    private func editClip(_ index: Int, _ mutate: @escaping (inout [String: Any]) -> Void) -> [String: Any] {
        edit { root in var clips = root["videoClips"] as! [[String: Any]]; mutate(&clips[index]); root["videoClips"] = clips }
    }
    private func editSection(_ key: String, _ mutate: @escaping (inout [String: Any]) -> Void) -> [String: Any] {
        edit { root in var section = root[key] as! [String: Any]; mutate(&section); root[key] = section }
    }

    func testNeutralProjectTranslatesExactly() throws {
        let source = try data(neutralCut())
        let result = try LegacySceneTranslation.translate(source, filename: "cut.scenepilot.json", linked: linked)
        XCTAssertEqual(result.blockers, [], result.report)
        let project = try XCTUnwrap(result.project)
        XCTAssertEqual(project.translation, SceneTranslationStamp(translator: "scenepilot-cut", version: 3))
        XCTAssertEqual(project.blendSpace, .gamma, "Pro's canvas blends gamma-encoded sRGB")
        XCTAssertEqual(project.legacyArchive?.data, source, "the exact source bytes are archived")
        let s = try XCTUnwrap(project.sequences.first)
        XCTAssertEqual([s.width, s.height, s.frameRate], [1920, 1080, 30])
        XCTAssertEqual(s.tracks.map(\.id), ["v2", "__base__", "__main_audio__"], "overlays above the base lane, song last")
        let clip = { (id: String) in try XCTUnwrap(s.videoClips.first { $0.id == id }) }

        let c1 = try clip("c1")
        XCTAssertEqual([c1.start, c1.duration, c1.sourceStart, c1.rate, c1.gain, c1.fadeIn, c1.fadeOut, c1.opacity], [0, 4, 1, 1, 0, 0, 0, 1])
        XCTAssertEqual(c1.assetId, "m-a"); XCTAssertEqual(c1.trackId, "__base__")
        XCTAssertEqual(c1.transform?.fill, true); XCTAssertEqual(c1.transform?.flipH, true)
        XCTAssertEqual(try clip("c2").rate, 2)

        // Pro multiplies overlay scale into keyframes; native keys replace it, so it's folded.
        let o1 = try clip("o1")
        XCTAssertEqual(o1.transform?.scale, 1.5); XCTAssertEqual(o1.opacity, 1)
        let keys = try XCTUnwrap(o1.motion?.keyframes)
        XCTAssertEqual(keys.map(\.time), [0, 2])
        XCTAssertEqual(keys.map(\.value.scale), [1.5, 3])
        XCTAssertEqual(keys.map(\.value.opacity), [1, 1])
        XCTAssertEqual(keys.map(\.easing), [.easeOut, .linear])
        XCTAssertEqual(keys.map(\.value.x), [0.1, -0.1]); XCTAssertEqual(keys[1].value.y, 0.2); XCTAssertEqual(keys[1].value.rotation, 45)
        // Midway through an ease-out segment the folded value equals Pro's multiply-after-interpolate.
        let mid = try XCTUnwrap(o1.motion?.value(atLocalTime: 1))
        let proScale = (1 + (2 - 1) * MotionEasing.easeOut.progress(0.5)) * 1.5
        XCTAssertEqual(mid.scale, proScale, accuracy: 1e-12)

        let song = try clip("main-audio")
        XCTAssertEqual([song.start, song.duration, song.gain, song.opacity], [0, 10, 1, 0]); XCTAssertEqual(song.assetId, "m-song")
        XCTAssertEqual(project.media.map(\.id).sorted(), ["m-a", "m-b", "m-song"])

        let reopened = try Project.decode(project.encoded())
        XCTAssertEqual(reopened, project); XCTAssertEqual(reopened.version, 7)
    }

    func testMissingEffectKeysTranslateToProDefaults() throws {
        // Pro's loader fills missing keys with a cinematic look, dynamic punch, zoom transitions and the drop ramp.
        let result = try translate(edit { $0["effects"] = [String: Any]() })
        let project = try XCTUnwrap(result.project, result.report)
        let s = project.sequences[0]
        XCTAssertEqual(s.punch, BeatPunch(amount: 0.06, envelope: BeatEnvelope(attack: 0.012, decay: 0.22, accentBoost: 1.9)))
        XCTAssertEqual(s.look?.contrast, 1.14); XCTAssertEqual(s.look?.pulse, s.punch?.envelope)
        XCTAssertEqual(s.videoClips.filter { $0.trackId == "__base__" }.map(\.transitionIn), [CutTransition(kind: .zoom, duration: 0.22), CutTransition(kind: .zoom, duration: 0.22)],
                       "both base cuts inherit the zoom default, including the first")
        XCTAssertNil(s.videoClips.first { $0.id == "o1" }?.transitionIn, "transitions are a base-lane feature")
        XCTAssertTrue(s.videoClips.allSatisfy { $0.speedRamp == nil }, "a document without a saved drop has no ramp in Pro either")
        XCTAssertEqual(s.tracks.first { $0.id == "__base__" }?.followsBeat, true)
        XCTAssertNil(s.tracks.first { $0.id == "v2" }?.followsBeat, "Pro does not punch overlays")
    }

    func testRhythmPunchZoomDropRampAndLookTranslate() throws {
        let root = edit { root in
            root["beats"] = stride(from: 0.0, through: 10, by: 0.5).map { $0 }
            root["sections"] = [["id": "b", "start": 5, "end": 10, "energy": 0.9], ["id": "a", "start": 0, "end": 5, "energy": 0.3], ["id": "off", "start": 2, "end": 3, "energy": 1, "enabled": false]]
            root["renderAnalysis"] = ["accents": [4, 0, 2], "dropRamp": ["dropTime": 6]]
            var e = root["effects"] as! [String: Any]
            e["punchPreset"] = "slam"; e["lookPreset"] = "noir"; e["manualGrade"] = ["exposure": 1.1]; e["mirrorMode"] = 2; e["streak"] = 0.5
            e["transitionType"] = "zoom"; e["dropRampEnabled"] = true; root["effects"] = e
            var clips = root["videoClips"] as! [[String: Any]]; clips[1]["transitionDuration"] = 5; root["videoClips"] = clips
        }
        let result = try translate(root)
        let s = try XCTUnwrap(result.project, result.report).sequences[0]
        XCTAssertEqual(s.rhythm?.accents, [0, 2, 4])
        XCTAssertEqual(s.rhythm?.sections, [EnergySection(start: 0, end: 5, energy: 0.3), EnergySection(start: 5, end: 10, energy: 0.9)], "sorted, disabled sections dropped")
        XCTAssertEqual(s.punch?.amount, 0.12)
        let look = try XCTUnwrap(s.look)
        for (value, expected) in zip([look.exposure, look.contrast, look.saturation, look.vignette, look.streak], [1.1, 1.3, 0.12, 0.5, 0.5]) { XCTAssertEqual(value, expected, accuracy: 1e-12) }
        XCTAssertEqual(look.mirror, 2); XCTAssertEqual(look.pulse, LegacyLook.punch["slam"])
        let clip = { (id: String) in s.videoClips.first { $0.id == id } }
        XCTAssertEqual(clip("c1")?.transitionIn?.duration, 0.22)
        XCTAssertEqual(clip("c2")?.transitionIn?.duration, 2, "clamped to 2 s, the cut and the previous cut")
        let ramp = SpeedRamp(start: 2, end: 6, strength: 3.2) // 8 beats of 0.5 s into the drop
        XCTAssertEqual(clip("c1")?.speedRamp, ramp); XCTAssertEqual(clip("c2")?.speedRamp, ramp)
        XCTAssertNil(clip("o1")?.speedRamp, "overlays keep real time")
        XCTAssertTrue(result.translated.map(\.feature).contains("effects.dropRampEnabled"))

        let moved = try translate(edit { root in
            root["beats"] = [0, 0.5, 1]; root["renderAnalysis"] = ["accents": [Any](), "dropRamp": ["dropTime": 6]]
            var e = root["effects"] as! [String: Any]; e["dropRampEnabled"] = true; root["effects"] = e
            var p = root["proState"] as! [String: Any]; p["manualDropTime"] = 5; root["proState"] = p
        })
        XCTAssertEqual(try XCTUnwrap(moved.project).sequences[0].videoClips.first { $0.id == "c2" }?.speedRamp?.end, 5, "a hand-placed drop wins")
    }

    func testEveryUnsupportedFeatureBlocksWithItsOwnFinding() throws {
        let cases: [(String, [String: Any])] = [
            ("clip.color", editClip(0) { $0["color"] = ["exposure": 1.2, "contrast": 1, "saturation": 1, "hue": 0] }),
            ("clip.color", editClip(0) { $0["color"] = ["exposure": 1, "tint": 0.1] }),
            ("clip.effects", editClip(0) { $0["effects"] = [["id": "e", "type": "glow", "amount": 0.5, "enabled": true]] }),
            ("clip.effects", editClip(0) { $0["effects"] = [["id": "e", "type": "blur", "amount": 0, "enabled": true, "keyframes": [["time": 0, "amount": 1]]]] }),
            ("clip.reversed", editClip(0) { $0["reversed"] = true }),
            ("clip.timeRemap", editClip(0) { $0["timeRemap"] = [["id": "t0", "time": 0, "sourceTime": 3], ["id": "t1", "time": 4, "sourceTime": 0]] }),
            ("clip.transition", editClip(1) { $0["transitionType"] = "dissolve" }),
            ("clip.transition", editSection("effects") { $0["transitionType"] = "whip" }),
            ("rhythm.beats", edit { $0["beats"] = [1, 0.5] }),
            ("rhythm.sections", edit { $0["sections"] = [["start": 0, "end": "late", "energy": 0.5]] }),
            ("renderAnalysis.accents", edit { $0["renderAnalysis"] = ["accents": ["downbeat"]] }),
            ("renderAnalysis.dropRamp", edit { $0["renderAnalysis"] = ["accents": [Any](), "dropRamp": ["dropTime": -1]] }),
            ("effects.shakePreset", editSection("effects") { $0["shakePreset"] = "riot" }),
            ("motion.easing.ease-in-out", editClip(2) { var k = $0["transformKeyframes"] as! [[String: Any]]; k[0]["easing"] = "ease-in-out"; $0["transformKeyframes"] = k }),
            ("motion.easing.custom", editClip(2) { var k = $0["transformKeyframes"] as! [[String: Any]]; k[0]["easing"] = "custom"; $0["transformKeyframes"] = k }),
            ("motion.spatialPath", editClip(2) { var k = $0["transformKeyframes"] as! [[String: Any]]; k[0]["spatialOut"] = ["x": 0, "y": 0]; $0["transformKeyframes"] = k }),
            ("motion.range", editClip(2) { var k = $0["transformKeyframes"] as! [[String: Any]]; k[1]["x"] = 50; $0["transformKeyframes"] = k }),
            ("clip.composition", editClip(2) { $0["overlay"] = ["scale": 100, "opacity": 100, "compositionId": "comp-1"] }),
            ("clip.unrecognized.stabilization", editClip(0) { $0["stabilization"] = ["strength": 0.6] }),
            ("clip.fadesOverlap", editClip(0) { $0["fadeIn"] = 3; $0["fadeOut"] = 2 }),
            ("clip.beyondSource", editClip(1) { $0["duration"] = 12 }),
            ("track.overlap", editClip(1) { $0["start"] = 3.5 }),
            ("clip.missingTrack", editClip(2) { $0["trackId"] = "v9" }),
            ("effects.strobePreset", editSection("effects") { $0["strobePreset"] = "rave" }),
            ("effects.audioReactive", editSection("effects") { $0["audioReactive"] = true }),
            ("effects.montageEnabled", editSection("effects") { $0["montageEnabled"] = false }),
            ("settings.colorCurve", editSection("settings") { $0["colorCurve"] = "contrast" }),
            ("settings.lut3dSource", editSection("settings") { $0["lut3dSource"] = ["name": "Film", "lut": ["size": 2]] }),
            ("unrecognized.settings.hdrOutput", editSection("settings") { $0["hdrOutput"] = true }),
            ("proState.audioClips", editSection("proState") { $0["audioClips"] = [["id": "dialog"]] }),
            ("proState.masterGain", editSection("proState") { $0["masterGain"] = 0.5 }),
            ("proState.colorManagement", editSection("proState") { $0["colorManagement"] = ["workingSpace": "rec2020-pq", "displayTransform": "rec709-100"] }),
            ("unrecognized.proState.spatialAudio", editSection("proState") { $0["spatialAudio"] = ["enabled": true] }),
            ("titles", edit { $0["titles"] = [["id": "t", "text": "HELLO", "start": 1, "duration": 1]] }),
            ("unrecognized.futureFeature", edit { $0["futureFeature"] = ["on": true] }),
            ("track.blend", edit { var t = $0["tracks"] as! [[String: Any]]; t[0]["blend"] = "screen"; $0["tracks"] = t }),
            ("track.blend", edit { var t = $0["tracks"] as! [[String: Any]]; t[0].removeValue(forKey: "blend"); $0["tracks"] = t }),
            ("track.hue", edit { var t = $0["tracks"] as! [[String: Any]]; t[0]["hue"] = 20; $0["tracks"] = t }),
        ]
        for (feature, root) in cases {
            let result = try translate(root)
            XCTAssertNil(result.project, "\(feature) must not produce a partial project")
            XCTAssertNotNil(result.blockerCounts[feature], "expected \(feature); got \(result.blockerCounts.keys.sorted())")
            XCTAssertTrue(result.report.contains("[\(feature)]"), "report names \(feature)")
        }
    }

    func testFadesAndOpacityTranslateWithGammaBlending() throws {
        let root = edit { root in
            var clips = root["videoClips"] as! [[String: Any]]
            clips[0]["fadeIn"] = 0.5
            clips[2]["overlay"] = ["scale": 150, "opacity": 80]
            var keys = clips[2]["transformKeyframes"] as! [[String: Any]]; keys[1]["opacity"] = 0.5; clips[2]["transformKeyframes"] = keys
            root["videoClips"] = clips
            var tracks = root["tracks"] as! [[String: Any]]; tracks[0]["fadeOut"] = 0.1; tracks[0]["opacity"] = 50; root["tracks"] = tracks
        }
        let result = try translate(root)
        let project = try XCTUnwrap(result.project, result.report)
        XCTAssertEqual(project.blendSpace, .gamma)
        let clips = project.sequences[0].videoClips
        XCTAssertEqual(clips.first { $0.id == "c1" }?.fadeIn, 0.5)
        let o1 = try XCTUnwrap(clips.first { $0.id == "o1" })
        XCTAssertEqual(o1.fadeOut, 0.1, "Pro takes the larger of the track and clip fade")
        // Overlay 80% × track 50% multiplies into every key, as Pro multiplies it per frame.
        XCTAssertEqual(o1.opacity, 0.4, accuracy: 1e-12)
        let keys = try XCTUnwrap(o1.motion?.keyframes)
        XCTAssertEqual(keys[0].value.opacity, 0.4, accuracy: 1e-12); XCTAssertEqual(keys[1].value.opacity, 0.2, accuracy: 1e-12)
    }

    func testNeutralValuesDoNotBlock() throws {
        // Disabled or zero effects, identity color, off presets and an unused LUT mix are no-ops in Pro.
        let root = edit { root in
            var clips = root["videoClips"] as! [[String: Any]]
            clips[1]["effects"] = [["id": "z", "type": "glow", "amount": 0, "enabled": true, "expression": ["source": "none"]]]
            clips[1]["timeRemap"] = [["id": "one", "time": 0, "sourceTime": 0]]
            clips[1]["reversed"] = false
            root["videoClips"] = clips
            var settings = root["settings"] as! [String: Any]; settings["lut3dMix"] = 0.7; root["settings"] = settings
            root["titles"] = [Any]()
        }
        let result = try translate(root)
        XCTAssertTrue(result.isExact, result.report)
    }

    func testBlockersAreExhaustiveAndTrackFindingsAreNotDuplicated() throws {
        let root = edit { root in
            var clips = root["videoClips"] as! [[String: Any]]
            clips[0]["reversed"] = true
            clips[1]["color"] = ["saturation": 0]
            var second = clips[2]; second["id"] = "o2"; second["start"] = 5; clips.append(second)
            root["videoClips"] = clips
            var t = root["tracks"] as! [[String: Any]]; t[0]["blend"] = "overlay"; root["tracks"] = t
            var e = root["effects"] as! [String: Any]; e["shakePreset"] = "kick"; root["effects"] = e
        }
        let result = try translate(root)
        XCTAssertNil(result.project)
        XCTAssertEqual(result.blockerCounts["clip.reversed"], 1)
        XCTAssertEqual(result.blockerCounts["clip.color"], 1)
        XCTAssertEqual(result.blockerCounts["effects.shakePreset"], 1)
        XCTAssertEqual(result.blockerCounts["track.blend"], 1, "a track with two clips is reported once")
    }

    func testOfflineMediaIsReportedNotThrown() throws {
        var partial = linked; partial.removeValue(forKey: "b"); partial.removeValue(forKey: "__main__")
        let result = try translate(neutralCut(), linked: partial)
        XCTAssertNil(result.project)
        XCTAssertEqual(result.blockerCounts["media.offline"], 2, "one cut and the main source")
    }

    func testWithoutBaseCutsTheMainSourceIsLetterboxedLikePro() throws {
        let root = edit { root in
            root["videoClips"] = (root["videoClips"] as! [[String: Any]]).filter { $0["overlay"] != nil }
            root["mainAsset"] = ["name": "clip.mov", "kind": "video", "sourcePath": "/media/clip.mov"]
        }
        var videoMain = linked; videoMain["__main__"] = Media(path: "/media/clip.mov", duration: 12, hasVideo: true, hasAudio: true, id: "m-main")
        let project = try XCTUnwrap(try translate(root, linked: videoMain).project)
        let picture = try XCTUnwrap(project.sequences[0].videoClips.first { $0.id == "main-picture" })
        XCTAssertEqual(picture.transform?.fill, false, "Pro fits the continuous main source inside the frame")
        XCTAssertEqual([picture.start, picture.duration, picture.gain], [0, 10, 0])
    }

    func testSoloTracksDisableTheOthers() throws {
        let root = edit { root in
            var tracks = root["tracks"] as! [[String: Any]]
            var solo = tracks[0]; solo["id"] = "v3"; solo["name"] = "V3"; solo["solo"] = true
            tracks.append(solo); root["tracks"] = tracks
        }
        let s = try XCTUnwrap(try translate(root).project).sequences[0]
        XCTAssertEqual(s.tracks.first { $0.id == "v2" }?.enabled, false)
        XCTAssertEqual(s.tracks.first { $0.id == "v3" }?.enabled, true)
        XCTAssertEqual(s.tracks.prefix(2).map(\.id), ["v3", "v2"], "Pro draws later tracks on top; native lists the top first")
    }

    func testLegacyBaseCutsAndPlacementsFormatTranslates() throws {
        let root = edit { root in
            let clips = root["videoClips"] as! [[String: Any]]
            root.removeValue(forKey: "videoClips")
            root["baseCuts"] = clips.filter { $0["overlay"] == nil }.map { var c = $0; c.removeValue(forKey: "trackId"); return c }
            root["placements"] = clips.filter { $0["overlay"] != nil }.map { c -> [String: Any] in
                var p = c; p.removeValue(forKey: "overlay"); p["scale"] = 150; p["opacity"] = 100; return p
            }
        }
        let result = try translate(root)
        let project = try XCTUnwrap(result.project, result.report)
        let o1 = try XCTUnwrap(project.sequences[0].videoClips.first { $0.id == "o1" })
        XCTAssertEqual(o1.transform?.scale, 1.5); XCTAssertEqual(o1.opacity, 1)
    }

    func testEditorialRebuildStillResolvesOutputFormat() throws {
        let rebuilt = try LegacyEditorialRebuild.rebuild(data(neutralCut()), filename: "cut.scenepilot.json", linked: linked)
        XCTAssertEqual([rebuilt.sequences[0].width, rebuilt.sequences[0].height, rebuilt.sequences[0].frameRate], [1920, 1080, 30])
    }
}
