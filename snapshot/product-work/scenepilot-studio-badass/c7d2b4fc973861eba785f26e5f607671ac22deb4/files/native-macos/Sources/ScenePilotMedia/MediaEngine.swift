import AVFoundation
import ScenePilotCore

public struct BuiltSequence {
    public let composition: AVMutableComposition
    public let videoComposition: AVMutableVideoComposition?
    public let audioMix: AVMutableAudioMix
    public let duration: Double
    public func playerItem() -> AVPlayerItem {
        let item = AVPlayerItem(asset: composition)
        item.videoComposition = videoComposition; item.audioMix = audioMix; return item
    }
}

public enum NativeMedia {
    public static func inspect(_ url: URL) async throws -> Media {
        guard url.isFileURL, FileManager.default.isReadableFile(atPath: url.path) else { throw ProjectError.invalid("Media is unavailable: \(url.lastPathComponent)") }
        let asset = AVURLAsset(url: url)
        let duration = try await asset.load(.duration).seconds
        let videos = try await asset.loadTracks(withMediaType: .video)
        let audio = try await asset.loadTracks(withMediaType: .audio)
        guard duration.isFinite, duration > 0, !videos.isEmpty || !audio.isEmpty else { throw ProjectError.invalid("No supported audio or video stream in \(url.lastPathComponent).") }
        return Media(path: url.path, duration: duration, hasVideo: !videos.isEmpty, hasAudio: !audio.isEmpty)
    }

