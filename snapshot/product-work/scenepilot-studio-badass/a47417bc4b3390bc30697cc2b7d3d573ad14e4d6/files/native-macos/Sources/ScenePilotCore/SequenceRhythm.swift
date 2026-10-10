import Foundation

// Music-driven picture: beat punch, cut transitions, the drop ramp and the sequence
// look. Every formula matches the Pro compositor term for term (lib/motion.ts,
// lib/transitions.ts, lib/speed.ts, lib/grade.ts), so a translated scene renders
// the same frames; scripts/certify-engine-parity.mjs measures that claim.

/// A span of the song with its intensity, 0 (calm) to 1 (hottest).
public struct EnergySection: Codable, Equatable, Sendable {
    public var start: Double
    public var end: Double
    public var energy: Double
    public init(start: Double, end: Double, energy: Double) { self.start = start; self.end = end; self.energy = energy }
}

/// The song's timing: beats, accented beats (downbeats) and energy sections, all in
/// sequence seconds. Drives punch, the look's beat pulse and section intensity.
public struct SequenceRhythm: Codable, Equatable, Sendable {
    public var beats: [Double]
    /// A subset of `beats` that hit harder.
    public var accents: [Double]
    /// Sorted by start. Empty means every section is full intensity.
    public var sections: [EnergySection]
    public init(beats: [Double], accents: [Double] = [], sections: [EnergySection] = []) { self.beats = beats; self.accents = accents; self.sections = sections }

    public func validate() throws {
        func sorted(_ list: [Double], _ what: String) throws {
            guard list.count <= 100_000, list.allSatisfy({ $0.isFinite && $0 >= 0 && $0 <= 86400 }), zip(list, list.dropFirst()).allSatisfy({ $0 <= $1 }) else {
                throw ProjectError.invalid("Rhythm \(what) must be sorted, finite times (at most 100,000).")
            }
        }
        try sorted(beats, "beats"); try sorted(accents, "accents")
        guard sections.count <= 10_000, sections.allSatisfy({ [$0.start, $0.end, $0.energy].allSatisfy(\.isFinite) }),
              zip(sections, sections.dropFirst()).allSatisfy({ $0.start <= $1.start }) else { throw ProjectError.invalid("Energy sections must be finite and sorted by start.") }
    }

    /// Section intensity at `time`, clamped to 0...1; nil when there are no sections.
    public func energy(at time: Double) -> Double? {
        guard let first = sections.first, let last = sections.last else { return nil }
        let value = time < first.start ? first.energy : sections.first(where: { time >= $0.start && time < $0.end })?.energy ?? last.energy
        return min(1, max(0, value))
    }

    /// Strength of the most recent beat at `time`: 0 at rest, 1 at a plain beat's
    /// peak, `accentBoost` at an accented beat's peak.
    public func envelope(at time: Double, _ shape: BeatEnvelope) -> Double {
        guard let index = Self.lastIndex(beats, atOrBefore: time) else { return 0 }
        let beat = beats[index], value = shape.value(elapsed: time - beat)
        guard value > 0 else { return 0 }
        let accented = Self.lastIndex(accents, atOrBefore: beat + 1e-4).map { abs(accents[$0] - beat) < 1e-3 } ?? false
        return value * (accented ? shape.accentBoost : 1)
    }

    static func lastIndex(_ times: [Double], atOrBefore time: Double) -> Int? {
        var low = 0, high = times.count - 1, found: Int?
        while low <= high {
            let mid = (low + high) / 2
            if times[mid] <= time { found = mid; low = mid + 1 } else { high = mid - 1 }
        }
        return found
    }
}

/// How one beat hit rises and settles: a linear attack, then an exponential decay.
public struct BeatEnvelope: Codable, Equatable, Sendable {
    public var attack: Double
    public var decay: Double
    public var accentBoost: Double
    public init(attack: Double, decay: Double, accentBoost: Double) { self.attack = attack; self.decay = decay; self.accentBoost = accentBoost }
    public func value(elapsed: Double) -> Double {
        if elapsed < 0 { return 0 }
        if attack > 0 && elapsed < attack { return elapsed / attack }
        return exp(-(elapsed - max(0, attack)) / max(1e-3, decay))
    }
    func validate() throws {
        guard attack.isFinite, decay.isFinite, accentBoost.isFinite, (0...1).contains(attack), (0...5).contains(decay), (0...5).contains(accentBoost) else {
            throw ProjectError.invalid("Beat envelope values are out of range.")
        }
    }
}

