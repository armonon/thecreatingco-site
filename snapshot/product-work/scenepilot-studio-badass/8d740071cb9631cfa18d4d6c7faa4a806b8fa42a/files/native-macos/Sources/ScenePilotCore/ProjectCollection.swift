import Foundation

public enum ProjectCollection {
    /// New folder only. Publish the folder after every source and the document are safely copied.
    public static func collect(_ project: Project, to destination: URL) throws -> URL {
        _ = try project.validated(); try Task.checkCancellation()
        guard destination.isFileURL, !FileManager.default.fileExists(atPath: destination.path) else { throw ProjectError.invalid("Choose a new collection folder. Existing folders are never overwritten.") }
        let parent = destination.deletingLastPathComponent()
        let staging = parent.appendingPathComponent(".scenepilot-collect-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: staging, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: staging) }
        let mediaRoot = staging.appendingPathComponent("Media")
        try FileManager.default.createDirectory(at: mediaRoot, withIntermediateDirectories: false)
        var next = project
        var copied: [String: String] = [:]
        for i in next.media.indices {
            try Task.checkCancellation()
            let source = URL(fileURLWithPath: next.media[i].path).resolvingSymlinksInPath().standardizedFileURL
            let values = try source.resourceValues(forKeys: [.isRegularFileKey])
            guard values.isRegularFile == true else { throw ProjectError.invalid("Relink missing media before collecting: \(next.media[i].name)") }
            let name: String
            if let existing = copied[source.path] { name = existing }
            else {
                name = "\(i)-" + source.lastPathComponent
                let output = mediaRoot.appendingPathComponent(name)
                guard FileManager.default.createFile(atPath: output.path, contents: nil) else { throw ProjectError.invalid("Cannot create collected media.") }
                let input = try FileHandle(forReadingFrom: source), writer = try FileHandle(forWritingTo: output)
                defer { try? input.close(); try? writer.close() }
                while let chunk = try input.read(upToCount: 1024 * 1024), !chunk.isEmpty {
                    try Task.checkCancellation(); try writer.write(contentsOf: chunk)
                }
                try writer.synchronize()
                copied[source.path] = name
            }
            // Relative resolution occurs only in ProjectStore.load; canonical in-memory paths stay absolute.
            next.media[i].path = destination.appendingPathComponent("Media").appendingPathComponent(name).path
        }
        try Task.checkCancellation()
        let filename = "Project.scenepilot-native.json"
        try encode(next, relativeTo: destination).write(to: staging.appendingPathComponent(filename), options: .withoutOverwriting)
        try Task.checkCancellation()
        try FileManager.default.moveItem(at: staging, to: destination)
        return destination.appendingPathComponent(filename)
    }
    static func encode(_ project: Project, relativeTo directory: URL) throws -> Data {
        var json = try JSONSerialization.jsonObject(with: project.encoded()) as! [String: Any]
        var media = json["media"] as! [[String: Any]]
        let localMedia = directory.appendingPathComponent("Media").standardizedFileURL
        for i in media.indices {
            let url = URL(fileURLWithPath: project.media[i].path).standardizedFileURL
            if url.deletingLastPathComponent() == localMedia { media[i]["path"] = "Media/" + url.lastPathComponent }
        }
        json["media"] = media
        return try JSONSerialization.data(withJSONObject: json, options: [.prettyPrinted,.sortedKeys])
    }
    static func resolve(_ data: Data, relativeTo directory: URL) throws -> Data {
        guard var json = try JSONSerialization.jsonObject(with: data) as? [String: Any], var media = json["media"] as? [[String: Any]] else { return data }
        for i in media.indices {
            guard let path = media[i]["path"] as? String, !path.hasPrefix("/") else { continue }
            let parts = path.split(separator: "/", omittingEmptySubsequences: false)
            guard parts.count == 2, parts[0] == "Media", !parts[1].isEmpty, parts[1] != ".", parts[1] != "..", !path.contains("\0") else { throw ProjectError.invalid("Unsafe relative project media path.") }
            media[i]["path"] = directory.appendingPathComponent(path).path
        }
        json["media"] = media
        return try JSONSerialization.data(withJSONObject: json)
    }
}
