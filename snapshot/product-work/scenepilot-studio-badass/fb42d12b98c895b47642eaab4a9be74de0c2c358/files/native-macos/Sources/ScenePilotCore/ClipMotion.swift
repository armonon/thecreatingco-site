import Foundation

public enum MotionEasing: String, Codable, CaseIterable, Sendable {
    case linear, smooth, easeIn, easeOut, hold
    public func progress(_ t: Double) -> Double {
        switch self {
        case .linear: return t
        case .smooth: return t * t * (3 - 2 * t)
        case .easeIn: return t * t
        case .easeOut: return t * (2 - t)
        case .hold: return 0
        }
    }
}

/// Continuous picture channels. Fit/fill and flips remain clip-wide settings.
public struct MotionValue: Codable, Equatable, Sendable {
    public var x: Double, y: Double, scale: Double, rotation: Double, opacity: Double
    public init(x: Double = 0, y: Double = 0, scale: Double = 1, rotation: Double = 0, opacity: Double = 1) {
        self.x = x; self.y = y; self.scale = scale; self.rotation = rotation; self.opacity = opacity
    }
    public func validate() throws {
        var t = ClipTransform(); t.x = x; t.y = y; t.scale = scale; t.rotation = rotation
        try t.validate()
        guard opacity.isFinite, (0...1).contains(opacity) else { throw ProjectError.invalid("Keyframe opacity must be between 0 and 1.") }
    }
    public func applying(to base: ClipTransform) -> ClipTransform {
        var t = base; t.x = x; t.y = y; t.scale = scale; t.rotation = rotation; return t
    }
    fileprivate func interpolated(to b: Self, progress t: Double) -> Self {
        func mix(_ a: Double, _ b: Double) -> Double { a + (b - a) * t }
        return Self(x: mix(x,b.x), y: mix(y,b.y), scale: mix(scale,b.scale), rotation: mix(rotation,b.rotation), opacity: mix(opacity,b.opacity))
    }
}

public struct MotionKeyframe: Codable, Equatable, Sendable {
    public var time: Double
    public var value: MotionValue
    /// Easing belongs to the outgoing segment. Hold switches exactly at the next key.
    public var easing: MotionEasing
    public init(time: Double, value: MotionValue, easing: MotionEasing = .linear) {
        self.time = time; self.value = value; self.easing = easing
    }
}

public struct ClipMotion: Codable, Equatable, Sendable {
    public var keyframes: [MotionKeyframe]
    /// Original animation clock at the current clip head, in timeline seconds.
    /// Signed offsets allow extending a trimmed clip before its original first key.
    public var offset: Double
    public init(keyframes: [MotionKeyframe], offset: Double = 0) { self.keyframes = keyframes; self.offset = offset }
    public func validate() throws {
        guard offset.isFinite, abs(offset) <= 86400, !keyframes.isEmpty, keyframes.count <= 4096 else { throw ProjectError.invalid("Invalid motion clock or keyframe count (maximum 4096).") }
        var previous = -Double.infinity
        for key in keyframes {
            guard key.time.isFinite, abs(key.time) <= 86400, key.time - previous > 0.000001 else { throw ProjectError.invalid("Motion keys must have distinct, increasing finite times.") }
            try key.value.validate(); previous = key.time
        }
    }
    /// O(log n), deterministic, with endpoint holding. Never sorts on the render thread.
    public func value(atLocalTime local: Double) -> MotionValue? {
        guard let first = keyframes.first, let last = keyframes.last, local.isFinite else { return nil }
        let time = local + offset
        if time <= first.time { return first.value }
        if time >= last.time { return last.value }
        var low = 0, high = keyframes.count - 1
        while high - low > 1 {
            let mid = (low + high) / 2
            if keyframes[mid].time <= time { low = mid } else { high = mid }
        }
        let a = keyframes[low], b = keyframes[high]
        return a.value.interpolated(to: b.value, progress: a.easing.progress((time - a.time) / (b.time - a.time)))
    }
}

extension Clip {
    public func motionValue(atLocalTime time: Double) -> MotionValue {
        let t = transform ?? ClipTransform()
        return motion?.value(atLocalTime: time) ?? MotionValue(x: t.x, y: t.y, scale: t.scale, rotation: t.rotation, opacity: opacity)
    }
    public func motionKeyTime(at timelineTime: Double, frameRate: Int) -> Double {
        (timelineTime * Double(frameRate)).rounded() / Double(frameRate) - start + (motion?.offset ?? 0)
    }
}

