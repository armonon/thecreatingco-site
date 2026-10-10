import Foundation

public enum Edit {
    /// Every mutation is validated before becoming the authoritative document.
    public static func transact(_ project: Project, sequenceId: String, _ body: (inout Sequence) throws -> Void) throws -> Project {
        var next = project
        guard let index = next.sequences.firstIndex(where: { $0.id == sequenceId }) else { throw ProjectError.invalid("No active sequence.") }
        try body(&next.sequences[index]); return try next.validated()
    }
    public static func split(_ project: Project, sequenceId: String, clipId: String, at time: Double) throws -> Project {
        try transact(project, sequenceId: sequenceId) { sequence in
            guard let i = sequence.videoClips.firstIndex(where: { $0.id == clipId }), let track = sequence.tracks.first(where: { $0.id == sequence.videoClips[i].trackId }), !track.locked else { throw ProjectError.invalid("Select an unlocked clip.") }
            var left = sequence.videoClips[i], right = left
            guard !sequence.videoClips.contains(where: { $0.matte?.sourceClipId == clipId }) else { throw ProjectError.invalid("This clip supplies a matte. Remove its matte links before splitting, or split the media inside its composition.") }
            let local = (time * Double(sequence.frameRate)).rounded() / Double(sequence.frameRate) - left.start
            guard local >= 1 / Double(sequence.frameRate), left.duration - local >= 1 / Double(sequence.frameRate) else { throw ProjectError.invalid("Place the playhead inside the selected clip.") }
            right.id = UUID().uuidString; right.start = left.start + local
            right.sourceStart += local * left.rate; right.duration -= local
            right.motion?.offset += local
            right.maskAnimation?.offset += local
            let window = left.fadeWindow ?? FadeWindow(offset: 0, duration: left.duration)
            left.fadeWindow = window
            right.fadeWindow = FadeWindow(offset: window.offset + local, duration: window.duration)
            left.duration = local
            sequence.videoClips.replaceSubrange(i...i, with: [left, right])
        }
    }
    public static func moveTrack(_ project: Project, sequenceId: String, trackId: String, by delta: Int) throws -> Project {
        try transact(project, sequenceId: sequenceId) { sequence in
            guard let index = sequence.tracks.firstIndex(where: { $0.id == trackId }) else { throw ProjectError.invalid("Select a track.") }
            let destination = index + min(sequence.tracks.count - 1 - index, max(-index, delta))
            guard !sequence.tracks[min(index, destination)...max(index, destination)].contains(where: { $0.locked }) else {
                throw ProjectError.invalid("Unlock affected tracks before reordering them.")
            }
            let track = sequence.tracks.remove(at: index); sequence.tracks.insert(track, at: destination)
        }
    }
    public static func removeTrack(_ project: Project, sequenceId: String, trackId: String) throws -> Project {
        try transact(project, sequenceId: sequenceId) { sequence in
            guard sequence.tracks.count > 1, let track = sequence.tracks.first(where: { $0.id == trackId }), !track.locked else { throw ProjectError.invalid("Keep at least one track; unlock before removal.") }
            guard !sequence.videoClips.contains(where: { $0.trackId == trackId }) else { throw ProjectError.invalid("Move or remove clips before deleting this track.") }
            sequence.tracks.removeAll { $0.id == trackId }
        }
    }
}

public struct DocumentHistory {
    public private(set) var project: Project
    public private(set) var saved: Project
    private var past: [Project] = [], future: [Project] = []
    public var dirty: Bool { project != saved }
    public var canUndo: Bool { !past.isEmpty }
    public var canRedo: Bool { !future.isEmpty }
    public init(_ project: Project) { self.project = project; saved = project }
    public mutating func apply(_ next: Project) throws {
        _ = try next.validated(); guard next != project else { return }
        past.append(project); if past.count > 100 { past.removeFirst() }
        future.removeAll(); project = next
    }
    public mutating func undo() { guard let previous = past.popLast() else { return }; future.append(project); project = previous }
    public mutating func redo() { guard let next = future.popLast() else { return }; past.append(project); project = next }
    public mutating func markSaved(_ snapshot: Project) { saved = snapshot }
}

public enum ProjectStore {
    public static func save(_ project: Project, to url: URL) throws {
        guard url.isFileURL else { throw ProjectError.invalid("Save to a local file.") }
        // A migration preview must never replace legacy projects or source assets.
        if FileManager.default.fileExists(atPath: url.path) {
            do { _ = try load(url) }
            catch { throw ProjectError.invalid("This is not a valid native project. Choose a new filename; the existing file was preserved.") }
        }
        // Foundation's atomic write uses an adjacent temporary file and rename.
        try ProjectCollection.encode(project, relativeTo: url.deletingLastPathComponent()).write(to: url, options: .atomic)
    }
    public static func load(_ url: URL) throws -> Project {
        let info = try url.resourceValues(forKeys: [.fileSizeKey])
        guard (info.fileSize ?? Int.max) <= 64 * 1024 * 1024 else { throw ProjectError.invalid("Project exceeds the document size limit.") }
        return try Project.decode(ProjectCollection.resolve(Data(contentsOf: url), relativeTo: url.deletingLastPathComponent()))
    }
}
