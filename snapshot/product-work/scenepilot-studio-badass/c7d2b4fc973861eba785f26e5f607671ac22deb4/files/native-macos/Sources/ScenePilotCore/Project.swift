import Foundation
import CoreFoundation

public enum ProjectError: LocalizedError {
    case invalid(String)
    public var errorDescription: String? { if case .invalid(let reason) = self { return reason }; return nil }
}

public struct Media: Codable, Equatable, Identifiable {
    public var id: String
    public var path: String
    public var name: String
    public var duration: Double
    public var hasVideo: Bool
    public var hasAudio: Bool
    public init(path: String, duration: Double, hasVideo: Bool, hasAudio: Bool, id: String = UUID().uuidString) {
        self.id = id; self.path = path; self.name = URL(fileURLWithPath: path).lastPathComponent
        self.duration = duration; self.hasVideo = hasVideo; self.hasAudio = hasAudio
    }
}

public struct Track: Codable, Equatable, Identifiable {
    public var id: String
    public var name: String
    public var enabled = true
    public var locked = false
    public var gain = 1.0
    /// Clips on this track zoom with the sequence's beat punch.
    public var followsBeat: Bool?
    public init(name: String, id: String = UUID().uuidString) { self.name = name; self.id = id }
}

public struct Clip: Codable, Equatable, Identifiable {
    public var id: String
    public var assetId: String?
    public var compositionId: String?
    public var trackId: String
    public var start: Double
    public var sourceStart = 0.0
    public var duration: Double
    public var rate = 1.0
    public var opacity = 1.0
    public var gain = 1.0
    public var fadeIn = 0.0
    public var fadeOut = 0.0
    public var exposure = 0.0
    public var saturation = 1.0
    public var blur = 0.0
    public var transform: ClipTransform?
    public var fadeWindow: FadeWindow?
    public var motion: ClipMotion?
    public var mask: ClipMask?
    public var maskAnimation: MaskAnimation?
    public var matte: ClipMatte?
    /// Plays into the clip at its first frame.
    public var transitionIn: CutTransition?
    /// Warps which source frame is shown, on the sequence clock (media clips only).
    public var speedRamp: SpeedRamp?
    public init(assetId: String? = nil, compositionId: String? = nil, trackId: String, start: Double, duration: Double, id: String = UUID().uuidString) {
        self.id = id; self.assetId = assetId; self.compositionId = compositionId
        self.trackId = trackId; self.start = start; self.duration = duration
    }
}

public struct Sequence: Codable, Equatable, Identifiable {
    public var id: String
    public var name: String
    public var width: Int
    public var height: Int
    public var frameRate: Int
    /// Topmost track is first. A single canonical array owns all clips.
    public var tracks: [Track]
    public var videoClips: [Clip] = []
    /// Music timing that drives `punch` and the look's beat pulse.
    public var rhythm: SequenceRhythm?
    public var punch: BeatPunch?
    /// Applied to this sequence's finished frame when it is the one being played.
    public var look: SequenceLook?
    public var duration: Double { videoClips.map { $0.start + $0.duration }.max() ?? 0 }
    public init(name: String, width: Int = 1920, height: Int = 1080, frameRate: Int = 30, id: String = UUID().uuidString) {
        self.id = id; self.name = name; self.width = width; self.height = height; self.frameRate = frameRate
        self.tracks = [Track(name: "Track 2"), Track(name: "Track 1")]
    }
}

/// Where partial transparency is blended. Native work defaults to physically correct
/// linear light; `gamma` blends encoded sRGB values the way a browser canvas does, so
/// scenes translated from Pro render the same (compare After Effects' "Blend Colors
/// Using 1.0 Gamma" project setting, which toggles the same choice).
public enum BlendSpace: String, Codable, Equatable, Sendable { case linear, gamma }

