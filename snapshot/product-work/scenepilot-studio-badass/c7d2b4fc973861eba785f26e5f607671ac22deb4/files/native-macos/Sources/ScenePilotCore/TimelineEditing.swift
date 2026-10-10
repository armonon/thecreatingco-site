import Foundation

public enum TrimEdge { case head, tail }

extension Edit {
    /// Non-ripple trim: the opposite edge and source-to-timeline mapping stay fixed.
    public static func trim(_ project: Project, sequenceId: String, clipId: String, edge: TrimEdge, to time: Double) throws -> Project {
        try transact(project, sequenceId: sequenceId) { sequence in
            let index = try editableClip(sequence, clipId)
            var clip = sequence.videoClips[index]
            guard time.isFinite else { throw ProjectError.invalid("Trim time must be finite.") }
            let target = (time * Double(sequence.frameRate)).rounded() / Double(sequence.frameRate)
            if edge == .head {
                let delta = target - clip.start
                clip.start = target; clip.sourceStart += delta * clip.rate; clip.duration -= delta
                clip.motion?.offset += delta
                clip.maskAnimation?.offset += delta
            } else { clip.duration = target - clip.start }
            // Explicit trim adjusts edge-relative fades; split preserves their envelope.
            clip.fadeWindow = nil
            guard clip.duration > 0 else { throw ProjectError.invalid("Keep at least one frame in the clip.") }
            clip.fadeIn = min(clip.fadeIn, clip.duration)
            clip.fadeOut = min(clip.fadeOut, clip.duration - clip.fadeIn)
            sequence.videoClips[index] = clip
        }
    }
    public static func slip(_ project: Project, sequenceId: String, clipId: String, by frames: Int) throws -> Project {
        try transact(project, sequenceId: sequenceId) { sequence in
            let index = try editableClip(sequence, clipId)
            sequence.videoClips[index].sourceStart += Double(frames) / Double(sequence.frameRate) * sequence.videoClips[index].rate
        }
    }
    public static func duplicate(_ project: Project, sequenceId: String, clipId: String) throws -> Project {
        try transact(project, sequenceId: sequenceId) { sequence in
            let index = try editableClip(sequence, clipId)
            var copy = sequence.videoClips[index]
            copy.id = UUID().uuidString; copy.start += copy.duration
            guard !sequence.videoClips.contains(where: { $0.trackId == copy.trackId && $0.start < copy.start + copy.duration - 0.00001 && $0.start + $0.duration > copy.start + 0.00001 }) else {
                throw ProjectError.invalid("There is not enough empty space after this clip to duplicate it.")
            }
            sequence.videoClips.insert(copy, at: index + 1)
        }
    }
    /// Track-local ripple. Refuse overlaps rather than shifting unrelated layers.
    public static func rippleDelete(_ project: Project, sequenceId: String, clipId: String) throws -> Project {
        try transact(project, sequenceId: sequenceId) { sequence in
            let index = try editableClip(sequence, clipId), clip = sequence.videoClips[index]
            guard !sequence.videoClips.contains(where: { $0.id != clip.id && $0.trackId == clip.trackId && $0.start < clip.start + clip.duration - 0.00001 && $0.start + $0.duration > clip.start + 0.00001 }) else {
                throw ProjectError.invalid("Ripple delete requires a non-overlapping clip on this track.")
            }
            sequence.videoClips.remove(at: index)
            for i in sequence.videoClips.indices where sequence.videoClips[i].trackId == clip.trackId && sequence.videoClips[i].start >= clip.start + clip.duration - 0.00001 {
                sequence.videoClips[i].start -= clip.duration
            }
        }
    }
    static func editableClip(_ sequence: Sequence, _ id: String) throws -> Int {
        guard let i = sequence.videoClips.firstIndex(where: { $0.id == id }),
              sequence.tracks.contains(where: { $0.id == sequence.videoClips[i].trackId && !$0.locked }) else { throw ProjectError.invalid("Select an unlocked clip.") }
        return i
    }
}

public enum TimelineSnap {
    /// Deterministic nearest edge; includes either end of the moving clip.
    public static func start(_ proposed: Double, duration: Double, anchors: [Double], tolerance: Double, frameRate: Int) -> Double {
        guard proposed.isFinite, duration.isFinite, frameRate > 0 else { return 0 }
        let rounded = max(0, (proposed * Double(frameRate)).rounded() / Double(frameRate))
        let candidates = anchors.filter(\.isFinite).flatMap { [$0, $0 - duration] }.filter { $0 >= 0 && abs($0 - rounded) <= tolerance }
        let chosen = candidates.min { a, b in abs(a - rounded) == abs(b - rounded) ? a < b : abs(a - rounded) < abs(b - rounded) } ?? rounded
        return max(0, (chosen * Double(frameRate)).rounded() / Double(frameRate))
    }
}
