import Foundation

extension Edit {
    /// Reusable transparent composition. Original media/audio remain untouched; outer animation stays on the instance.
    public static func isolate(_ project: Project, sequenceId: String, clipId: String, matte: Media) throws -> Project {
        var next = project
        guard let s = next.sequences.firstIndex(where: { $0.id == sequenceId }) else { throw ProjectError.invalid("Missing sequence.") }
        let i = try editableClip(next.sequences[s], clipId)
        let original = next.sequences[s].videoClips[i]
        guard let asset = next.media.first(where: { $0.id == original.assetId }), asset.hasVideo, matte.hasVideo, !matte.hasAudio,
              matte.duration + 0.00001 >= original.duration * original.rate else { throw ProjectError.invalid("Isolation needs a video clip and a complete silent alpha sidecar.") }
        let parent = next.sequences[s]
        var comp = Sequence(name: "Isolated · " + asset.name, width: parent.width, height: parent.height, frameRate: parent.frameRate)
        comp.tracks = [Track(name: "Alpha · generated"), Track(name: "Original picture + audio")]
        let span = original.duration * original.rate
        var picture = Clip(assetId: asset.id, trackId: comp.tracks[1].id, start: 0, duration: span)
        picture.sourceStart = original.sourceStart
        var fit = ClipTransform(); fit.fill = original.transform?.fill ?? false
        picture.transform = fit
        var alpha = Clip(assetId: matte.id, trackId: comp.tracks[0].id, start: 0, duration: span)
        alpha.transform = fit; alpha.gain = 0
        picture.matte = ClipMatte(sourceClipId: alpha.id, mode: .alpha)
        comp.videoClips = [alpha, picture]
        var instance = original; instance.assetId = nil; instance.compositionId = comp.id; instance.sourceStart = 0
        instance.transform?.fill = false
        next.media.append(matte); next.sequences.append(comp); next.sequences[s].videoClips[i] = instance
        return try next.validated()
    }
}
