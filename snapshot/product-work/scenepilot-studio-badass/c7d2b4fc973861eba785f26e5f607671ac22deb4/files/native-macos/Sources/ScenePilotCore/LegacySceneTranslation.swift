import Foundation
import CoreFoundation

/// Records which translator produced a native scene from its archived source, so a
/// newer translator can deterministically re-translate once native gains features.
public struct SceneTranslationStamp: Codable, Equatable, Sendable {
    public var translator: String
    public var version: Int
    public init(translator: String, version: Int) { self.translator = translator; self.version = version }
}

public struct SceneTranslationFinding: Codable, Equatable, Sendable {
    /// Where it applies: "Project", "Clip <id>", "Track <name>".
    public let scope: String
    /// Stable key for aggregating across projects, e.g. "effects.lookPreset".
    public let feature: String
    public let detail: String
    public init(scope: String, feature: String, detail: String) { self.scope = scope; self.feature = feature; self.detail = detail }
}

public struct SceneTranslationResult {
    public let name: String
    /// Present only when every rendered feature translated exactly. Never partial.
    public let project: Project?
    public let translated: [SceneTranslationFinding]
    public let blockers: [SceneTranslationFinding]
    public var isExact: Bool { project != nil }
    /// Feature → occurrences. Ranks which native capabilities unblock the most projects.
    public var blockerCounts: [String: Int] { Dictionary(blockers.map { ($0.feature, 1) }, uniquingKeysWith: +) }
    public var report: String {
        var lines = ["\(isExact ? "EXACT TRANSLATION" : "TRANSLATION BLOCKED") — \(name)",
                     "Translator \(LegacySceneTranslation.translator) v\(LegacySceneTranslation.version). Nothing is approximated, flattened or dropped.", ""]
        if isExact {
            lines.append("Every rendered feature has a native equivalent that produces the same picture and sound.")
        } else {
            lines.append("BLOCKERS (\(blockers.count)) — resolve these in the existing Pro app, then translate again:")
            lines += blockers.map { "• \($0.scope): \($0.detail) [\($0.feature)]" }
        }
        if !translated.isEmpty { lines += ["", "TRANSLATES EXACTLY"] + translated.map { "• \($0.scope): \($0.detail)" } }
        lines += ["", "The source document is never modified. An exact byte-for-byte copy is archived inside the native project."]
        return lines.joined(separator: "\n")
    }
}

/// Strict JSON readers: booleans are never numbers and numbers are never booleans.
enum LegacyJSON {
    static func number(_ value: Any?) -> Double? {
        guard let n = value as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), n.doubleValue.isFinite else { return nil }
        return n.doubleValue
    }
    static func bool(_ value: Any?) -> Bool? {
        guard let n = value as? NSNumber, CFGetTypeID(n) == CFBooleanGetTypeID() else { return nil }
        return n.boolValue
    }
    static func required(_ item: [String: Any], _ key: String, _ fallback: Double? = nil, _ context: String = "cut") throws -> Double {
        guard let value = item[key], !(value is NSNull) else {
            if let fallback { return fallback }
            throw ProjectError.invalid("Missing \(key) in \(context).")
        }
        guard let n = number(value) else { throw ProjectError.invalid("Invalid \(key) in \(context).") }
        return n
    }
    static func isEmpty(_ value: Any?) -> Bool {
        switch value {
        case nil, is NSNull: return true
        case let list as [Any]: return list.isEmpty
        case let map as [String: Any]: return map.isEmpty
        case let text as String: return text.isEmpty
        default: return false
        }
    }
}

/// Output size and frame rate exactly as the existing Pro app resolves them on export.
public enum LegacyOutputFormat {
    public static func apply(_ root: [String: Any], to s: inout Sequence) throws {
        guard let settings = root["settings"] as? [String: Any] else { return }
        let fps = try LegacyJSON.required(settings, "exportFrameRate", 30, "settings")
        guard [24.0,25,30,50,60].contains(fps) else { throw ProjectError.invalid("Unsupported project frame rate.") }
        s.frameRate = Int(fps)
        let cap = try LegacyJSON.required(settings, "exportMaxDimension", 1920, "settings")
        guard cap >= 16, cap <= 7680 else { throw ProjectError.invalid("Unsupported output size.") }
        let aspect = settings["aspect"] as? String ?? "source"
        let sizes = (settings[aspect == "custom" ? "customSize" : "sourceDims"] as? [String: Any]) ?? [:]
        var w: Double, h: Double
        if aspect == "custom" { w = try LegacyJSON.required(sizes, "width", 1920, "settings"); h = try LegacyJSON.required(sizes, "height", 1080, "settings") }
        else if aspect == "source" {
            w = try LegacyJSON.required(sizes, "w", 1280, "settings"); h = try LegacyJSON.required(sizes, "h", 720, "settings")
            guard w > 0, h > 0 else { throw ProjectError.invalid("Missing source dimensions. Set an explicit output aspect in Pro first.") }
            let scale = min(1, cap / max(w, h)); w *= scale; h *= scale
        } else {
            guard let ratio = ["16:9":16.0/9,"9:16":9.0/16,"1:1":1,"4:5":0.8,"2.39":2.39,"21:9":21.0/9][aspect] else { throw ProjectError.invalid("Unknown output aspect.") }
            w = ratio >= 1 ? cap : cap * ratio; h = ratio >= 1 ? cap / ratio : cap
        }
        guard w.isFinite, h.isFinite, w >= 16, h >= 16, w <= 7680, h <= 7680 else { throw ProjectError.invalid("Unsupported native dimensions.") }
        s.width = Int((w / 2).rounded()) * 2; s.height = Int((h / 2).rounded()) * 2
    }
}

