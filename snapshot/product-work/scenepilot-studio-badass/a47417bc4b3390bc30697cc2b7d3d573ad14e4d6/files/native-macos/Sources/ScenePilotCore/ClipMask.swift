import Foundation

/// Normalized composition-space shape, applied before animated placement. Y is down.
public struct ClipMask: Codable, Equatable, Sendable {
    public enum Shape: String, Codable, CaseIterable, Sendable { case rectangle, ellipse, bezier }
    public var shape: Shape
    public var x: Double = 0.5
    public var y: Double = 0.5
    public var width: Double = 0.75
    public var height: Double = 0.75
    public var feather: Double = 0
    public var inverted = false
    public var points: [BezierVertex]?
    public init(shape: Shape) { self.shape = shape }
    public func validate() throws {
        if shape == .bezier {
            guard let points, (3...128).contains(points.count) else { throw ProjectError.invalid("A closed Bezier mask needs 3–128 vertices.") }
            for point in points { try point.validate() }
        } else if points != nil { throw ProjectError.invalid("Only Bezier masks may contain path vertices.") }
        guard [x,y,width,height,feather].allSatisfy(\.isFinite), (-8...8).contains(x), (-8...8).contains(y),
              (0.001...16).contains(width), (0.001...16).contains(height), (0...200).contains(feather) else {
            throw ProjectError.invalid("Invalid mask bounds or feather. Width and height must be positive; feather is 0–200 pixels.")
        }
    }
}

/// Sibling clip pixels supply coverage. Providers are matte-only visually; audio is unchanged.
public struct ClipMatte: Codable, Equatable, Sendable {
    public enum Mode: String, Codable, CaseIterable, Sendable { case alpha, luma }
    public var sourceClipId: String
    public var mode: Mode
    public var inverted: Bool
    public init(sourceClipId: String, mode: Mode = .alpha, inverted: Bool = false) {
        self.sourceClipId = sourceClipId; self.mode = mode; self.inverted = inverted
    }
}

extension Project {
    func validateMattes(in sequence: Sequence) throws {
        let clips = Dictionary(uniqueKeysWithValues: sequence.videoClips.map { ($0.id, $0) })
        let video = Set(media.filter(\.hasVideo).map(\.id))
        func visual(_ clip: Clip) -> Bool { clip.compositionId != nil || clip.assetId.map(video.contains) == true }
        var depths: [String: Int] = [:]
        func visit(_ clip: Clip, parents: Set<String>) throws -> Int {
            guard !parents.contains(clip.id), parents.count < 32 else { throw ProjectError.invalid("Matte dependency cycle or excessive nesting.") }
            if let depth = depths[clip.id] { return depth }
            var depth = 1
            if let matte = clip.matte {
                guard let source = clips[matte.sourceClipId], visual(clip), visual(source) else {
                    throw ProjectError.invalid("A matte must reference a video clip or composition in the same sequence. Remove its matte link before deleting a provider.")
                }
                depth += try visit(source, parents: parents.union([clip.id]))
            }
            guard depth <= 32 else { throw ProjectError.invalid("Matte dependency chain exceeds 32 clips.") }
            depths[clip.id] = depth; return depth
        }
        for clip in sequence.videoClips { _ = try visit(clip, parents: []) }
    }
}

extension Edit {
    public static func mask(_ project: Project, sequenceId: String, clipId: String, value: ClipMask?, at time: Double? = nil) throws -> Project {
        if value != nil, project.sequences.first(where: { $0.id == sequenceId })?.videoClips.first(where: { $0.id == clipId })?.maskAnimation != nil {
            guard let time else { throw ProjectError.invalid("Supply a playhead time when editing an animated mask.") }
            return try maskKey(project, sequenceId: sequenceId, clipId: clipId, at: time, value: value)
        }
        return try transact(project, sequenceId: sequenceId) { sequence in
            let index = try editableClip(sequence, clipId); sequence.videoClips[index].mask = value
            if value == nil { sequence.videoClips[index].maskAnimation = nil }
        }
    }
    public static func matte(_ project: Project, sequenceId: String, clipId: String, value: ClipMatte?) throws -> Project {
        try transact(project, sequenceId: sequenceId) { sequence in
            let index = try editableClip(sequence, clipId); sequence.videoClips[index].matte = value
        }
    }
}
