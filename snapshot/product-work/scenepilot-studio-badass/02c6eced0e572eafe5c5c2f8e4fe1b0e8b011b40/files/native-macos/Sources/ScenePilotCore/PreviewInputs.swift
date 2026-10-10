import Foundation

/// Compare validated documents without rebuilding decoders for editor-only
/// metadata or unused library imports. This is not a file-content cache: explicit
/// relink/retry/open must still force a rebuild, even for the same media path.
public struct PreviewInputs: Equatable {
    private var sequenceId: String
    private var sequences: [Sequence]
    private var media: [Media]
    public init(_ project: Project, sequenceId: String) {
        self.sequenceId = sequenceId
        let byID = Dictionary(uniqueKeysWithValues: project.sequences.map { ($0.id,$0) })
        var visited: Set<String> = [], assets: Set<String> = []
        func visit(_ id: String) {
            guard visited.insert(id).inserted, let sequence = byID[id] else { return }
            for clip in sequence.videoClips {
                if let asset = clip.assetId { assets.insert(asset) }
                if let child = clip.compositionId { visit(child) }
            }
        }
        visit(sequenceId)
        sequences = project.sequences.filter { visited.contains($0.id) }.map { value in
            var sequence = value; sequence.name = ""
            sequence.tracks = value.tracks.map { value in var track = value; track.name = ""; track.locked = false; return track }
            return sequence
        }.sorted { $0.id < $1.id }
        media = project.media.filter { assets.contains($0.id) }.map { value in var asset = value; asset.name = ""; return asset }.sorted { $0.id < $1.id }
    }
}