/// Exact Pro (`scenepilot-cut`) → native scene translation. Every legacy feature is
/// either reproduced with the same pixels and samples, or reported as a blocker.
/// A result with any blocker carries no project: nothing is ever half-translated.
///
/// Equivalence rules are derived from the Pro compositor, not from appearance:
/// - Pro loads effect settings through `coerceEffectSettings`, so a missing key takes
///   its non-neutral default (cinematic look, dynamic punch, zoom transitions, drop
///   ramp on). Effective values are evaluated the same way here.
/// - Pro picture fades take the minimum of the in/out ramps; native multiplies them.
///   They agree only when the fades do not overlap, which is required.
/// - Pro multiplies overlay/track opacity and overlay scale into keyframed motion;
///   native keyframes replace them, so those constants are folded into each key.
/// - Clip colour and effects use CSS filters in gamma-encoded sRGB; native uses
///   linear-light Core Image. Only neutral values are equivalent.
/// - Pro's canvas blends opacity in gamma-encoded sRGB; native defaults to linear
///   light (measured: a 75% fade of full blue is 191 in Pro, ~225 linear). Translated
///   projects therefore use the `gamma` blend space, which reproduces the canvas math.
/// - Beat punch, zoom transitions, the drop ramp and the sequence look (grade,
///   mirror, streak) are ported formula for formula (see SequenceRhythm.swift), driven
///   by the accents and resolved drop the document saved in `renderAnalysis`.
public enum LegacySceneTranslation {
    public static let translator = "scenepilot-cut"
    public static let version = 3
    public static let baseTrackName = "V1 · Base"

    /// (key, neutral value, Pro's loader default when missing, label)
    private static let presets: [(String, String, String, String)] = [
        ("shakePreset", "off", "off", "Camera shake"),
        ("strobePreset", "off", "off", "Strobe"),
        ("stutterPreset", "off", "off", "Stutter"),
        ("speedPreset", "off", "off", "Speed ramp"),
        ("echoPreset", "off", "off", "Echo"),
    ]
    /// Clip fields Pro stores that carry no picture or sound (editing metadata only).
    private static let metadataFields: Set<String> = ["id", "sectionId", "linked", "locked", "groupId", "preservePhrase", "editorial"]
    /// Clip fields this translator understands; anything else blocks instead of being ignored.
    private static let clipFields: Set<String> = metadataFields.union(["assetId", "trackId", "overlay", "compositionId", "start", "duration", "sourceStart", "playbackRate", "fadeIn", "fadeOut", "flipH", "flipV", "transformKeyframes", "color", "effects", "reversed", "timeRemap", "transitionType", "transitionDuration", "scale", "opacity"])
    /// Document sections this translator evaluates or knows carry no picture/sound.
    /// A newer Pro field outside these lists blocks translation rather than vanishing.
    private static let rootFields: Set<String> = ["format", "version", "project", "duration", "bpm", "beatOffset", "beats", "sections", "videoClips", "placements", "compositions", "tracks", "baseCuts", "titles", "projectIntelligence", "projectTranscripts", "storyBrief", "mainAsset", "assets", "effects", "proState", "settings", "savedAt", "analysis", "renderAnalysis"]
    private static let proStateFields: Set<String> = ["autoPolicy", "autoVersions", "audioTracks", "audioBuses", "masterGain", "colorManagement", "audioClips", "transcriptWords", "projectIntelligence", "projectTranscripts", "storyBrief", "markers", "timelineRange", "mediaBins", "snapping", "linkedSelection", "manualDropTime"]
    private static let settingsFields: Set<String> = ["aspect", "customSize", "sourceDims", "exportFrameRate", "exportMaxDimension", "exportFormat", "colorCurve", "lut3dSource", "lut3dMix"]

