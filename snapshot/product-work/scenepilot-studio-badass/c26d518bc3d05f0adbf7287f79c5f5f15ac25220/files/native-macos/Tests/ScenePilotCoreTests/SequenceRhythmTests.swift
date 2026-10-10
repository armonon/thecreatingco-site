import XCTest
@testable import ScenePilotCore

/// Expected values come from Pro's own functions (lib/motion.ts, lib/transitions.ts,
/// lib/speed.ts, lib/grade.ts) evaluated in Node on the same inputs.
final class SequenceRhythmTests: XCTestCase {
    private let rhythm = SequenceRhythm(beats: [0, 0.5, 1, 1.5, 2], accents: [0, 1],
                                        sections: [EnergySection(start: 0, end: 1, energy: 0.2), EnergySection(start: 1, end: 3, energy: 0.9)])
    private let times = [0.005, 0.1, 0.6, 1.05, 2.3]

    func testBeatPunchMatchesProIncludingAccentsAndSectionEnergy() {
        let punch = BeatPunch(amount: 0.06, envelope: LegacyLook.punch["dynamic"]!)
        let pro = [1.027075, 1.0435573965913958, 1.022924945574419, 1.1117419575515317, 1.018877575575343]
        for (time, expected) in zip(times, pro) { XCTAssertEqual(punch.scale(at: time, rhythm: rhythm), expected, accuracy: 1e-12, "t=\(time)") }
        XCTAssertEqual(punch.scale(at: 0.1, rhythm: SequenceRhythm(beats: [])), 1, "no beats, no punch")
    }

    func testBeatEnvelopeMatchesProForASnapAttack() {
        let pro = [2.1323131158479574, 1.1775751427417787, 0.5352614285189903, 1.6095543836826116, 0.15335496684492864]
        for (time, expected) in zip(times, pro) { XCTAssertEqual(rhythm.envelope(at: time, LegacyLook.punch["slam"]!), expected, accuracy: 1e-12, "t=\(time)") }
        XCTAssertEqual(rhythm.envelope(at: -0.1, LegacyLook.punch["slam"]!), 0, "before the first beat")
    }

    func testZoomTransitionMatchesPro() {
        let zoom = CutTransition(kind: .zoom, duration: 0.22)
        for (elapsed, expected) in zip([0, 0.05, 0.2, 0.3], [1.18, 1.1074793388429751, 1.0014876033057851, 1]) {
            XCTAssertEqual(zoom.scale(elapsed: elapsed), expected, accuracy: 1e-12)
        }
    }

    func testDropRampMatchesProAndResyncsAtTheDrop() {
        let ramp = SpeedRamp(start: 6 - 8 * 0.5, end: 6, strength: 3.2)
        for (time, expected) in zip([1.5, 2.5, 3.7, 5.9, 6], [1.5, 3.390929820695292, 5.319235196006614, 5.999970113984382, 6]) {
            XCTAssertEqual(ramp.warp(time), expected, accuracy: 1e-12, "t=\(time)")
        }
    }

    func testLookFollowsSectionEnergyLikePro() {
        let look = LegacyLook.resolve(["lookPreset": "cinematic"], preset: "cinematic")!.at(energy: 0.3)
        let pro = [1.0152, 1.1063999999999998, 0.9392, 0.0912, 0, 0.26599999999999996, 0.001368, 0.2432, 0.038000000000000006]
        let native = [look.exposure, look.contrast, look.saturation, look.temperature, look.tint, look.bloom, look.aberration, look.vignette, look.grain]
        for (a, b) in zip(native, pro) { XCTAssertEqual(a, b, accuracy: 1e-12) }
        XCTAssertNil(LegacyLook.resolve([:], preset: "none"), "no grade pass when nothing is graded")
        XCTAssertNotNil(LegacyLook.resolve(["streak": 0.4], preset: "none"), "a streak alone still needs the pass")
    }

    func testRhythmValidationRejectsUnsortedOrNonFiniteTimes() {
        XCTAssertThrowsError(try SequenceRhythm(beats: [1, 0]).validate())
        XCTAssertThrowsError(try SequenceRhythm(beats: [0, .nan]).validate())
        XCTAssertThrowsError(try SpeedRamp(start: 2, end: 2, strength: 3).validate())
        XCTAssertThrowsError(try CutTransition(kind: .zoom, duration: 0).validate())
        XCTAssertNoThrow(try rhythm.validate())
    }
}
