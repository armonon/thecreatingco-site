import Foundation
import CoreFoundation

/// Opaque source bytes are retained, never rewritten through a lossy decoder.
public struct LegacyArchive: Codable, Equatable {
    public let filename: String
    public let data: Data
    public init(filename: String, data: Data) throws {
        _ = try LegacyCompatibility.inspect(data)
        self.filename = URL(fileURLWithPath: filename).lastPathComponent; self.data = data
    }
    private enum CodingKeys: String, CodingKey { case filename, data }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        try self.init(filename: c.decode(String.self, forKey: .filename), data: c.decode(Data.self, forKey: .data))
    }
}

public struct LegacyMediaReference: Equatable {
    public let id: String
    public let name: String
    public let path: String?
    public let kind: String
}

public struct LegacyCompatibilityReport {
    public let name: String
    public let media: [LegacyMediaReference]
    public let clipCount: Int
    public let compositionCount: Int
    public let findings: [String]
    public var text: String {
        (["COMPATIBILITY REVIEW — \(name)", "\(clipCount) timeline clips · \(compositionCount) compositions · \(media.count) media references", "", "This is not a native timeline conversion. Keep editing this project in the existing Pro app for its original appearance and behavior.", "", "Features requiring migration:"] + findings.map { "• " + $0 } + ["", "Import Linked Media Only creates no clips or effects. It retains an exact copy of this source document inside the native project. Save it under a NEW native filename. The source file is never modified.", "", "MEDIA"] + media.map { "\($0.name) [\($0.kind)] — \($0.path ?? "No local source path; relink in the existing Pro app")" }).joined(separator: "\n")
    }
}

public enum LegacyCompatibility {
    public static func inspect(_ data: Data) throws -> LegacyCompatibilityReport {
        guard data.count <= 32 * 1024 * 1024 else { throw ProjectError.invalid("Compatibility review supports source documents up to 32 MB.") }
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any], root["format"] as? String == "scenepilot-cut" else { throw ProjectError.invalid("Choose a ScenePilot .scenepilot.json cut file.") }
        if let version = root["version"] {
            guard let n = version as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), [1,2].contains(n.doubleValue) else { throw ProjectError.invalid("Unsupported legacy project version. Use the app that created it.") }
        }
        func records(_ value: Any?, _ path: String) throws -> [[String: Any]] {
            guard let value else { return [] }
            guard let list = value as? [[String: Any]] else { throw ProjectError.invalid("Malformed \(path): expected objects.") }
            return list
        }
        let assets = try records(root["assets"], "assets")
        var references: [LegacyMediaReference] = []
        func reference(_ item: [String: Any], _ path: String) throws -> LegacyMediaReference {
            guard let name = item["name"] as? String, let kind = item["kind"] as? String, ["audio","video","image"].contains(kind) else { throw ProjectError.invalid("Malformed media at \(path).") }
            let raw = item["sourcePath"] as? String
            let local = raw.flatMap { $0.hasPrefix("/") && !$0.contains("\0") ? $0 : nil }
            return LegacyMediaReference(id: path == "mainAsset" ? "__main__" : (item["id"] as? String ?? ""), name: name, path: local, kind: kind)
        }
        if let main = root["mainAsset"] {
            guard let main = main as? [String: Any] else { throw ProjectError.invalid("Malformed mainAsset.") }
            references.append(try reference(main, "mainAsset"))
        }
        for (i, asset) in assets.enumerated() { references.append(try reference(asset, "assets[\(i)]")) }
        let clips: [[String: Any]]
        if let canonical = root["videoClips"] { clips = try records(canonical, "videoClips") }
        else { clips = try records(root["baseCuts"], "baseCuts") + records(root["placements"], "placements") }
        let comps = try records(root["compositions"], "compositions")
        var findings = ["Timeline timing, track order, fit rules, and audio routing require verified translation before native export."]
        if root["effects"] != nil { findings.append("effects: global look, motion, transitions, strobe and music automation settings are retained in the original document, not applied natively.") }
        if root["settings"] != nil { findings.append("settings: output dimensions, color curves, LUTs and delivery settings need migration.") }
        if root["proState"] != nil { findings.append("proState: mixer, captions, markers and professional editing state need migration.") }
        if !(try records(root["titles"], "titles")).isEmpty { findings.append("titles: title styling and timing need migration.") }
        let clipFeatures = ["effects","color","transformKeyframes","timeRemap","overlay","reversed","fadeIn","fadeOut"]
        for key in clipFeatures where clips.contains(where: { $0[key] != nil }) { findings.append("videoClips.\(key): present on \(clips.filter { $0[key] != nil }.count) clips; must be translated and pixel-tested.") }
        if !comps.isEmpty { findings.append("compositions: \(comps.count) layered compositions; masks, roto, mattes, parenting, text and animation remain in the existing Pro renderer.") }
        let known: Set<String> = ["format","version","project","duration","bpm","beatOffset","beats","sections","videoClips","placements","compositions","tracks","baseCuts","titles","projectIntelligence","projectTranscripts","storyBrief","mainAsset","assets","effects","proState","settings","savedAt"]
        for key in root.keys.sorted() where !known.contains(key) { findings.append("\(key): unrecognized extension; retained byte-for-byte, not interpreted.") }
        return LegacyCompatibilityReport(name: root["project"] as? String ?? "Untitled cut", media: references, clipCount: clips.count, compositionCount: comps.count, findings: findings)
    }
}