    public static func translate(_ data: Data, filename: String, linked: [String: Media]) throws -> SceneTranslationResult {
        let inspection = try LegacyCompatibility.inspect(data)
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw ProjectError.invalid("Choose a ScenePilot .scenepilot.json cut file.") }
        var blockers: [SceneTranslationFinding] = [], translated: [SceneTranslationFinding] = []
        func block(_ scope: String, _ feature: String, _ detail: String) { blockers.append(.init(scope: scope, feature: feature, detail: detail)) }
        func carry(_ scope: String, _ feature: String, _ detail: String) { translated.append(.init(scope: scope, feature: feature, detail: detail)) }

        // ---- Unknown sections: a newer Pro feature must never silently vanish ----------
        let pro = root["proState"] as? [String: Any] ?? [:]
        let settings = root["settings"] as? [String: Any] ?? [:]
        for (section, fields, source) in [("", rootFields, root), ("proState.", proStateFields, pro), ("settings.", settingsFields, settings)] {
            for key in source.keys.sorted() where !fields.contains(key) && !LegacyJSON.isEmpty(source[key]) {
                block("Project", "unrecognized.\(section)\(key)", "“\(section)\(key)” isn't understood by this translator, so its effect can't be verified.")
            }
        }

        // ---- Global picture effects, evaluated as Pro's loader evaluates them ----------
        // A missing key takes Pro's default, which the per-key messages name explicitly.
        let effects = root["effects"] as? [String: Any] ?? [:]
        for (key, neutral, fallback, label) in presets {
            let effective = effects[key] as? String ?? fallback
            if effective != neutral { block("Project", "effects.\(key)", "\(label) is “\(effective)”\(effects[key] == nil ? " (Pro's default for a project that doesn't record it)" : ""). Set it to “\(neutral)” in Pro or wait for native support.") }
        }
        if LegacyJSON.bool(effects["audioReactive"]) ?? false { block("Project", "effects.audioReactive", "Audio-reactive motion is on.") }
        // Pro's loader replaces an unknown preset name with its default, exactly as here.
        func choice(_ key: String, _ allowed: [String], _ fallback: String) -> String { (effects[key] as? String).flatMap { allowed.contains($0) ? $0 : nil } ?? fallback }
        let punchPreset = choice("punchPreset", Array(LegacyLook.punch.keys), "dynamic")
        let lookPreset = choice("lookPreset", Array(LegacyLook.presets.keys), "cinematic")
        let defaultTransition = choice("transitionType", LegacyLook.transitions, "zoom")
        let montageEnabled = LegacyJSON.bool(effects["montageEnabled"]) ?? true
        let look = LegacyLook.resolve(effects, preset: lookPreset)
        let pulse = LegacyLook.punch[punchPreset]!

        // ---- Rhythm: the beat grid, section energy and the saved accents and drop ------
        var rhythm = SequenceRhythm(beats: [])
        let rawBeats = root["beats"] as? [Any] ?? []
        let beats = rawBeats.compactMap(LegacyJSON.number)
        if beats.count != rawBeats.count || zip(beats, beats.dropFirst()).contains(where: { $0 > $1 }) { block("Project", "rhythm.beats", "The beat grid isn't a sorted list of times.") }
        else { rhythm.beats = beats }
        for section in root["sections"] as? [[String: Any]] ?? [] where LegacyJSON.bool(section["enabled"]) != false {
            guard let start = LegacyJSON.number(section["start"]), let end = LegacyJSON.number(section["end"]), let energy = LegacyJSON.number(section["energy"]) else {
                block("Project", "rhythm.sections", "A song section has no numeric start, end or energy."); continue
            }
            rhythm.sections.append(EnergySection(start: start, end: end, energy: energy))
        }
        rhythm.sections.sort { $0.start < $1.start }
        var dropTime: Double?
        if let saved = root["renderAnalysis"] as? [String: Any] {
            let rawAccents = saved["accents"] as? [Any] ?? []
            let accents = rawAccents.compactMap(LegacyJSON.number)
            if accents.count != rawAccents.count || accents.contains(where: { $0 < 0 }) { block("Project", "renderAnalysis.accents", "Saved accents aren't a list of times.") }
            else { rhythm.accents = accents.sorted() }
            if let drop = saved["dropRamp"] as? [String: Any] {
                if let time = LegacyJSON.number(drop["dropTime"]), time >= 0 { dropTime = LegacyJSON.number(pro["manualDropTime"]) ?? time }
                else { block("Project", "renderAnalysis.dropRamp", "The saved drop has no valid time.") }
            }
        } else if root["renderAnalysis"] != nil && !(root["renderAnalysis"] is NSNull) {
            block("Project", "renderAnalysis", "Saved render analysis is malformed.")
        }
        // page.tsx dropRampSetting: the saved drop, an enabled ramp and a usable grid.
        var dropRamp: SpeedRamp?
        if let dropTime, LegacyJSON.bool(effects["dropRampEnabled"]) ?? true, rhythm.beats.count > 1 {
            let gaps = zip(rhythm.beats, rhythm.beats.dropFirst()).map { $1 - $0 }.sorted()
            let beatSeconds = gaps[gaps.count / 2]
            if beatSeconds > 0 { dropRamp = SpeedRamp(start: dropTime - LegacyLook.dropRampBeats * beatSeconds, end: dropTime, strength: LegacyLook.dropRampStrength) }
        }

