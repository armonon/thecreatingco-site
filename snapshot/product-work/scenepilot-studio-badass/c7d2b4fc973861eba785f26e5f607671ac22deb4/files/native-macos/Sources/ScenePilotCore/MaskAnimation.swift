import Foundation

public struct MaskPoint: Codable, Equatable, Sendable {
    public var x: Double, y: Double
    public init(_ x: Double, _ y: Double) { self.x = x; self.y = y }
    public func mixed(_ b: Self, _ t: Double) -> Self { Self(x + (b.x - x) * t, y + (b.y - y) * t) }
}
public struct BezierVertex: Codable, Equatable, Sendable {
    public var anchor: MaskPoint, incoming: MaskPoint, outgoing: MaskPoint
    public init(_ anchor: MaskPoint, incoming: MaskPoint? = nil, outgoing: MaskPoint? = nil) {
        self.anchor = anchor; self.incoming = incoming ?? anchor; self.outgoing = outgoing ?? anchor
    }
    public func validate() throws {
        guard [anchor,incoming,outgoing].allSatisfy({ $0.x.isFinite && $0.y.isFinite && abs($0.x) <= 8 && abs($0.y) <= 8 }) else { throw ProjectError.invalid("Bezier coordinates must be finite and within ±800% of mask space.") }
    }
}
extension ClipMask {
    public func convertedToBezier() -> Self {
        guard shape != .bezier else { return self }
        var result = self; result.shape = .bezier
        if shape == .ellipse {
            let k = 0.2761423749153967
            result.points = [BezierVertex(MaskPoint(0.5,0), incoming: MaskPoint(0.5-k,0), outgoing: MaskPoint(0.5+k,0)),
                BezierVertex(MaskPoint(1,0.5), incoming: MaskPoint(1,0.5-k), outgoing: MaskPoint(1,0.5+k)),
                BezierVertex(MaskPoint(0.5,1), incoming: MaskPoint(0.5+k,1), outgoing: MaskPoint(0.5-k,1)),
                BezierVertex(MaskPoint(0,0.5), incoming: MaskPoint(0,0.5+k), outgoing: MaskPoint(0,0.5-k))]
        } else { result.points = [MaskPoint(0,0),MaskPoint(1,0),MaskPoint(1,1),MaskPoint(0,1)].map { BezierVertex($0) } }
        return result
    }
    /// De Casteljau subdivision preserves the entire curve while adding a vertex.
    public mutating func insertVertex(after index: Int) throws {
        guard var p = points, p.indices.contains(index), p.count < 128 else { throw ProjectError.invalid("Select a path segment; maximum 128 vertices.") }
        let next = (index + 1) % p.count, a = p[index], b = p[next]
        let q0 = a.anchor.mixed(a.outgoing,0.5), q1 = a.outgoing.mixed(b.incoming,0.5), q2 = b.incoming.mixed(b.anchor,0.5)
        let r0 = q0.mixed(q1,0.5), r1 = q1.mixed(q2,0.5)
        p[index].outgoing = q0; p[next].incoming = q2
        p.insert(BezierVertex(r0.mixed(r1,0.5), incoming: r0, outgoing: r1), at: index + 1); points = p
    }
    func interpolated(to b: Self, progress t: Double) -> Self {
        var result = self
        func mix(_ a: Double, _ b: Double) -> Double { a + (b-a)*t }
        result.x = mix(x,b.x); result.y = mix(y,b.y); result.width = mix(width,b.width); result.height = mix(height,b.height); result.feather = mix(feather,b.feather)
        if let a = points, let bp = b.points {
            result.points = zip(a,bp).map { BezierVertex($0.anchor.mixed($1.anchor,t), incoming: $0.incoming.mixed($1.incoming,t), outgoing: $0.outgoing.mixed($1.outgoing,t)) }
        }
        return result // Inversion is discrete: hold until the next key.
    }
}
public struct MaskKeyframe: Codable, Equatable, Sendable {
    public var time: Double, value: ClipMask, easing: MotionEasing
    public init(time: Double, value: ClipMask, easing: MotionEasing = .linear) { self.time = time; self.value = value; self.easing = easing }
}
public struct MaskAnimation: Codable, Equatable, Sendable {
    public var keyframes: [MaskKeyframe], offset: Double
    public init(keyframes: [MaskKeyframe], offset: Double = 0) { self.keyframes = keyframes; self.offset = offset }
    public func validate() throws {
        guard offset.isFinite, abs(offset) <= 86400, (1...1024).contains(keyframes.count), let first = keyframes.first else { throw ProjectError.invalid("Invalid mask animation clock or key count (maximum 1024).") }
        var previous = -Double.infinity
        for key in keyframes {
            try key.value.validate()
            guard key.time.isFinite, abs(key.time) <= 86400, key.time - previous > 0.000001 else { throw ProjectError.invalid("Mask keys need distinct increasing finite times.") }
            guard key.value.shape == first.value.shape, key.value.points?.count == first.value.points?.count else { throw ProjectError.invalid("Animated masks need matching shapes and vertex counts. Bake the mask before changing topology.") }
            previous = key.time
        }
    }
    public func value(atLocalTime local: Double) -> ClipMask? {
        guard local.isFinite, let first = keyframes.first, let last = keyframes.last else { return nil }
        let time = local + offset
        if time <= first.time { return first.value }; if time >= last.time { return last.value }
        var low = 0, high = keyframes.count - 1
        while high - low > 1 { let mid = (low+high)/2; if keyframes[mid].time <= time { low = mid } else { high = mid } }
        let a = keyframes[low], b = keyframes[high]
        return a.value.interpolated(to: b.value, progress: a.easing.progress((time-a.time)/(b.time-a.time)))
    }
}
extension Clip {
    public func maskValue(atLocalTime time: Double) -> ClipMask? { maskAnimation?.value(atLocalTime: time) ?? mask }
    public func maskKeyTime(at time: Double, frameRate: Int) -> Double { (time * Double(frameRate)).rounded() / Double(frameRate) - start + (maskAnimation?.offset ?? 0) }
}
extension Edit {
    public static func maskKey(_ project: Project, sequenceId: String, clipId: String, at time: Double, value: ClipMask? = nil, easing: MotionEasing? = nil, remove: Bool = false) throws -> Project {
        try transact(project, sequenceId: sequenceId) { sequence in
            let i = try editableClip(sequence,clipId); var clip = sequence.videoClips[i]
            let keyTime = clip.maskKeyTime(at: time, frameRate: sequence.frameRate), local = keyTime - (clip.maskAnimation?.offset ?? 0)
            guard time.isFinite, local >= -0.00001, local < clip.duration - 0.00001, let pose = value ?? clip.maskValue(atLocalTime: local) else { throw ProjectError.invalid("Select a mask and place the playhead inside its clip.") }
            var animation = clip.maskAnimation ?? MaskAnimation(keyframes: [])
            let index = animation.keyframes.firstIndex { abs($0.time-keyTime) < 0.00001 }
            if remove {
                guard let index else { throw ProjectError.invalid("No mask key at the playhead.") }
                animation.keyframes.remove(at:index); clip.mask = pose
            } else {
                let key = MaskKeyframe(time:keyTime,value:pose,easing:easing ?? index.map { animation.keyframes[$0].easing } ?? .linear)
                if let index { animation.keyframes[index] = key } else { animation.keyframes.append(key); animation.keyframes.sort { $0.time < $1.time } }
            }
            clip.maskAnimation = animation.keyframes.isEmpty ? nil : animation; sequence.videoClips[i] = clip
        }
    }
    public static func bakeMask(_ project: Project, sequenceId: String, clipId: String, at time: Double) throws -> Project {
        guard time.isFinite else { throw ProjectError.invalid("Invalid mask time.") }
        return try transact(project, sequenceId: sequenceId) { s in
            let i = try editableClip(s,clipId); s.videoClips[i].mask = s.videoClips[i].maskValue(atLocalTime: time-s.videoClips[i].start); s.videoClips[i].maskAnimation = nil
        }
    }
}
