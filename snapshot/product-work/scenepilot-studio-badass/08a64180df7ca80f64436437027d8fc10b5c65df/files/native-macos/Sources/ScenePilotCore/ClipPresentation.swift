import Foundation

public struct ClipTransform: Codable, Equatable, Sendable {
    public var x = 0.0
    public var y = 0.0
    public var scale = 1.0
    public var rotation = 0.0
    public var fill = false
    public var flipH = false
    public var flipV = false
    public init() {}
    public func validate() throws {
        guard [x,y,scale,rotation].allSatisfy(\.isFinite), abs(x) <= 8, abs(y) <= 8, (0.01...16).contains(scale), abs(rotation) <= 3600 else { throw ProjectError.invalid("Invalid clip transform.") }
    }
}

/// The unsplit fade envelope. Offset is in timeline seconds, not source seconds.
public struct FadeWindow: Codable, Equatable {
    public var offset: Double
    public var duration: Double
    public init(offset: Double, duration: Double) { self.offset = offset; self.duration = duration }
}
