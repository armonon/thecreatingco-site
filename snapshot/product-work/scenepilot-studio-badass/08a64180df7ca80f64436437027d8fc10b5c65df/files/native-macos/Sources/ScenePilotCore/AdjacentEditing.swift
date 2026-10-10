import Foundation

extension Edit {
    /// Move the selected clip's out-point and the following clip's in-point together.
    /// Outer boundaries and every other track stay fixed. No implicit ripple/linking.
    public static func roll(_ project: Project, sequenceId: String, clipId: String, by frames: Int) throws -> Project {
        try transact(project, sequenceId: sequenceId) { sequence in
            let (indices, selected) = try adjacentLane(sequence, clipId)
            guard selected + 1 < indices.count else { throw ProjectError.invalid("Roll needs an adjacent clip after the selected clip.") }
            let left = indices[selected], right = indices[selected + 1]
            try requireTouching(sequence.videoClips[left], sequence.videoClips[right])
            let delta = Double(frames) / Double(sequence.frameRate)
            guard delta != 0 else { return }
            sequence.videoClips[left].duration += delta
            sequence.videoClips[right].start += delta
            sequence.videoClips[right].sourceStart += delta * sequence.videoClips[right].rate
            sequence.videoClips[right].duration -= delta
            sequence.videoClips[right].motion?.offset += delta
            sequence.videoClips[right].maskAnimation?.offset += delta
            resetTrimFades(&sequence.videoClips[left]); resetTrimFades(&sequence.videoClips[right])
            try requireSourceHandles(project, sequence.videoClips[left]); try requireSourceHandles(project, sequence.videoClips[right])
        }
    }

    /// Slide a clip without changing its source window or duration. Trim its two
    /// neighbors to fill the space; neither the sequence length nor other tracks move.
    public static func slide(_ project: Project, sequenceId: String, clipId: String, by frames: Int) throws -> Project {
        try transact(project, sequenceId: sequenceId) { sequence in
            let (indices, selected) = try adjacentLane(sequence, clipId)
            guard selected > 0 && selected + 1 < indices.count else { throw ProjectError.invalid("Slide needs adjacent clips on both sides.") }
            let left = indices[selected - 1], middle = indices[selected], right = indices[selected + 1]
            try requireTouching(sequence.videoClips[left], sequence.videoClips[middle])
            try requireTouching(sequence.videoClips[middle], sequence.videoClips[right])
            let delta = Double(frames) / Double(sequence.frameRate)
            guard delta != 0 else { return }
            sequence.videoClips[left].duration += delta
            sequence.videoClips[middle].start += delta
            sequence.videoClips[right].start += delta
            sequence.videoClips[right].sourceStart += delta * sequence.videoClips[right].rate
            sequence.videoClips[right].duration -= delta
            sequence.videoClips[right].motion?.offset += delta
            sequence.videoClips[right].maskAnimation?.offset += delta
            resetTrimFades(&sequence.videoClips[left]); resetTrimFades(&sequence.videoClips[right])
            try requireSourceHandles(project, sequence.videoClips[left]); try requireSourceHandles(project, sequence.videoClips[right])
        }
    }

    private static func adjacentLane(_ sequence: Sequence, _ id: String) throws -> ([Int], Int) {
        let clipIndex = try editableClip(sequence, id)
        let trackId = sequence.videoClips[clipIndex].trackId
        let indices = sequence.videoClips.indices.filter { sequence.videoClips[$0].trackId == trackId }.sorted {
            let a = sequence.videoClips[$0], b = sequence.videoClips[$1]
            return a.start == b.start ? a.id < b.id : a.start < b.start
        }
        for pair in zip(indices, indices.dropFirst()) {
            let a = sequence.videoClips[pair.0], b = sequence.videoClips[pair.1]
            guard a.start + a.duration <= b.start + 0.00001 else { throw ProjectError.invalid("Roll and slide require a non-overlapping track.") }
        }
        return (indices, indices.firstIndex(of: clipIndex)!)
    }

    private static func requireTouching(_ left: Clip, _ right: Clip) throws {
        guard abs(left.start + left.duration - right.start) < 0.00001 else { throw ProjectError.invalid("Roll and slide require touching clip edges, without a gap.") }
    }

    private static func resetTrimFades(_ clip: inout Clip) {
        clip.fadeWindow = nil
        clip.fadeIn = min(clip.fadeIn, max(0, clip.duration))
        clip.fadeOut = min(clip.fadeOut, max(0, clip.duration - clip.fadeIn))
    }

    private static func requireSourceHandles(_ project: Project, _ clip: Clip) throws {
        let duration = clip.assetId.flatMap { id in project.media.first { $0.id == id }?.duration }
            ?? clip.compositionId.flatMap { id in project.sequences.first { $0.id == id }?.duration }
        guard let duration, clip.sourceStart >= 0,
              clip.sourceStart + clip.duration * clip.rate <= duration + 0.00001 else {
            throw ProjectError.invalid("Not enough source handles for this edit.")
        }
    }
}
