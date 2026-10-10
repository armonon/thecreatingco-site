import Foundation

public struct WorkspaceLayout: Codable, Equatable {
    public var version = 1
    public var mediaWidth = 240.0
    public var inspectorWidth = 278.0
    public var upperFraction = 0.64
    public init() {}
    public static func restore(_ data: Data?) -> WorkspaceLayout {
        guard let data, let value = try? JSONDecoder().decode(Self.self, from: data), value.version == 1,
              [value.mediaWidth,value.inspectorWidth,value.upperFraction].allSatisfy(\.isFinite) else { return Self() }
        var repaired = value
        repaired.mediaWidth = max(218, min(400, value.mediaWidth))
        repaired.inspectorWidth = max(264, min(290, value.inspectorWidth))
        repaired.upperFraction = max(0.35, min(0.8, value.upperFraction))
        return repaired
    }
    public func positions(width: Double, height: Double) -> (left: Double, right: Double, top: Double) {
        let width = width.isFinite ? max(800, width) : 1000
        let height = height.isFinite ? max(530, height) : 700
        let inspector = max(264, min(290, inspectorWidth))
        let left = max(218, min(400, min(mediaWidth, width - inspector - 310)))
        let top = max(300, min(height - 230, height * max(0.35, min(0.8, upperFraction))))
        return (left, width - inspector, top)
    }
}