    private struct Leaf {
        let clip: Clip
        let media: Media?
        let children: [Int]
        let matteOnly: Bool
        let start: Double
        let duration: Double
        let sourceStart: Double
        let rate: Double
        let gain: Double
        let audioEnvelopes: [AudioFadeEnvelope]
        let originalStart: Double
        let originalDuration: Double
        let fadeIn: Double
        let fadeOut: Double
        let motionLocalStart: Double
        let motionRate: Double
        let followsBeat: Bool
        /// Sequence time inside the clip's own sequence at root time `time`.
        func local(_ time: Double) -> Double { clip.start + motionLocalStart + (time - start) * motionRate }
    }
    public static func build(_ project: Project, sequenceId: String) async throws -> BuiltSequence {
        _ = try project.validated()
        guard let sequence = project.sequences.first(where: { $0.id == sequenceId }), sequence.duration > 0 else { throw ProjectError.invalid("Add a clip to this sequence before playback or export.") }
        let media = Dictionary(uniqueKeysWithValues: project.media.map { ($0.id, $0) })
        let sequences = Dictionary(uniqueKeysWithValues: project.sequences.map { ($0.id, $0) })
        var leaves: [Leaf] = []
        var expandedCompositions = 0
        var mediaCount = 0
        // Beat punch belongs to the sequence being played: its own beat-following tracks.
        func expand(_ sequence: Sequence, from: Double, to: Double, destination: Double, parentRate: Double, gain: Double, envelopes: [AudioFadeEnvelope], root: Bool = false) throws -> [Int] {
            try Task.checkCancellation()
            expandedCompositions += 1
            guard expandedCompositions <= 10_000 else { throw ProjectError.invalid("Composition expansion exceeds this native preview's safety limit. Simplify repeated nesting.") }
            let providers = Set(sequence.videoClips.filter { clip in sequence.tracks.contains { $0.id == clip.trackId && $0.enabled } }.compactMap { $0.matte?.sourceClipId })
            var result: [Int] = []
            for track in sequence.tracks where track.enabled {
                for clip in sequence.videoClips.filter({ $0.trackId == track.id }).reversed() {
                    let begin = max(from, clip.start), end = min(to, clip.start + clip.duration)
                    guard end > begin else { continue }
                    let start = destination + (begin - from) / parentRate
                    let sourceStart = clip.sourceStart + (begin - clip.start) * clip.rate
                    let rate = clip.rate * parentRate
                    let envelope = AudioFadeEnvelope(start: destination + (clip.start - from - (clip.fadeWindow?.offset ?? 0)) / parentRate, duration: (clip.fadeWindow?.duration ?? clip.duration) / parentRate, fadeIn: clip.fadeIn / parentRate, fadeOut: clip.fadeOut / parentRate)
                    let audioEnvelopes = envelopes + [envelope]
                    let children = try clip.compositionId.map { nested in
                        try expand(sequences[nested]!, from: sourceStart, to: sourceStart + (end - begin) * clip.rate, destination: start, parentRate: rate, gain: gain * track.gain * clip.gain, envelopes: audioEnvelopes)
                    } ?? []
                    if clip.assetId != nil { mediaCount += 1 }
                    guard mediaCount <= 256, leaves.count < 10_000 else { throw ProjectError.invalid("This native migration build supports at most 256 expanded media clips and 10,000 composition nodes. Simplify repeated nesting.") }
                    result.append(leaves.count)
                    leaves.append(Leaf(clip: clip, media: clip.assetId.flatMap { media[$0] }, children: children, matteOnly: providers.contains(clip.id), start: start, duration: (end - begin) / parentRate, sourceStart: sourceStart, rate: rate, gain: gain * track.gain * clip.gain, audioEnvelopes: audioEnvelopes, originalStart: envelope.start, originalDuration: envelope.duration, fadeIn: envelope.fadeIn, fadeOut: envelope.fadeOut, motionLocalStart: begin - clip.start, motionRate: parentRate, followsBeat: root && track.followsBeat == true))
                }
            }
            return result
        }
        let roots = try expand(sequence, from: 0, to: sequence.duration, destination: 0, parentRate: 1, gain: 1, envelopes: [], root: true)
        var beat: LayerBeat?
        if let rhythm = sequence.rhythm, let punch = sequence.punch { beat = LayerBeat(rhythm: rhythm, punch: punch) }
        try Task.checkCancellation()
        let composition = AVMutableComposition()
        var layers: [Int: NativeLayer] = [:], audioParameters: [AVAudioMixInputParameters] = []
        var totalAudioRamps = 0
        var loaded: [String: AVURLAsset] = [:]
        func presentation(_ leaf: Leaf, trackID: CMPersistentTrackID = kCMPersistentTrackID_Invalid, transform: CGAffineTransform = .identity) -> NativeLayer {
            NativeLayer(trackID: trackID, range: CMTimeRange(start: CMTime(seconds: leaf.start, preferredTimescale: 600_000), duration: CMTime(seconds: leaf.duration, preferredTimescale: 600_000)), baseTransform: transform, placement: leaf.clip.transform ?? ClipTransform(), outputSize: CGSize(width: sequence.width, height: sequence.height), motion: leaf.clip.motion, motionLocalStart: leaf.motionLocalStart, motionRate: leaf.motionRate, opacity: leaf.clip.opacity, originalStart: leaf.originalStart, originalDuration: leaf.originalDuration, fadeIn: leaf.fadeIn, fadeOut: leaf.fadeOut, exposure: leaf.clip.exposure, saturation: leaf.clip.saturation, blur: leaf.clip.blur, mask: leaf.clip.mask, maskAnimation: leaf.clip.maskAnimation, beat: leaf.followsBeat ? beat : nil, transition: leaf.clip.transitionIn)
        }
        for (index, leaf) in leaves.enumerated() {
            try Task.checkCancellation()
            guard let media = leaf.media else { layers[index] = presentation(leaf); continue }
            guard FileManager.default.isReadableFile(atPath: media.path) else { throw ProjectError.invalid("Missing media: \(media.name). Relink it in Project Media.") }
            let asset: AVURLAsset
            if let cached = loaded[media.id] { asset = cached } else { asset = AVURLAsset(url: URL(fileURLWithPath: media.path)); loaded[media.id] = asset }
            let actualDuration = try await asset.load(.duration).seconds
            guard leaf.sourceStart + leaf.duration * leaf.rate <= actualDuration + 0.05 else { throw ProjectError.invalid("\(media.name) is shorter than the saved edit. Relink the correct source.") }
            let segments = timeSegments(leaf, frameRate: sequence.frameRate, sourceDuration: actualDuration)
            func insert(_ source: AVAssetTrack, into track: AVMutableCompositionTrack) throws {
                for segment in segments {
                    try track.insertTimeRange(segment.source, of: source, at: segment.destination.start)
                    track.scaleTimeRange(CMTimeRange(start: segment.destination.start, duration: segment.source.duration), toDuration: segment.destination.duration)
                }
            }
            if media.hasVideo {
                guard let source = try await asset.loadTracks(withMediaType: .video).first,
                      let track = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else { throw ProjectError.invalid("Cannot create native video track for \(media.name).") }
                try insert(source, into: track)
                let size = try await source.load(.naturalSize), preferred = try await source.load(.preferredTransform)
                let oriented = CGRect(origin: .zero, size: size).applying(preferred)
                let placement = leaf.clip.transform ?? ClipTransform()
                let sx = Double(sequence.width) / abs(oriented.width), sy = Double(sequence.height) / abs(oriented.height)
                let scale = placement.fill ? max(sx, sy) : min(sx, sy)
                let transform = preferred.concatenating(CGAffineTransform(translationX: -oriented.minX, y: -oriented.minY))
                    .concatenating(CGAffineTransform(scaleX: scale, y: scale))
                    .concatenating(CGAffineTransform(translationX: (Double(sequence.width) - abs(oriented.width) * scale) / 2, y: (Double(sequence.height) - abs(oriented.height) * scale) / 2))
                layers[index] = presentation(leaf, trackID: track.trackID, transform: transform)
            }
            if media.hasAudio {
                guard let source = try await asset.loadTracks(withMediaType: .audio).first,
                      let track = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else { throw ProjectError.invalid("Cannot create native audio track for \(media.name).") }
                try insert(source, into: track)
                let params = AVMutableAudioMixInputParameters(track: track)
                let ramps = try AudioEnvelope.ramps(leaf.audioEnvelopes, gain: leaf.gain, from: leaf.start, to: leaf.start + leaf.duration)
                totalAudioRamps += ramps.count
                guard totalAudioRamps <= 250_000 else { throw ProjectError.invalid("Native audio automation exceeds 250,000 ramps. Simplify nested fades or gain.") }
                // A newly inserted track may decode a preroll block before its first
                // ramp timestamp. Seed its initial gain instead of AVAudioMix's 1.0
                // default; otherwise a split can emit a short full-volume burst.
                params.setVolume(Float(ramps.first?.from ?? 0), at:.zero)
                for ramp in ramps {
                    let a = CMTime(seconds: ramp.start, preferredTimescale: 1_000_000_000), b = CMTime(seconds: ramp.end, preferredTimescale: 1_000_000_000)
                    guard b > a else { throw ProjectError.invalid("Audio fade is finer than the native timebase supports.") }
                    params.setVolumeRamp(fromStartVolume: Float(ramp.from), toEndVolume: Float(ramp.to), timeRange: CMTimeRange(start: a, end: b))
                }
                audioParameters.append(params)
            }
        }
        guard !composition.tracks.isEmpty else { throw ProjectError.invalid("All tracks are disabled or empty.") }
        let end = CMTime(seconds: sequence.duration, preferredTimescale: 600_000)
        if CMTimeCompare(composition.duration, end) < 0 {
            composition.insertEmptyTimeRange(CMTimeRange(start: composition.duration, duration: end - composition.duration))
        }
        let audioMix = AVMutableAudioMix(); audioMix.inputParameters = audioParameters
        var video: AVMutableVideoComposition?
        if layers.values.contains(where: { $0.trackID != kCMPersistentTrackID_Invalid }) {
            let result = AVMutableVideoComposition()
            result.customVideoCompositorClass = NativeCompositor.self
            result.renderSize = CGSize(width: sequence.width, height: sequence.height)
            result.frameDuration = CMTime(value: 1, timescale: CMTimeScale(sequence.frameRate))
            func node(_ index: Int) -> NativeNode? {
                guard let layer = layers[index] else { return nil }
                let leaf = leaves[index]
                return NativeNode(id: leaf.clip.id, layer: layer, children: leaf.children.compactMap(node), matte: leaf.clip.matte, matteOnly: leaf.matteOnly)
            }
            result.instructions = NativeInstruction.timeline(duration: CMTime(seconds: sequence.duration, preferredTimescale: 600_000), nodes: roots.compactMap(node), blendSpace: project.blendSpace ?? .linear,
                                                             look: sequence.look.map { NativeLook(look: $0, rhythm: sequence.rhythm) })
            result.colorPrimaries = AVVideoColorPrimaries_ITU_R_709_2
            result.colorTransferFunction = AVVideoTransferFunction_ITU_R_709_2
            result.colorYCbCrMatrix = AVVideoYCbCrMatrix_ITU_R_709_2
            video = result
        }
        return BuiltSequence(composition: composition, videoComposition: video, audioMix: audioMix, duration: sequence.duration)
    }
}

