import Foundation

/// One clip/group envelope mapped into root sequence seconds.
public struct AudioFadeEnvelope: Equatable, Sendable {
    public var start: Double, duration: Double, fadeIn: Double, fadeOut: Double
    public init(start: Double, duration: Double, fadeIn: Double, fadeOut: Double) { self.start = start; self.duration = duration; self.fadeIn = fadeIn; self.fadeOut = fadeOut }
    public func value(at t: Double) -> Double {
        let incoming = fadeIn > 0 ? min(1,max(0,(t-start)/fadeIn)) : 1
        let outgoing = fadeOut > 0 ? min(1,max(0,(start+duration-t)/fadeOut)) : 1
        return incoming * outgoing
    }
}
public struct AudioVolumeRamp: Equatable, Sendable {
    public let start: Double, end: Double, from: Double, to: Double
}
public enum AudioEnvelope {
    /// AVAudioMix accepts linear ramps. Products of nested fades are nonlinear.
    /// Partition at every knee, then bound linear-interpolation error using
    /// max|f''| * h²/8. Unlike midpoint sampling this cannot miss an interior peak.
    /// Error is <=1e-5 absolute gain before Float/CMTime conversion. Fail rather
    /// than allocate unbounded automation on pathological gain/depth inputs.
    public static func ramps(_ envelopes: [AudioFadeEnvelope], gain: Double, from start: Double, to end: Double, tolerance: Double = 0.00001) throws -> [AudioVolumeRamp] {
        guard start.isFinite, end.isFinite, end > start, gain.isFinite, gain >= 0, tolerance.isFinite, tolerance > 0, envelopes.count <= 32 else { throw ProjectError.invalid("Invalid native audio envelope.") }
        var points = [start,end]
        for e in envelopes {
            guard [e.start,e.duration,e.fadeIn,e.fadeOut].allSatisfy(\.isFinite), e.duration > 0, e.fadeIn >= 0, e.fadeOut >= 0, e.fadeIn+e.fadeOut <= e.duration+0.00001 else { throw ProjectError.invalid("Invalid nested fade window.") }
            points += [e.start,e.start+e.fadeIn,e.start+e.duration-e.fadeOut,e.start+e.duration].filter { $0 > start && $0 < end }
        }
        points = Array(Set(points)).sorted()
        func value(_ t: Double) -> Double { envelopes.reduce(gain) { $0 * $1.value(at:t) } }
        var result: [AudioVolumeRamp] = []
        for (a,b) in zip(points,points.dropFirst()) {
            let slopes = envelopes.flatMap { e -> [Double] in
                func incoming(_ t: Double) -> Double { e.fadeIn > 0 ? min(1,max(0,(t-e.start)/e.fadeIn)) : 1 }
                func outgoing(_ t: Double) -> Double { e.fadeOut > 0 ? min(1,max(0,(e.start+e.duration-t)/e.fadeOut)) : 1 }
                return [(incoming(b)-incoming(a))/(b-a),(outgoing(b)-outgoing(a))/(b-a)]
            }
            var curvature = 0.0
            for i in slopes.indices { for j in slopes.indices where i != j { curvature += abs(slopes[i]*slopes[j]) } }
            let needed = ceil((b-a) * sqrt(gain * curvature / (8*tolerance)))
            guard needed.isFinite, needed <= 100_000, result.count + Int(needed) <= 100_000 else { throw ProjectError.invalid("Nested audio fade automation exceeds its safety limit. Reduce nesting or gain.") }
            let count = max(1,Int(needed))
            for i in 0..<count {
                let x = a+(b-a)*Double(i)/Double(count), y = a+(b-a)*Double(i+1)/Double(count)
                let v0 = value(x), v1 = value(y)
                guard Float(v0).isFinite, Float(v1).isFinite else { throw ProjectError.invalid("Nested audio gain exceeds native float range.") }
                result.append(AudioVolumeRamp(start:x,end:y,from:v0,to:v1))
            }
        }
        return result
    }
}
