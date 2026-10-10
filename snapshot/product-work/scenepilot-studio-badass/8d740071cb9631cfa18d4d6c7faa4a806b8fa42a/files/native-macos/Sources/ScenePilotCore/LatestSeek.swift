import Foundation

/// One seek in flight, one replaceable pending destination. UI playhead updates
/// need not wait for decoding. Tickets reject completions from replaced items.
public struct LatestSeek: Sendable {
    public struct Ticket: Equatable, Sendable {
        public let id: UInt64
        public let seconds: Double
    }
    private var serial: UInt64 = 0
    public private(set) var active: Ticket?
    public private(set) var pending: Double?
    public var isSeeking: Bool { active != nil }
    public init() {}
    public mutating func submit(_ seconds: Double) -> Ticket? {
        guard seconds.isFinite, seconds >= 0 else { return nil }
        if let active { pending = active.seconds == seconds ? nil : seconds; return nil }
        serial &+= 1
        let ticket = Ticket(id: serial, seconds: seconds); active = ticket; return ticket
    }
    public mutating func complete(_ ticket: Ticket) -> Ticket? {
        guard active == ticket else { return nil }
        active = nil
        let next = pending; pending = nil
        return next.flatMap { submit($0) }
    }
    public mutating func reset() { active = nil; pending = nil }
}