extension NativeMedia {
    /// Destination → source pieces for one clip. A plain clip is one linear piece. A
    /// speed ramp is sampled on the sequence frame grid: each frame starts a piece at
    /// exactly the source time Pro shows for that frame, so both engines pick the same
    /// source frame. Source times clamp inside the media as Pro's do.
    private static func timeSegments(_ leaf: Leaf, frameRate: Int, sourceDuration: Double) -> [(destination: CMTimeRange, source: CMTimeRange)] {
        // CMTime(seconds:) truncates, so 2.4 − 8 × 0.25 = 0.3999…9 lands a tick before
        // source frame 12. Snap values within float noise of a tick, as Pro's demuxer
        // (mediabunny roundIfAlmostInteger) does, so both engines pick the same frame.
        func time(_ seconds: Double) -> CMTime {
            let ticks = seconds * 600_000, nearest = ticks.rounded()
            return CMTime(value: Int64(nearest != 0 && abs(ticks / nearest - 1) < 10 * .ulpOfOne ? nearest : ticks.rounded(.down)), timescale: 600_000)
        }
        let end = leaf.start + leaf.duration
        guard let ramp = leaf.clip.speedRamp else {
            return [(CMTimeRange(start: time(leaf.start), end: time(end)), CMTimeRange(start: time(leaf.sourceStart), duration: time(leaf.duration * leaf.rate)))]
        }
        let clip = leaf.clip
        func source(_ root: Double) -> Double { min(sourceDuration - 0.001, max(0, clip.sourceStart + (ramp.warp(leaf.local(root)) - clip.start) * clip.rate)) }
        // Root times of the ramp window; frames inside it get their own piece.
        let windowStart = leaf.start + (ramp.start - leaf.local(leaf.start)) / leaf.motionRate
        let windowEnd = leaf.start + (ramp.end - leaf.local(leaf.start)) / leaf.motionRate
        var cuts: Set<Double> = [leaf.start, end]
        for edge in [windowStart, windowEnd] where edge > leaf.start && edge < end { cuts.insert(edge) }
        let fps = Double(frameRate)
        var frame = (max(leaf.start, windowStart) * fps).rounded(.up)
        while frame / fps < min(end, windowEnd) {
            if frame / fps > leaf.start { cuts.insert(frame / fps) }
            frame += 1
        }
        let times = cuts.sorted()
        return zip(times, times.dropFirst()).compactMap { a, b in
            let destination = CMTimeRange(start: time(a), end: time(b))
            guard destination.duration > .zero else { return nil }
            let from = source(a), span = max(1.0 / 600_000, source(b) - from)
            return (destination, CMTimeRange(start: time(from), duration: time(span)))
        }
    }
}

