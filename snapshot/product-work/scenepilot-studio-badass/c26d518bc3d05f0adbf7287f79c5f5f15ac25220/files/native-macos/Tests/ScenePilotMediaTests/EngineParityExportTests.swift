import XCTest
import AVFoundation
import ScenePilotCore
@testable import ScenePilotMedia

/// Native half of `scripts/certify-engine-parity.mjs`. Runs only when the harness
/// supplies SCENEPILOT_PARITY_DIR: each Pro document is translated and exported by the
/// native engine next to Pro's own export of the same document.
extension MediaTests {
    @MainActor func testEngineParityExportsTranslatedDocuments() async throws {
        guard let dir = ProcessInfo.processInfo.environment["SCENEPILOT_PARITY_DIR"] else { throw XCTSkip("Run scripts/certify-engine-parity.mjs.") }
        let root = URL(fileURLWithPath: dir)
        struct Manifest: Decodable { struct Case: Decodable { let name: String; let document: String }; let cases: [Case]; let media: [String: String] }
        let manifest = try JSONDecoder().decode(Manifest.self, from: Data(contentsOf: root.appendingPathComponent("cases.json")))
        var linked: [String: Media] = [:]
        for (id, path) in manifest.media { linked[id] = try await NativeMedia.inspect(URL(fileURLWithPath: path)) }
        var results: [[String: Any]] = []
        for item in manifest.cases {
            let data = try Data(contentsOf: URL(fileURLWithPath: item.document))
            let translation = try LegacySceneTranslation.translate(data, filename: "\(item.name).scenepilot.json", linked: linked)
            guard let project = translation.project else {
                results.append(["name": item.name, "exact": false, "blockers": translation.blockers.map { "\($0.feature): \($0.detail)" }])
                continue
            }
            let output = root.appendingPathComponent("\(item.name).native.mp4")
            try? FileManager.default.removeItem(at: output)
            let built = try await NativeMedia.build(project, sequenceId: project.mainSequenceId)
            try await NativeExporter().export(built, to: output)
            results.append(["name": item.name, "exact": true, "blockers": [String]()])
        }
        try JSONSerialization.data(withJSONObject: results, options: .prettyPrinted).write(to: root.appendingPathComponent("native-results.json"))
    }
}