extension Edit {
    /// Move one key on the sequence frame grid. Refuse collisions rather than
    /// silently replacing another pose; preserve all values and outgoing easing.
    public static func moveMotionKey(_ project: Project, sequenceId: String, clipId: String, keyTime: Double, to time: Double) throws -> Project {
        try transact(project, sequenceId: sequenceId) { sequence in
            let i = try editableClip(sequence, clipId), clip = sequence.videoClips[i]
            guard time.isFinite, keyTime.isFinite, var motion = clip.motion,
                  let keyIndex = motion.keyframes.firstIndex(where: { abs($0.time - keyTime) < 0.00001 }) else { throw ProjectError.invalid("Select an existing motion key.") }
            let target = clip.motionKeyTime(at: time, frameRate: sequence.frameRate)
            let local = target - motion.offset
            guard local >= -0.00001, local < clip.duration - 0.00001 else { throw ProjectError.invalid("Keep motion keys on frames inside this clip.") }
            guard !motion.keyframes.enumerated().contains(where: { $0.offset != keyIndex && abs($0.element.time - target) < 0.00001 }) else { throw ProjectError.invalid("Another motion key already occupies that frame. Both keys were preserved.") }
            motion.keyframes[keyIndex].time = target
            motion.keyframes.sort { $0.time < $1.time }
            sequence.videoClips[i].motion = motion
        }
    }
    /// One undoable update; edits on the same sequence frame replace, not duplicate, a key.
    public static func motionKey(_ project: Project, sequenceId: String, clipId: String, at time: Double, value: MotionValue? = nil, easing: MotionEasing? = nil, remove: Bool = false) throws -> Project {
        try transact(project, sequenceId: sequenceId) { sequence in
            let i = try editableClip(sequence, clipId)
            var clip = sequence.videoClips[i]
            guard time.isFinite, clip.compositionId != nil || project.media.contains(where: { $0.id == clip.assetId && $0.hasVideo }) else { throw ProjectError.invalid("Motion keys require a video clip or composition.") }
            let keyTime = clip.motionKeyTime(at: time, frameRate: sequence.frameRate)
            let local = keyTime - (clip.motion?.offset ?? 0)
            guard local >= -0.00001, local < clip.duration - 0.00001 else { throw ProjectError.invalid("Place the playhead on a frame inside the selected clip.") }
            var motion = clip.motion ?? ClipMotion(keyframes: [])
            let index = motion.keyframes.firstIndex { abs($0.time - keyTime) < 0.00001 }
            if remove {
                guard let index else { throw ProjectError.invalid("There is no keyframe at the playhead.") }
                let held = clip.motionValue(atLocalTime: local)
                motion.keyframes.remove(at: index)
                if motion.keyframes.isEmpty {
                    clip.transform = held.applying(to: clip.transform ?? ClipTransform()); clip.opacity = held.opacity
                }
            } else {
                let key = MotionKeyframe(time: keyTime, value: value ?? clip.motionValue(atLocalTime: local), easing: easing ?? index.map { motion.keyframes[$0].easing } ?? .linear)
                if let index { motion.keyframes[index] = key } else { motion.keyframes.append(key); motion.keyframes.sort { $0.time < $1.time } }
            }
            clip.motion = motion.keyframes.isEmpty ? nil : motion
            sequence.videoClips[i] = clip
        }
    }
    /// Disable animation without a picture jump: bake the currently evaluated pose.
    public static func clearMotion(_ project: Project, sequenceId: String, clipId: String, at time: Double) throws -> Project {
        guard time.isFinite else { throw ProjectError.invalid("Motion time must be finite.") }
        return try transact(project, sequenceId: sequenceId) { sequence in
            let i = try editableClip(sequence, clipId)
            let value = sequence.videoClips[i].motionValue(atLocalTime: time - sequence.videoClips[i].start)
            sequence.videoClips[i].transform = value.applying(to: sequence.videoClips[i].transform ?? ClipTransform())
            sequence.videoClips[i].opacity = value.opacity; sequence.videoClips[i].motion = nil
        }
    }
}