public struct Project: Codable, Equatable {
    public var format = "scenepilot-native"
    public var version = 7
    public var id = UUID().uuidString
    public var name: String
    public var mainSequenceId: String
    public var media: [Media] = []
    public var sequences: [Sequence]
    public var legacyArchive: LegacyArchive?
    /// Which translator produced this scene from `legacyArchive`, so a newer one can re-translate exactly.
    public var translation: SceneTranslationStamp?
    /// Absent means linear. Applies to every sequence rendered from this project.
    public var blendSpace: BlendSpace?
    public init(name: String = "Untitled") {
        self.name = name
        let main = Sequence(name: "Main Sequence")
        self.mainSequenceId = main.id; self.sequences = [main]
    }
    public func validated() throws -> Project {
        func require(_ value: Bool, _ reason: String) throws { if !value { throw ProjectError.invalid(reason) } }
        try require(format == "scenepilot-native" && version == 7, "This document is not a supported native project. Review existing Pro projects using File > Review Existing Pro Project.")
        try require(!name.isEmpty && !id.isEmpty, "The project needs an identity and name.")
        if let stamp = translation {
            try require(!stamp.translator.isEmpty && stamp.translator.count <= 64 && (1...10_000).contains(stamp.version), "Invalid scene translation record.")
            try require(legacyArchive != nil, "A translated scene must retain its original source document.")
        }
        try require(!sequences.isEmpty && sequences.count <= 256 && media.count <= 100_000, "Invalid project size.")
        try require(Set(sequences.map(\.id)).count == sequences.count && Set(media.map(\.id)).count == media.count, "Duplicate project identifiers.")
        try require(sequences.contains { $0.id == mainSequenceId }, "Main sequence is missing.")
        let byMedia = Dictionary(uniqueKeysWithValues: media.map { ($0.id, $0) })
        let bySequence = Dictionary(uniqueKeysWithValues: sequences.map { ($0.id, $0) })
        for asset in media {
            try require(!asset.id.isEmpty && asset.path.hasPrefix("/") && !asset.path.contains("\0"), "Media must have a valid absolute local path.")
            try require(asset.duration.isFinite && asset.duration > 0 && (asset.hasVideo || asset.hasAudio), "Invalid media duration or stream type.")
        }
        for sequence in sequences {
            try require(!sequence.id.isEmpty && !sequence.name.isEmpty, "A sequence needs an identity and name.")
            try require(sequence.width >= 16 && sequence.height >= 16 && sequence.width <= 7680 && sequence.height <= 7680 && sequence.width % 2 == 0 && sequence.height % 2 == 0, "Invalid even output dimensions.")
            try require([24,25,30,50,60].contains(sequence.frameRate), "Unsupported frame rate.")
            try require(!sequence.tracks.isEmpty && sequence.tracks.count <= 128 && sequence.videoClips.count <= 100_000, "Invalid track or clip count.")
            try require(Set(sequence.tracks.map(\.id)).count == sequence.tracks.count && Set(sequence.videoClips.map(\.id)).count == sequence.videoClips.count, "Duplicate track or clip identifiers.")
            try sequence.rhythm?.validate(); try sequence.punch?.validate(); try sequence.look?.validate()
            for track in sequence.tracks { try require(!track.id.isEmpty && !track.name.isEmpty && track.gain.isFinite && (0...4).contains(track.gain), "Invalid track identity or volume.") }
            for clip in sequence.videoClips {
                try require(!clip.id.isEmpty, "A clip needs an identity.")
                try clip.transform?.validate()
                try clip.motion?.validate()
                try clip.mask?.validate()
                try clip.maskAnimation?.validate()
                try clip.transitionIn?.validate()
                try clip.speedRamp?.validate()
                try require(clip.speedRamp == nil || clip.assetId != nil, "Speed ramps apply to media clips.")
                try require(clip.maskAnimation == nil || clip.mask != nil, "Animated masks need a base mask.")
                try require(sequence.tracks.contains { $0.id == clip.trackId }, "Clip references a missing track.")
                try require([clip.start,clip.sourceStart,clip.duration,clip.rate,clip.opacity,clip.gain,clip.fadeIn,clip.fadeOut,clip.exposure,clip.saturation,clip.blur].allSatisfy(\.isFinite), "Clip values must be finite.")
                try require(clip.start >= 0 && clip.sourceStart >= 0 && clip.duration >= 1 / Double(sequence.frameRate) - 0.00001 && clip.start + clip.duration <= 86400 && (0.1...8).contains(clip.rate), "Invalid clip timing.")
                try require((0...1).contains(clip.opacity) && (0...4).contains(clip.gain) && (-4...4).contains(clip.exposure) && (0...3).contains(clip.saturation) && (0...100).contains(clip.blur), "Invalid effect values.")
                let fadeDuration = clip.fadeWindow?.duration ?? clip.duration
                if let window = clip.fadeWindow {
                    try require(window.offset.isFinite && window.duration.isFinite && window.offset >= 0 && window.duration > 0 && window.offset + clip.duration <= window.duration + 0.00001, "Invalid preserved fade envelope.")
                }
                try require(clip.fadeIn >= 0 && clip.fadeOut >= 0 && clip.fadeIn + clip.fadeOut <= fadeDuration + 0.00001, "Fades must fit inside the clip envelope.")
                try require((clip.assetId == nil) != (clip.compositionId == nil), "A clip must reference exactly one media item or composition.")
                let sourceDuration: Double
                if let assetId = clip.assetId {
                    guard let asset = byMedia[assetId] else { throw ProjectError.invalid("Clip media is missing from the project.") }
                    sourceDuration = asset.duration
                    try require(clip.motion == nil || asset.hasVideo, "Motion animation requires video media.")
                    try require((clip.mask == nil && clip.matte == nil) || asset.hasVideo, "Masks and mattes require video or a composition.")
                } else {
                    guard let nested = bySequence[clip.compositionId!] else { throw ProjectError.invalid("Nested composition is missing.") }
                    try require(nested.id != sequence.id, "A composition cannot contain itself.")
                    try require(nested.width == sequence.width && nested.height == sequence.height, "Nested compositions currently require matching dimensions.")
                    sourceDuration = nested.duration
                }
                try require(clip.sourceStart + clip.duration * clip.rate <= sourceDuration + 0.05, "Clip extends beyond its source. Trim or relink the source.")
            }
            try validateMattes(in: sequence)
        }
        var depths: [String: Int] = [:]
        func visit(_ id: String, _ parents: Set<String>) throws -> Int {
            try require(!parents.contains(id) && parents.count < 32, "Composition dependency cycle or excessive nesting.")
            if let depth = depths[id] { return depth }
            var next = parents; next.insert(id)
            var depth = 1
            // Reused comps form a DAG: validate each dependency once, not every path.
            for child in Set(bySequence[id]!.videoClips.compactMap(\.compositionId)) { depth = max(depth, 1 + (try visit(child, next))) }
            try require(depth <= 32, "Composition dependency cycle or excessive nesting.")
            depths[id] = depth; return depth
        }
        for sequence in sequences { _ = try visit(sequence.id, []) }
        return self
    }
    public func encoded() throws -> Data {
        _ = try validated()
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(self)
        guard data.count <= 64 * 1024 * 1024 else { throw ProjectError.invalid("Encoded project exceeds the 64 MB safety limit. Your existing file was preserved.") }
        return data
    }
    public static func decode(_ data: Data) throws -> Project {
        guard data.count <= 64 * 1024 * 1024 else { throw ProjectError.invalid("Project document exceeds the 64 MB safety limit.") }
        let header = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard header?["format"] as? String == "scenepilot-native", let version = header?["version"] as? NSNumber, CFGetTypeID(version) != CFBooleanGetTypeID(), [1,2,3,4,5,6,7].contains(version.doubleValue) else {
            throw ProjectError.invalid("This is not a supported native project. Use File > Review Existing Pro Project for a migration report. Your file has not been changed.")
        }
        var project = try JSONDecoder().decode(Project.self, from: data)
        // Older documents lack optional path animation and translation records;
        // upgrade in memory and never silently downgrade a newer document.
        project.version = 7
        return try project.validated()
    }
}