@MainActor public final class NativeExporter {
    private var session: AVAssetExportSession?
    private var sessionID: UUID?
    public private(set) var busy = false
    public var progress: Float { session?.progress ?? 0 }
    public init() {}
    public func cancel() { session?.cancelExport() }
    public func export(_ sequence: BuiltSequence, to url: URL) async throws {
        guard !busy else { throw ProjectError.invalid("An export is already running.") }
        try Task.checkCancellation()
        guard url.isFileURL else { throw ProjectError.invalid("Export to a local file.") }
        let target = url.resolvingSymlinksInPath().standardizedFileURL
        guard !sequence.composition.tracks.flatMap(\.segments).contains(where: { $0.sourceURL?.resolvingSymlinksInPath().standardizedFileURL == target }) else { throw ProjectError.invalid("Choose a different export filename. Source media must not be overwritten.") }
        guard sequence.videoComposition != nil else { throw ProjectError.invalid("MP4 export needs an enabled video clip. Audio-only delivery is not ported yet.") }
        guard let export = AVAssetExportSession(asset: sequence.composition, presetName: AVAssetExportPresetHighestQuality) else { throw ProjectError.invalid("Native MP4 encoder is unavailable.") }
        let id = UUID(); busy = true; session = export; sessionID = id
        let partial = url.deletingLastPathComponent().appendingPathComponent(".\(UUID().uuidString).partial.mp4")
        defer { busy = false; session = nil; sessionID = nil; try? FileManager.default.removeItem(at: partial) }
        export.outputURL = partial; export.outputFileType = .mp4
        export.videoComposition = sequence.videoComposition; export.audioMix = sequence.audioMix
        export.shouldOptimizeForNetworkUse = true
        await withTaskCancellationHandler(operation: { await export.export() }, onCancel: { Task { @MainActor [weak self] in if self?.sessionID == id { self?.cancel() } } })
        guard export.status == .completed else { if export.status == .cancelled { throw CancellationError() }; throw export.error ?? ProjectError.invalid("Native export failed.") }
        try Task.checkCancellation()
        // POSIX rename is atomic on this same filesystem; never unlink an old master.
        let result = partial.withUnsafeFileSystemRepresentation { from in url.withUnsafeFileSystemRepresentation { to in Darwin.rename(from!, to!) } }
        guard result == 0 else { throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
    }
}