        // ---- Project settings and color management ----------------------------------
        if let curve = settings["colorCurve"] as? String, curve != "none" { block("Project", "settings.colorCurve", "Tone curve “\(curve)” is applied.") }
        if settings["lut3dSource"] is [String: Any] { block("Project", "settings.lut3dSource", "A creative 3D LUT is applied.") }
        if let cm = pro["colorManagement"] as? [String: Any], (cm["workingSpace"] as? String ?? "rec709") != "rec709" || (cm["displayTransform"] as? String ?? "rec709-100") != "rec709-100" {
            block("Project", "proState.colorManagement", "Wide-gamut/HDR color management is active.")
        }
        let titles = root["titles"] as? [Any] ?? []
        if !titles.isEmpty { block("Project", "titles", "\(titles.count) title/caption cue\(titles.count == 1 ? "" : "s") would be missing.") }
        let audioClips = pro["audioClips"] as? [Any] ?? []
        if !audioClips.isEmpty { block("Project", "proState.audioClips", "\(audioClips.count) audio timeline clip\(audioClips.count == 1 ? "" : "s") (mix, fades, automation) aren't translated yet.") }
        if let master = LegacyJSON.number(pro["masterGain"]), master != 1 { block("Project", "proState.masterGain", "Master volume is \(Int((master * 100).rounded()))%.") }
        for bus in pro["audioBuses"] as? [[String: Any]] ?? [] where (LegacyJSON.number(bus["gain"]) ?? 1) != 1 || LegacyJSON.bool(bus["muted"]) == true || LegacyJSON.bool(bus["solo"]) == true {
            block("Project", "proState.audioBuses", "Audio bus “\(bus["name"] as? String ?? "bus")” changes the mix.")
        }

        // ---- Tracks -------------------------------------------------------------------
        var sequence = Sequence(name: "Main Sequence")
        try LegacyOutputFormat.apply(root, to: &sequence)
        let legacyTracks = root["tracks"] as? [[String: Any]] ?? []
        let anySolo = legacyTracks.contains { LegacyJSON.bool($0["solo"]) == true }
        let trackByID = Dictionary(legacyTracks.compactMap { t in (t["id"] as? String).map { ($0, t) } }, uniquingKeysWith: { a, _ in a })
        func trackName(_ t: [String: Any]) -> String { t["name"] as? String ?? (t["id"] as? String ?? "Track") }
        var baseTrackID = "__base__", songTrackID = "__main_audio__"
        while trackByID[baseTrackID] != nil { baseTrackID += "_" }
        while trackByID[songTrackID] != nil { songTrackID += "_" }

