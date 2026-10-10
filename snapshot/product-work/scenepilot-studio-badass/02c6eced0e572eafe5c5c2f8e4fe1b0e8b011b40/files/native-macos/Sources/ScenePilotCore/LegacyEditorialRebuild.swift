import Foundation
import CoreFoundation

/// Deliberately an editorial rebuild, NOT lossless render compatibility. The UI requires explicit acknowledgement.
public enum LegacyEditorialRebuild {
    public static let warning = "Rebuilds picture cut positions, source ranges, linear speed, flips and overlay scale/opacity. Uses original main audio only. Global effects, transitions, color, titles, audio edits/mixing, automation, masks and motion are NOT translated. Nested compositions, reverse and time-remapped clips must be rendered in existing Pro first. The exact original document is archived. Compare both renders before replacing any production workflow."
    public static func rebuild(_ data: Data, filename: String, linked: [String: Media]) throws -> Project {
        let report = try LegacyCompatibility.inspect(data)
        let root = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        guard Set(report.media.map(\.id)).count == report.media.count, report.media.allSatisfy({ !$0.id.isEmpty }) else { throw ProjectError.invalid("Legacy media IDs are missing or duplicated. Repair the source document first.") }
        if root["mainAsset"] != nil, linked["__main__"] == nil { throw ProjectError.invalid("The main source is unavailable. Relink it before rebuilding.") }
        func number(_ item: [String: Any], _ key: String, _ fallback: Double? = nil) throws -> Double {
            guard let value = item[key] else { if let fallback { return fallback }; throw ProjectError.invalid("Missing \(key) in cut.") }
            guard let n = value as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), n.doubleValue.isFinite else { throw ProjectError.invalid("Invalid \(key) in cut.") }
            return n.doubleValue
        }
        var result = Project(name: report.name + " — Editorial Rebuild")
        result.legacyArchive = try LegacyArchive(filename: filename, data: data)
        var s = result.sequences[0]
        try LegacyOutputFormat.apply(root, to: &s)
        var clips = root["videoClips"] as? [[String: Any]]
        if clips == nil {
            clips = (root["baseCuts"] as? [[String: Any]] ?? []).map { var c = $0; c["trackId"] = "base"; return c }
            for var p in root["placements"] as? [[String: Any]] ?? [] {
                p["overlay"] = ["scale": p["scale"] ?? 100, "opacity": p["opacity"] ?? 100, "compositionId": p["compositionId"] ?? ""]
                clips!.append(p)
            }
        }
        let legacyTracks = root["tracks"] as? [[String: Any]] ?? []
        s.tracks = []; var trackIDs = Set<String>()
        func addTrack(_ id: String) {
            guard trackIDs.insert(id).inserted else { return }
            let info = legacyTracks.first { $0["id"] as? String == id }
            var track = Track(name: info?["name"] as? String ?? id, id: id)
            track.enabled = info?["enabled"] as? Bool ?? true; track.locked = info?["locked"] as? Bool ?? false
            s.tracks.append(track)
        }
        // Existing Pro overlays are ordered bottom to top; native tracks are top first.
        for track in legacyTracks.reversed() { if let id = track["id"] as? String { addTrack(id) } }
        var used = Set<String>()
        func source(_ id: String) throws -> Media {
            guard let media = linked[id] else { throw ProjectError.invalid("Media \(id) is unavailable. Relink it in existing Pro and retry; no partial timeline was imported.") }
            used.insert(id); return media
        }
        for (index,c) in (clips ?? []).enumerated() {
            let overlay = c["overlay"] as? [String: Any]
            guard (overlay?["compositionId"] as? String ?? "").isEmpty, c["reversed"] as? Bool != true,
                  (c["timeRemap"] as? [Any] ?? []).isEmpty else { throw ProjectError.invalid("Clip \(index + 1) uses nesting, reverse or time remap. Render it in Pro before rebuilding.") }
            guard let assetID = c["assetId"] as? String else { throw ProjectError.invalid("Clip \(index + 1) has no media ID.") }
            let media = try source(assetID)
            guard media.hasVideo else { throw ProjectError.invalid("Picture cut \(index + 1) does not reference video. Images/audio-only clips require migration.") }
            let track = c["trackId"] as? String ?? (overlay == nil ? "base" : "overlay")
            addTrack(track)
            var clip = Clip(assetId: media.id, trackId: track, start: try number(c,"start"), duration: try number(c,"duration"), id: c["id"] as? String ?? "import-\(index)")
            clip.sourceStart = try number(c,"sourceStart",0); clip.rate = try number(c,"playbackRate",1); clip.gain = 0
            var transform = ClipTransform(); transform.fill = true; transform.flipH = c["flipH"] as? Bool ?? false; transform.flipV = c["flipV"] as? Bool ?? false
            if let overlay { transform.scale = try number(overlay,"scale",100)/100; clip.opacity = try number(overlay,"opacity",100)/100 }
            clip.transform = transform; s.videoClips.append(clip)
        }
        if let main = linked["__main__"] {
            used.insert("__main__")
            if main.hasAudio {
                let track = "native-main-audio-" + UUID().uuidString; addTrack(track)
                let duration = min(main.duration, try number(root,"duration",main.duration))
                var clip = Clip(assetId: main.id, trackId: track, start: 0, duration: duration)
                clip.opacity = 0; s.videoClips.append(clip)
            }
        }
        if s.tracks.isEmpty { s.tracks = [Track(name: "Track 1")] }
        // Stable and unique native asset IDs are supplied by media inspection.
        result.media = used.sorted().compactMap { linked[$0] }; result.sequences[0] = s
        return try result.validated()
    }
}
