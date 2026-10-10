import AVFoundation
import ScenePilotCore

extension NativeInstruction {
    /// AVFoundation otherwise schedules every source for the entire movie. Split
    /// at media boundaries; each instruction needs only its active decode set.
    /// Timing, z-order and matte scope are unchanged. Empty intervals render black.
    static func timeline(duration: CMTime, nodes: [NativeNode], nodeBudget: Int = 32_768, blendSpace: BlendSpace = .linear, look: NativeLook? = nil) -> [NativeInstruction] {
        let scale: CMTimeScale = 600_000
        let end = CMTimeConvertScale(duration, timescale: scale, method: .roundHalfAwayFromZero).value
        guard end > 0 else { return [] }
        var boundaries: Set<Int64> = [0, end]
        func collect(_ nodes: [NativeNode]) {
            for node in nodes {
                if node.layer.trackID != kCMPersistentTrackID_Invalid {
                    for time in [node.layer.range.start, node.layer.range.end] {
                        let tick = CMTimeConvertScale(time, timescale: scale, method: .roundHalfAwayFromZero).value
                        boundaries.insert(min(end, max(0, tick)))
                    }
                }
                collect(node.children)
            }
        }
        collect(nodes)
        func active(_ nodes: [NativeNode], at time: CMTime) -> [NativeNode] {
            nodes.compactMap { node in
                guard CMTimeRangeContainsTime(node.layer.range, time: time) else { return nil }
                let children = active(node.children, at: time)
                guard node.layer.trackID != kCMPersistentTrackID_Invalid || !children.isEmpty else { return nil }
                return NativeNode(id: node.id, layer: node.layer, children: children, matte: node.matte, matteOnly: node.matteOnly)
            }
        }
        let times = boundaries.sorted().map { CMTime(value: $0, timescale: scale) }
        var remaining = max(0, nodeBudget)
        func count(_ nodes: [NativeNode]) -> Int { nodes.reduce(0) { $0 + 1 + count($1.children) } }
        return zip(times, times.dropFirst()).map { start, end in
            let selected = active(nodes, at: start), cost = count(selected)
            let retainPruned = cost <= remaining
            if retainPruned { remaining -= cost }
            // Highly overlapping/deep graphs must not multiply retained scene
            // storage by interval count. Fall back to the shared original tree;
            // its existing time guards preserve the reduced decoder set.
            return NativeInstruction(timeRange: CMTimeRange(start: start, end: end),
                                     nodes: retainPruned ? selected : nodes,
                                     sourceTrackIDs: selected.flatMap(\.trackIDs), blendSpace: blendSpace, look: look)
        }
    }
}
