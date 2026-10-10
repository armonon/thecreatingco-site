import Foundation

/// Out is exclusive. Marks live in source seconds; edits quantize duration to the destination frame grid.
public struct SourceRange: Equatable {
    public var start: Double
    public var end: Double
    public init(start: Double = 0, end: Double) { self.start = start; self.end = end }
    public func validate(duration: Double, frameRate: Int) throws {
        guard start.isFinite, end.isFinite, duration.isFinite, frameRate > 0,
              start >= 0, end <= duration + 0.000001, end - start >= 1 / Double(frameRate) - 0.000001 else {
            throw ProjectError.invalid("Source Out must follow In by at least one sequence frame and stay inside the media.")
        }
    }
}

public enum SourceEditMode { case insert, overwrite }

extension Edit {
    /// Explicitly track-local: other tracks do not ripple. Never silently break a matte dependency.
    public static func placeSource(_ project: Project, sequenceId: String, assetId: String,
                                   trackId: String, range: SourceRange, at time: Double,
                                   mode: SourceEditMode, clipId: String = UUID().uuidString) throws -> Project {
        guard let media = project.media.first(where: { $0.id == assetId }) else { throw ProjectError.invalid("Source media is no longer in this project.") }
        return try transact(project, sequenceId: sequenceId) { sequence in
            guard sequence.tracks.contains(where: { $0.id == trackId && !$0.locked }), time.isFinite, time >= 0 else {
                throw ProjectError.invalid("Choose an unlocked destination track and a valid edit time.")
            }
            try range.validate(duration: media.duration, frameRate: sequence.frameRate)
            let fps = Double(sequence.frameRate)
            let start = (time * fps).rounded() / fps
            let duration = floor((range.end - range.start) * fps + 0.000001) / fps
            let end = start + duration
            let providers = Set(sequence.videoClips.compactMap { $0.matte?.sourceClipId })
            var result: [Clip] = []
            func portion(_ original: Clip, from: Double, to: Double, id: String) throws -> Clip {
                guard to - from >= 1 / fps - 0.000001 else { throw ProjectError.invalid("This edit would leave a sub-frame fragment. Align the existing clip edges first.") }
                var clip = original
                let offset = from - original.start
                clip.id = id; clip.start = from; clip.duration = to - from
                clip.sourceStart += offset * clip.rate
                clip.motion?.offset += offset; clip.maskAnimation?.offset += offset
                let fade = clip.fadeWindow ?? FadeWindow(offset: 0, duration: original.duration)
                clip.fadeWindow = FadeWindow(offset: fade.offset + offset, duration: fade.duration)
                return clip
            }
            for clip in sequence.videoClips {
                guard clip.trackId == trackId else { result.append(clip); continue }
                let tail = clip.start + clip.duration
                let affected = mode == .insert ? tail > start + 0.000001 : tail > start + 0.000001 && clip.start < end - 0.000001
                guard affected else { result.append(clip); continue }
                guard clip.matte == nil, !providers.contains(clip.id) else {
                    throw ProjectError.invalid("This edit affects a linked matte. Edit inside its composition or remove the matte link first.")
                }
                if mode == .insert {
                    if clip.start >= start - 0.000001 { var shifted = clip; shifted.start += duration; result.append(shifted) }
                    else {
                        result.append(try portion(clip, from: clip.start, to: start, id: clip.id))
                        var right = try portion(clip, from: start, to: tail, id: UUID().uuidString)
                        right.start += duration; result.append(right)
                    }
                } else {
                    if clip.start < start - 0.000001 { result.append(try portion(clip, from: clip.start, to: start, id: clip.id)) }
                    if tail > end + 0.000001 { result.append(try portion(clip, from: end, to: tail, id: clip.start < start ? UUID().uuidString : clip.id)) }
                }
            }
            var placed = Clip(assetId: assetId, trackId: trackId, start: start, duration: duration, id: clipId)
            placed.sourceStart = range.start
            result.append(placed); sequence.videoClips = result
        }
    }
}
