import XCTest
@testable import ScenePilotCore

final class MotionTests: XCTestCase {
    func curve(_ easing: MotionEasing = .linear) -> ClipMotion {
        ClipMotion(keyframes: [MotionKeyframe(time: 0, value: MotionValue(opacity: 0.2), easing: easing), MotionKeyframe(time: 2, value: MotionValue(x: 0.4, y: -0.4, scale: 2, rotation: 720, opacity: 1))])
    }
    func fixture() -> Project {
        var p = Project(); p.media = [Media(path: "/tmp/motion.mov", duration: 30, hasVideo: true, hasAudio: true)]
        p.sequences[0].videoClips = (0..<3).map { n in
            var c = Clip(assetId: p.media[0].id, trackId: p.sequences[0].tracks[0].id, start: Double(n * 3), duration: 3, id: "c\(n)")
            c.sourceStart = 3; c.rate = 2; c.motion = curve(); return c
        }
        return p
    }
    func testLinearAllChannelsEndpointHoldAndRotationTurns() throws {
        let m = curve(); try m.validate()
        XCTAssertEqual(m.value(atLocalTime: -3), m.keyframes[0].value)
        XCTAssertEqual(m.value(atLocalTime: 5), m.keyframes[1].value)
        let v = try XCTUnwrap(m.value(atLocalTime: 1))
        XCTAssertEqual(v.x, 0.2); XCTAssertEqual(v.y, -0.2); XCTAssertEqual(v.scale, 1.5); XCTAssertEqual(v.rotation, 360)
        XCTAssertEqual(v.opacity, 0.6, accuracy: 0.00001)
        XCTAssertNil(m.value(atLocalTime: .nan))
    }
    func testEasingAndHoldSwitchAtExactKey() throws {
        for (ease, fraction) in [(MotionEasing.linear,0.25),(.smooth,0.15625),(.easeIn,0.0625),(.easeOut,0.4375),(.hold,0)] {
            let m = curve(ease)
            XCTAssertEqual(try XCTUnwrap(m.value(atLocalTime: 0.5)).x, 0.4 * fraction, accuracy: 0.00001)
            XCTAssertEqual(m.value(atLocalTime: 2), m.keyframes[1].value)
        }
        var m = curve(.hold); m.keyframes.append(MotionKeyframe(time: 4, value: MotionValue()))
        XCTAssertEqual(m.value(atLocalTime: 2), m.keyframes[1].value)
    }
    func testRejectMalformedMotionBeforeSaving() throws {
        var p = fixture()
        let bad: [ClipMotion] = [ClipMotion(keyframes: []), ClipMotion(keyframes: curve().keyframes.reversed()), ClipMotion(keyframes: [curve().keyframes[0],curve().keyframes[0]]), ClipMotion(keyframes: curve().keyframes, offset: .infinity), ClipMotion(keyframes: [MotionKeyframe(time: .nan, value: MotionValue())]), ClipMotion(keyframes: [MotionKeyframe(time: 0, value: MotionValue(scale: 0))]), ClipMotion(keyframes: [MotionKeyframe(time: 0, value: MotionValue(opacity: 1.1))]), ClipMotion(keyframes: (0...4096).map { MotionKeyframe(time: Double($0), value: MotionValue()) })]
        for motion in bad { p.sequences[0].videoClips[0].motion = motion; XCTAssertThrowsError(try p.encoded()) }
    }
    func testSchemaUpgradeAndFutureVersionRefusal() throws {
        let p = fixture(); XCTAssertEqual(p.version, 7); XCTAssertEqual(try Project.decode(p.encoded()), p)
        var old = p; for i in old.sequences[0].videoClips.indices { old.sequences[0].videoClips[i].motion = nil }
        for version in [1,2,3,4,5,6] {
            var raw = try JSONSerialization.jsonObject(with: old.encoded()) as! [String:Any]; raw["version"] = version
            XCTAssertEqual(try Project.decode(JSONSerialization.data(withJSONObject: raw)), old)
        }
        var raw = try JSONSerialization.jsonObject(with: p.encoded()) as! [String:Any]; raw["version"] = 8
        XCTAssertThrowsError(try Project.decode(JSONSerialization.data(withJSONObject: raw)))
        var downgraded = p; downgraded.version = 2; XCTAssertThrowsError(try downgraded.encoded())
        for malformed: Any in [true, 1.5, "3"] {
            raw["version"] = malformed
            XCTAssertThrowsError(try Project.decode(JSONSerialization.data(withJSONObject: raw)))
        }
    }
    func testRepeatedSplitAndHeadTrimPreserveClockAtAllSupportedRates() throws {
        for fps in [24,25,30,50,60] {
            var p = fixture(); p.sequences[0].frameRate = fps
            let original = p.sequences[0].videoClips[0]
            p = try Edit.split(p, sequenceId: p.mainSequenceId, clipId: "c0", at: 1)
            let right = p.sequences[0].videoClips[1]
            p = try Edit.split(p, sequenceId: p.mainSequenceId, clipId: right.id, at: 2)
            for c in p.sequences[0].videoClips.prefix(3) {
                XCTAssertEqual(c.motionValue(atLocalTime: 0.25), original.motionValue(atLocalTime: c.start + 0.25))
            }
            p = try Edit.trim(p, sequenceId: p.mainSequenceId, clipId: right.id, edge: .head, to: 1.4)
            let c = p.sequences[0].videoClips[1]
            XCTAssertEqual(c.motionValue(atLocalTime: 0.1).x, original.motionValue(atLocalTime: c.start + 0.1).x, accuracy: 0.00001)
        }
    }
    func testRollSlideAndExtendedHeadPreserveNeighborMotion() throws {
        let p = fixture()
        let rolled = try Edit.roll(p, sequenceId: p.mainSequenceId, clipId: "c0", by: 15)
        XCTAssertEqual(rolled.sequences[0].videoClips[1].motion?.offset, 0.5)
        let slid = try Edit.slide(p, sequenceId: p.mainSequenceId, clipId: "c1", by: -15)
        XCTAssertEqual(slid.sequences[0].videoClips[1].motion, p.sequences[0].videoClips[1].motion)
        XCTAssertEqual(slid.sequences[0].videoClips[2].motion?.offset, -0.5)
        let extended = try Edit.trim(p, sequenceId: p.mainSequenceId, clipId: "c1", edge: .head, to: 2.5).sequences[0].videoClips[1]
        XCTAssertEqual(extended.motion?.offset, -0.5)
        XCTAssertEqual(extended.motionValue(atLocalTime: 0), curve().keyframes[0].value)
    }
    func testSlipMoveRateAndDuplicateKeepTimelineRelativeAnimation() throws {
        var p = fixture(); p.sequences[0].videoClips = [p.sequences[0].videoClips[0]]
        let original = p.sequences[0].videoClips[0]
        p = try Edit.slip(p, sequenceId: p.mainSequenceId, clipId: "c0", by: 15)
        p = try Edit.transact(p, sequenceId: p.mainSequenceId) { $0.videoClips[0].start = 4; $0.videoClips[0].rate = 1 }
        p = try Edit.duplicate(p, sequenceId: p.mainSequenceId, clipId: "c0")
        XCTAssertEqual(p.sequences[0].videoClips.map { $0.motionValue(atLocalTime: 1) }, [original.motionValue(atLocalTime: 1),original.motionValue(atLocalTime: 1)])
    }
    func testKeyEditsQuantizeReplacePreserveEasingAndUndo() throws {
        let p = fixture(); var h = DocumentHistory(p)
        let next = try Edit.motionKey(p, sequenceId: p.mainSequenceId, clipId: "c0", at: 1.001, value: MotionValue(x: 0.3), easing: .smooth)
        try h.apply(next); XCTAssertEqual(h.project.sequences[0].videoClips[0].motion?.keyframes.count, 3)
        let replaced = try Edit.motionKey(next, sequenceId: p.mainSequenceId, clipId: "c0", at: 0.999, value: MotionValue(x: 0.5))
        let keys = try XCTUnwrap(replaced.sequences[0].videoClips[0].motion?.keyframes)
        XCTAssertEqual(keys.count, 3); XCTAssertEqual(keys[1].time, 1); XCTAssertEqual(keys[1].value.x, 0.5); XCTAssertEqual(keys[1].easing, .smooth)
        h.undo(); XCTAssertEqual(h.project, p); h.redo(); XCTAssertEqual(h.project, next)
        XCTAssertThrowsError(try Edit.motionKey(p, sequenceId: p.mainSequenceId, clipId: "c0", at: 3))
        XCTAssertThrowsError(try Edit.motionKey(p, sequenceId: p.mainSequenceId, clipId: "c0", at: .nan))
    }
    func testRemoveLastKeyAndBakeDoNotJumpAndRetainFitFlips() throws {
        var p = fixture(); var t = ClipTransform(); t.fill = true; t.flipH = true; p.sequences[0].videoClips[0].transform = t
        let expected = p.sequences[0].videoClips[0].motionValue(atLocalTime: 1)
        let baked = try Edit.clearMotion(p, sequenceId: p.mainSequenceId, clipId: "c0", at: 1).sequences[0].videoClips[0]
        XCTAssertNil(baked.motion); XCTAssertEqual(baked.motionValue(atLocalTime: 0), expected); XCTAssertEqual(baked.transform?.fill, true); XCTAssertEqual(baked.transform?.flipH, true)
        p = try Edit.motionKey(p, sequenceId: p.mainSequenceId, clipId: "c0", at: 0, remove: true)
        let held = p.sequences[0].videoClips[0].motionValue(atLocalTime: 2)
        p = try Edit.motionKey(p, sequenceId: p.mainSequenceId, clipId: "c0", at: 2, remove: true)
        XCTAssertNil(p.sequences[0].videoClips[0].motion); XCTAssertEqual(p.sequences[0].videoClips[0].motionValue(atLocalTime: 0), held)
        XCTAssertThrowsError(try Edit.motionKey(p, sequenceId: p.mainSequenceId, clipId: "c0", at: 1, remove: true))
    }
    func testLockedAudioRefusesAndNestedGroupAnimationWorks() throws {
        var p = fixture(); p.sequences[0].tracks[0].locked = true
        XCTAssertThrowsError(try Edit.motionKey(p, sequenceId: p.mainSequenceId, clipId: "c0", at: 0))
        XCTAssertThrowsError(try Edit.clearMotion(p, sequenceId: p.mainSequenceId, clipId: "c0", at: 0))
        p.sequences[0].tracks[0].locked = false; p.media[0].hasVideo = false
        XCTAssertThrowsError(try p.validated()); XCTAssertThrowsError(try Edit.motionKey(p, sequenceId: p.mainSequenceId, clipId: "c0", at: 0))
        p = fixture(); var child = p.sequences[0]; child.id = "child"; p.sequences.append(child)
        p.sequences[0].videoClips[0].assetId = nil; p.sequences[0].videoClips[0].compositionId = "child"
        XCTAssertNoThrow(try p.validated())
        XCTAssertNoThrow(try Edit.motionKey(p, sequenceId: p.mainSequenceId, clipId: "c0", at: 0))
    }
    func testEditingTrimmedKeyUsesPreservedClock() throws {
        var p = fixture(); p = try Edit.trim(p, sequenceId: p.mainSequenceId, clipId: "c1", edge: .head, to: 3.5)
        p = try Edit.motionKey(p, sequenceId: p.mainSequenceId, clipId: "c1", at: 4, value: MotionValue(x: -0.2))
        let c = p.sequences[0].videoClips[1]
        XCTAssertEqual(c.motion?.keyframes[1].time, 1); XCTAssertEqual(c.motionValue(atLocalTime: 0.5).x, -0.2)
    }
    func testMoveKeyQuantizesPreservesPoseAndIsUndoable() throws {
        for fps in [24,25,30,50,60] {
            var p = fixture(); p.sequences[0].frameRate = fps
            p = try Edit.trim(p, sequenceId: p.mainSequenceId, clipId: "c1", edge: .head, to: 3.5)
            let next = try Edit.moveMotionKey(p, sequenceId: p.mainSequenceId, clipId: "c1", keyTime: 2, to: 4.001)
            let moved = try XCTUnwrap(next.sequences[0].videoClips[1].motion?.keyframes.last)
            XCTAssertEqual(moved.time, 1, accuracy: 0.00001); XCTAssertEqual(moved.value, curve().keyframes[1].value); XCTAssertEqual(moved.easing, .linear)
            XCTAssertEqual(next.sequences[0].videoClips[1].start, p.sequences[0].videoClips[1].start)
            XCTAssertEqual(try Project.decode(next.encoded()), next)
            var history = DocumentHistory(p); try history.apply(next); history.undo(); XCTAssertEqual(history.project, p); history.redo(); XCTAssertEqual(history.project, next)
        }
    }
    func testKeyMoveRejectsCollisionLocksAndClipBounds() throws {
        let p = fixture()
        for time in [0.0, -1, 3, Double.nan, Double.infinity] {
            XCTAssertThrowsError(try Edit.moveMotionKey(p, sequenceId: p.mainSequenceId, clipId: "c0", keyTime: 2, to: time))
        }
        XCTAssertThrowsError(try Edit.moveMotionKey(p, sequenceId: p.mainSequenceId, clipId: "c0", keyTime: 100, to: 1))
        var locked = p; locked.sequences[0].tracks[0].locked = true
        XCTAssertThrowsError(try Edit.moveMotionKey(locked, sequenceId: p.mainSequenceId, clipId: "c0", keyTime: 2, to: 1))
        XCTAssertEqual(try Edit.moveMotionKey(p, sequenceId: p.mainSequenceId, clipId: "c0", keyTime: 2, to: 2), p)
    }
}