/// A zoom kick on every beat, applied to clips on tracks that follow the beat. Its
/// size scales with section energy (0.4× in the calmest passage up to 1.25×).
public struct BeatPunch: Codable, Equatable, Sendable {
    /// Extra zoom at a plain beat's peak, as a fraction (0.06 = +6%).
    public var amount: Double
    public var envelope: BeatEnvelope
    public init(amount: Double, envelope: BeatEnvelope) { self.amount = amount; self.envelope = envelope }
    public func scale(at time: Double, rhythm: SequenceRhythm) -> Double {
        let size = amount * (rhythm.energy(at: time).map { 0.4 + 0.85 * $0 } ?? 1)
        guard !rhythm.beats.isEmpty, size > 0 else { return 1 }
        return 1 + size * rhythm.envelope(at: time, envelope)
    }
    func validate() throws {
        try envelope.validate()
        guard amount.isFinite, (0...1).contains(amount) else { throw ProjectError.invalid("Beat punch amount must be between 0 and 1.") }
    }
}

/// What plays into a clip at its first frame. Zoom starts 18% in and settles to rest.
public struct CutTransition: Codable, Equatable, Sendable {
    public enum Kind: String, Codable, Sendable { case zoom }
    public var kind: Kind
    public var duration: Double
    public init(kind: Kind, duration: Double) { self.kind = kind; self.duration = duration }
    /// Extra zoom `elapsed` seconds after the clip starts.
    public func scale(elapsed: Double) -> Double {
        guard duration > 0, elapsed >= 0, elapsed < duration else { return 1 }
        let remaining = 1 - elapsed / duration
        return 1 + remaining * remaining * 0.18
    }
    func validate() throws {
        guard duration.isFinite, duration > 0, duration <= 2 else { throw ProjectError.invalid("Transition duration must be between 0 and 2 seconds.") }
    }
}

/// A one-shot slow motion into `end`: across [start, end] (sequence seconds) the
/// source runs ahead, then decelerates to a standstill exactly at `end`, where it is
/// back in sync. Identity outside the window.
public struct SpeedRamp: Codable, Equatable, Sendable {
    public var start: Double
    public var end: Double
    /// 1 is no warp; higher bends harder.
    public var strength: Double
    public init(start: Double, end: Double, strength: Double) { self.start = start; self.end = end; self.strength = strength }
    public func warp(_ time: Double) -> Double {
        guard time > start, time < end else { return time }
        let span = end - start, progress = (time - start) / span
        return start + (1 - pow(1 - progress, max(1e-3, strength))) * span
    }
    func validate() throws {
        guard start.isFinite, end.isFinite, strength.isFinite, start >= -86400, end <= 86400, end > start, (0.001...20).contains(strength) else {
            throw ProjectError.invalid("Invalid speed ramp window or strength.")
        }
    }
}

/// A film look applied to the finished frame, on display-encoded (sRGB) values.
public struct SequenceLook: Codable, Equatable, Sendable {
    public var exposure = 1.0, contrast = 1.0, saturation = 1.0
    /// Warm (+) / cool (−) and magenta (+) / green (−), each −1...1.
    public var temperature = 0.0, tint = 0.0
    public var bloom = 0.0, aberration = 0.0, vignette = 0.0, grain = 0.0, streak = 0.0
    /// Kaleidoscope fold: 0 off, 1 horizontal, 2 vertical, 3 both.
    public var mirror = 0
    /// When set, bloom, aberration and exposure pulse with this beat envelope.
    public var pulse: BeatEnvelope?
    public init() {}

    /// Strength follows section energy: calm passages ease toward neutral (0.55×),
    /// the hottest push past full (1.25×).
    public func at(energy: Double) -> SequenceLook {
        let strength = 0.55 + 0.7 * min(1, max(0, energy))
        func mul(_ v: Double) -> Double { max(0, 1 + (v - 1) * strength) }
        func add(_ v: Double, _ upper: Double) -> Double { min(upper, max(0, v * strength)) }
        var l = self
        l.exposure = mul(exposure); l.contrast = mul(contrast); l.saturation = mul(saturation)
        l.temperature = min(1, max(-1, temperature * strength)); l.tint = min(1, max(-1, tint * strength))
        l.bloom = add(bloom, 3); l.aberration = add(aberration, 0.05); l.vignette = add(vignette, 1); l.grain = add(grain, 1)
        l.streak = max(0, streak * strength)
        return l
    }
    func validate() throws {
        let values = [exposure, contrast, saturation, temperature, tint, bloom, aberration, vignette, grain, streak]
        guard values.allSatisfy(\.isFinite), (0...10).contains(exposure), (0...10).contains(contrast), (0...10).contains(saturation),
              (-1...1).contains(temperature), (-1...1).contains(tint), (0...3).contains(bloom), (0...0.05).contains(aberration),
              (0...1).contains(vignette), (0...1).contains(grain), (0...10).contains(streak), (0...3).contains(mirror) else {
            throw ProjectError.invalid("Sequence look values are out of range.")
        }
        try pulse?.validate()
    }
}