        // ---- Clips ------------------------------------------------------------------------
        var clipRecords: [[String: Any]]
        if let canonical = root["videoClips"] as? [[String: Any]] { clipRecords = canonical }
        else {
            clipRecords = (root["baseCuts"] as? [[String: Any]] ?? []).map { var c = $0; c["trackId"] = baseTrackID; return c }
            for var p in root["placements"] as? [[String: Any]] ?? [] {
                p["overlay"] = ["scale": p["scale"] ?? 100, "opacity": p["opacity"] ?? 100, "compositionId": p["compositionId"] ?? ""]
                p.removeValue(forKey: "scale"); p.removeValue(forKey: "opacity"); p.removeValue(forKey: "compositionId")
                clipRecords.append(p)
            }
        }
        let fps = Double(sequence.frameRate)
        var used = Set<String>()
        var baseClips: [Clip] = [], overlayClips: [(legacyTrack: String, clip: Clip)] = []
        var usedTracks = Set<String>(), motionClips = 0, fadedClips = 0
        var baseRecords: [[String: Any]] = [] // Pro's previous-cut rule reads the base lane in document order.
        for (index, c) in clipRecords.enumerated() {
            let id = c["id"] as? String ?? "import-\(index)"
            let scope = "Clip \(id)"
            let overlay = c["overlay"] as? [String: Any]
            let isOverlay = overlay != nil
            for key in c.keys.sorted() where !clipFields.contains(key) && !LegacyJSON.isEmpty(c[key]) {
                block(scope, "clip.unrecognized.\(key)", "Field “\(key)” isn't understood by this translator, so its effect can't be verified.")
            }
            let assetID = c["assetId"] as? String ?? ""
            let nestedID = (overlay?["compositionId"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? (c["compositionId"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            if nestedID != nil || assetID.hasPrefix("composition:") { block(scope, "clip.composition", "Uses a layered Pro composition (text, shapes, masks, roto, 3D)."); continue }
            if LegacyJSON.bool(c["reversed"]) == true { block(scope, "clip.reversed", "Plays in reverse.") }
            if (c["timeRemap"] as? [Any] ?? []).count >= 2 { block(scope, "clip.timeRemap", "Uses keyframed time remapping.") }
            if let color = c["color"] as? [String: Any] {
                let changed = color.keys.sorted().filter { key in
                    guard let v = LegacyJSON.number(color[key]) else { return false }
                    return ["exposure", "contrast", "saturation"].contains(key) ? v != 1 : v != 0
                }
                if !changed.isEmpty { block(scope, "clip.color", "Clip color adjusts \(changed.joined(separator: ", ")) (Pro grades in gamma sRGB; native in linear light).") }
            }
            let activeEffects = (c["effects"] as? [[String: Any]] ?? []).filter { e in
                let enabled = LegacyJSON.bool(e["enabled"]) ?? true
                let amount = LegacyJSON.number(e["amount"]) ?? 1
                let animated = !(e["keyframes"] as? [Any] ?? []).isEmpty
                let expression = (e["expression"] as? [String: Any])?["source"] as? String ?? "none"
                return enabled && (amount > 0 || animated || expression != "none")
            }
            if !activeEffects.isEmpty { block(scope, "clip.effects", "Clip effects: \(activeEffects.map { $0["type"] as? String ?? "effect" }.joined(separator: ", ")).") }
            var transitionIn: CutTransition?
            if !isOverlay {
                // transitionConfigForCut (lib/transitions.ts), including its clamps.
                let own = (c["transitionType"] as? String).flatMap { LegacyLook.transitions.contains($0) ? $0 : nil }
                let kind = own ?? defaultTransition
                if kind == "zoom" {
                    let cutDuration = LegacyJSON.number(c["duration"]) ?? 0
                    let previous = baseRecords.last.flatMap { LegacyJSON.number($0["duration"]) } ?? cutDuration
                    let requested = LegacyJSON.number(c["transitionDuration"]) ?? 0.22
                    transitionIn = CutTransition(kind: .zoom, duration: max(0.04, min(max(0, min(2, cutDuration, previous)), requested)))
                } else if kind != "none" {
                    block(scope, "clip.transition", "“\(kind)” transition into this cut\(own == nil ? " (sequence default)" : "") has no native equivalent yet.")
                }
                baseRecords.append(c)
            }
            guard !assetID.isEmpty else { block(scope, "clip.media", "No media reference."); continue }
            guard let media = linked[assetID] else { block(scope, "media.offline", "Media “\(assetID)” is offline. Relink it in Pro first."); continue }
            guard media.hasVideo else { block(scope, "clip.nonVideo", "Picture clip uses an image or audio-only source."); continue }

            let start = try LegacyJSON.required(c, "start"), duration = try LegacyJSON.required(c, "duration")
            let sourceStart = try LegacyJSON.required(c, "sourceStart", 0)
            let rate = min(8, max(0.1, try LegacyJSON.required(c, "playbackRate", 1)))
            guard start >= 0, sourceStart >= 0, duration > 0 else { throw ProjectError.invalid("Clip \(index + 1) has invalid timing.") }
            if duration < 1 / fps - 0.00001 { block(scope, "clip.subFrame", "Shorter than one frame at \(sequence.frameRate) fps.") }
            if sourceStart + duration * rate > media.duration + 0.05 { block(scope, "clip.beyondSource", "Extends beyond the end of its source media.") }

            let legacyTrackID = isOverlay ? (c["trackId"] as? String ?? (legacyTracks.first?["id"] as? String ?? "")) : baseTrackID
            let track = isOverlay ? trackByID[legacyTrackID] : nil
            if isOverlay && track == nil { block(scope, "clip.missingTrack", "Sits on a track that doesn't exist, so Pro never shows it."); continue }
            if isOverlay { usedTracks.insert(legacyTrackID) }
            let trackOpacity = track.flatMap { LegacyJSON.number($0["opacity"]) } ?? 100
            let overlayScale = isOverlay ? (LegacyJSON.number(overlay?["scale"]) ?? 100) / 100 : 1
            let overlayOpacity = isOverlay ? (LegacyJSON.number(overlay?["opacity"]) ?? 100) / 100 * trackOpacity / 100 : 1
            var fadeIn = try LegacyJSON.required(c, "fadeIn", 0), fadeOut = try LegacyJSON.required(c, "fadeOut", 0)
            if let track { fadeIn = max(LegacyJSON.number(track["fadeIn"]) ?? 0, fadeIn); fadeOut = max(LegacyJSON.number(track["fadeOut"]) ?? 0, fadeOut) }
            if fadeIn < 0 || fadeOut < 0 { block(scope, "clip.fades", "Negative fade length.") }
            else if fadeIn + fadeOut > duration + 0.00001 { block(scope, "clip.fadesOverlap", "Fade in and fade out overlap (Pro takes the lesser ramp; native multiplies).") }
            if fadeIn > 0 || fadeOut > 0 { fadedClips += 1 }

            var clip = Clip(assetId: media.id, trackId: isOverlay ? legacyTrackID : baseTrackID, start: start, duration: duration, id: id)
            clip.sourceStart = sourceStart; clip.rate = rate; clip.gain = 0
            clip.fadeIn = max(0, fadeIn); clip.fadeOut = max(0, fadeOut)
            var transform = ClipTransform(); transform.fill = true
            transform.flipH = LegacyJSON.bool(c["flipH"]) ?? false; transform.flipV = LegacyJSON.bool(c["flipV"]) ?? false
            transform.scale = overlayScale; clip.opacity = overlayOpacity
            clip.transform = transform
            clip.transitionIn = transitionIn
            if let keys = c["transformKeyframes"] as? [[String: Any]], !keys.isEmpty {
                var motionKeys: [MotionKeyframe] = [], motionOK = true
                for key in keys {
                    if !LegacyJSON.isEmpty(key["spatialIn"]) || !LegacyJSON.isEmpty(key["spatialOut"]) { block(scope, "motion.spatialPath", "Keyframes follow a curved spatial path."); motionOK = false; break }
                    let easing: MotionEasing
                    switch key["easing"] as? String ?? "linear" {
                    case "linear": easing = .linear
                    case "ease-in": easing = .easeIn
                    case "ease-out": easing = .easeOut
                    case "hold": easing = .hold
                    case let other: block(scope, "motion.easing.\(other)", "Keyframe easing “\(other)” has no exact native curve."); motionOK = false
                    easing = .linear
                    }
                    guard motionOK else { break }
                    let value = MotionValue(x: try LegacyJSON.required(key, "x", 0, "keyframe"), y: try LegacyJSON.required(key, "y", 0, "keyframe"),
                                            scale: try LegacyJSON.required(key, "scale", 1, "keyframe") * overlayScale,
                                            rotation: try LegacyJSON.required(key, "rotation", 0, "keyframe"),
                                            opacity: try LegacyJSON.required(key, "opacity", 1, "keyframe") * overlayOpacity)
                    motionKeys.append(MotionKeyframe(time: try LegacyJSON.required(key, "time", nil, "keyframe"), value: value, easing: easing))
                }
                if motionOK {
                    motionKeys.sort { $0.time < $1.time }
                    let motion = ClipMotion(keyframes: motionKeys)
                    do { try motion.validate(); clip.motion = motion; motionClips += 1 }
                    catch { block(scope, "motion.range", "Keyframes are outside native limits (\(error.localizedDescription)).") }
                }
            }
            used.insert(assetID)
            if isOverlay { overlayClips.append((legacyTrackID, clip)) } else { baseClips.append(clip) }
        }

        // Each lane shows one clip at a time in Pro; overlapping edits resolve differently natively.
        func checkOverlaps(_ clips: [Clip], _ scope: String) {
            let sorted = clips.sorted { $0.start < $1.start }
            for (a, b) in zip(sorted, sorted.dropFirst()) where b.start < a.start + a.duration - 0.00001 { block(scope, "track.overlap", "Clips \(a.id) and \(b.id) overlap.") }
        }
        checkOverlaps(baseClips, "Track \(baseTrackName)")
        // Track compositing is checked once per track that actually carries clips.
        for id in usedTracks.sorted() {
            guard let track = trackByID[id] else { continue }
            let scope = "Track \(trackName(track))"
            if (track["blend"] as? String ?? "screen") != "normal" { block(scope, "track.blend", "Composites with “\(track["blend"] as? String ?? "screen")” blending.") }
            let filters: [(String, Double)] = [("hue", 0), ("saturation", 100), ("brightness", 100), ("glow", 0)]
            for (key, neutral) in filters where LegacyJSON.number(track[key]) != neutral {
                block(scope, "track.\(key)", "Track \(key) is \(LegacyJSON.number(track[key]).map { "\($0)" } ?? "unrecorded") (neutral is \(Int(neutral))).")
            }
        }
        for id in Set(overlayClips.map(\.legacyTrack)).sorted() { checkOverlaps(overlayClips.filter { $0.legacyTrack == id }.map(\.clip), "Track \(trackByID[id].map(trackName) ?? id)") }
        if !overlayClips.isEmpty && legacyTracks.isEmpty { block("Project", "track.none", "Overlays exist without track records, so Pro orders them by start time.") }
        if !montageEnabled && !baseClips.isEmpty { block("Project", "effects.montageEnabled", "Montage is off, so Pro hides the \(baseClips.count) base cut\(baseClips.count == 1 ? "" : "s") and shows the main source.") }

        // ---- Main source: continuous picture when there are no base cuts, plus its sound ----
        let main = linked["__main__"]
        if root["mainAsset"] != nil && main == nil { block("Project", "media.offline", "The main source is offline. Relink it in Pro first.") }
        let projectDuration = LegacyJSON.number(root["duration"]) ?? main?.duration ?? 0
        var mainClips: [Clip] = []
        if let main {
            if baseClips.isEmpty && main.hasVideo {
                var picture = Clip(assetId: main.id, trackId: baseTrackID, start: 0, duration: min(main.duration, projectDuration), id: "main-picture")
                picture.gain = 0; var fit = ClipTransform(); fit.fill = false; picture.transform = fit
                if let dropRamp, dropRamp.end > 0, dropRamp.start < picture.duration { picture.speedRamp = dropRamp }
                mainClips.append(picture); used.insert("__main__"); carry("Main source", "main.picture", "Continuous picture, letterboxed as in Pro.")
            }
            if main.hasAudio {
                var sound = Clip(assetId: main.id, trackId: songTrackID, start: 0, duration: min(main.duration, projectDuration), id: "main-audio")
                sound.opacity = 0; mainClips.append(sound); used.insert("__main__"); carry("Main source", "main.audio", "Song audio at unity gain from the start.")
            }
        }
        let lastEnd = (baseClips + overlayClips.map(\.clip) + mainClips).map { $0.start + $0.duration }.max() ?? 0
        if projectDuration > lastEnd + 1 / fps { block("Project", "sequence.trailingGap", "Pro's export runs \(String(format: "%.2f", projectDuration - lastEnd))s past the last clip; native sequences end at their last clip.") }

        // The drop ramp retimes the picture lane on the song clock; overlays keep real time.
        if let dropRamp {
            for i in baseClips.indices where baseClips[i].start < dropRamp.end && baseClips[i].start + baseClips[i].duration > dropRamp.start { baseClips[i].speedRamp = dropRamp }
            carry("Project", "effects.dropRampEnabled", String(format: "Slow-mo drop ramp into %.2fs over the previous %.2fs.", dropRamp.end, dropRamp.end - dropRamp.start))
        }
        let punch = BeatPunch(amount: LegacyLook.punchAmount[punchPreset]!, envelope: pulse)
        if punch.amount > 0 { carry("Project", "effects.punchPreset", "“\(punchPreset)” beat punch on the picture lane\(rhythm.accents.isEmpty ? "" : ", accents hit harder")\(rhythm.sections.isEmpty ? "" : ", scaled by section energy").") }
        if look != nil { carry("Project", "effects.lookPreset", "“\(lookPreset)” look\(rhythm.sections.isEmpty ? "" : " following section energy"), pulsing on the beat.") }
        let zooms = baseClips.filter { $0.transitionIn != nil }.count
        if zooms > 0 { carry("Track \(baseTrackName)", "clip.transition", "Zoom transition into \(zooms) cut\(zooms == 1 ? "" : "s").") }
        if !baseClips.isEmpty { carry("Track \(baseTrackName)", "clip.timing", "\(baseClips.count) picture cut\(baseClips.count == 1 ? "" : "s"): timing, speed, flips and cover framing.") }
        if !overlayClips.isEmpty { carry("Overlays", "clip.overlay", "\(overlayClips.count) overlay clip\(overlayClips.count == 1 ? "" : "s") with scale, opacity and track order.") }
        if fadedClips > 0 { carry("Clips", "clip.fades", "\(fadedClips) picture fade\(fadedClips == 1 ? "" : "s"), blended in gamma space like Pro.") }
        if motionClips > 0 { carry("Clips", "motion.keyframes", "Keyframed position, scale, rotation and opacity on \(motionClips) clip\(motionClips == 1 ? "" : "s").") }

        guard blockers.isEmpty else { return SceneTranslationResult(name: inspection.name, project: nil, translated: translated, blockers: blockers) }

        // ---- Assemble. Native tracks are listed top first; Pro overlays are bottom first. ----
        sequence.tracks = legacyTracks.reversed().compactMap { t in
            guard let id = t["id"] as? String else { return nil }
            var track = Track(name: trackName(t), id: id)
            track.enabled = (LegacyJSON.bool(t["enabled"]) ?? true) && (!anySolo || LegacyJSON.bool(t["solo"]) == true)
            track.locked = LegacyJSON.bool(t["locked"]) ?? false
            return track
        }
        var baseTrack = Track(name: baseTrackName, id: baseTrackID)
        baseTrack.followsBeat = true // Pro punches the picture lane only (affectOverlays is off).
        sequence.tracks.append(baseTrack)
        if !rhythm.beats.isEmpty || !rhythm.sections.isEmpty { sequence.rhythm = rhythm }
        if punch.amount > 0 { sequence.punch = punch }
        sequence.look = look.map { var l = $0; l.pulse = pulse; return l }
        if mainClips.contains(where: { $0.trackId == songTrackID }) { sequence.tracks.append(Track(name: "A1 · Song", id: songTrackID)) }
        sequence.videoClips = overlayClips.map(\.clip) + baseClips + mainClips
        var project = Project(name: inspection.name)
        project.legacyArchive = try LegacyArchive(filename: filename, data: data)
        project.translation = SceneTranslationStamp(translator: translator, version: version)
        project.blendSpace = .gamma // Pro's canvas blends encoded sRGB; see BlendSpace.
        project.media = used.sorted().compactMap { linked[$0] }
        sequence.id = project.mainSequenceId
        project.sequences = [sequence]
        do { return SceneTranslationResult(name: inspection.name, project: try project.validated(), translated: translated, blockers: []) }
        catch {
            return SceneTranslationResult(name: inspection.name, project: nil, translated: translated, blockers: [.init(scope: "Project", feature: "native.validation", detail: error.localizedDescription)])
        }
    }
}

/// Pro's look, punch and transition presets (lib/grade.ts, lib/motion.ts,
/// lib/transitions.ts, lib/speed.ts), resolved as the Pro loader and export do.
enum LegacyLook {
    static let transitions = ["none", "flash", "zoom", "whip", "glitch", "dissolve", "dip", "slide"]
    static let punch: [String: BeatEnvelope] = [
        "off": BeatEnvelope(attack: 0, decay: 0.1, accentBoost: 1),
        "subtle": BeatEnvelope(attack: 0.02, decay: 0.26, accentBoost: 1.6),
        "dynamic": BeatEnvelope(attack: 0.012, decay: 0.22, accentBoost: 1.9),
        "slam": BeatEnvelope(attack: 0, decay: 0.16, accentBoost: 2.2),
    ]
    static let punchAmount: [String: Double] = ["off": 0, "subtle": 0.03, "dynamic": 0.06, "slam": 0.12]
    /// DROP_RAMP: ramp-out over 8 beats, strength 3.2.
    static let dropRampBeats = 8.0, dropRampStrength = 3.2
    /// exposure, contrast, saturation, temperature, tint, bloom, aberration, vignette, grain
    static let presets: [String: [Double]] = [
        "none": [1, 1, 1, 0, 0, 0, 0, 0, 0],
        "cinematic": [1.02, 1.14, 0.92, 0.12, 0, 0.35, 0.0018, 0.32, 0.05],
        "neon": [1.06, 1.22, 1.35, -0.15, 0, 0.6, 0.004, 0.22, 0.03],
        "vhs": [0.98, 1.08, 1.1, 0.05, 0, 0.2, 0.006, 0.4, 0.16],
        "noir": [1.0, 1.3, 0.12, -0.05, 0, 0.25, 0.001, 0.5, 0.1],
    ]

    /// GRADE_PRESETS[look] + applyGradeAdjust(manualGrade), with mirror and streak;
    /// nil when Pro's export runs no grade pass at all (hasShaderEffect is false).
    static func resolve(_ effects: [String: Any], preset: String) -> SequenceLook? {
        let manual = effects["manualGrade"] as? [String: Any] ?? [:]
        func adjust(_ key: String, _ neutral: Double, _ range: ClosedRange<Double>) -> Double { min(range.upperBound, max(range.lowerBound, LegacyJSON.number(manual[key]) ?? neutral)) }
        // Order matches `presets`.
        let m = [adjust("exposure", 1, 0.1...3), adjust("contrast", 1, 0.1...3), adjust("saturation", 1, 0...3), adjust("temperature", 0, -1...1), adjust("tint", 0, -1...1),
                 adjust("bloom", 0, 0...3), adjust("aberration", 0, 0...0.05), adjust("vignette", 0, 0...1), adjust("grain", 0, 0...1)]
        let mirror = Int(min(3, max(0, (LegacyJSON.number(effects["mirrorMode"]) ?? 0).rounded())))
        let streak = min(1, max(0, LegacyJSON.number(effects["streak"]) ?? 0))
        guard preset != "none" || mirror > 0 || streak > 0 || m != presets["none"]! else { return nil }
        let p = presets[preset]!
        var look = SequenceLook()
        look.exposure = max(0, p[0] * m[0]); look.contrast = max(0, p[1] * m[1]); look.saturation = max(0, p[2] * m[2])
        look.temperature = min(1, max(-1, p[3] + m[3])); look.tint = min(1, max(-1, p[4] + m[4]))
        look.bloom = min(3, max(0, p[5] + m[5])); look.aberration = min(0.05, max(0, p[6] + m[6]))
        look.vignette = min(1, max(0, p[7] + m[7])); look.grain = min(1, max(0, p[8] + m[8]))
        look.mirror = mirror; look.streak = streak
        return look
    }
}
