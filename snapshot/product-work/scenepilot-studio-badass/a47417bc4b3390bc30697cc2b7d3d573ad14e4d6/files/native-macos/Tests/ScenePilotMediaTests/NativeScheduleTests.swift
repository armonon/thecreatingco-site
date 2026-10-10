import XCTest
import AVFoundation
import CoreImage
import ScenePilotCore
@testable import ScenePilotMedia

extension CompositingPixelTests {
    func timedNode(_ id: String, track: Int32, start: Double, duration: Double,
                   children: [NativeNode] = [], matte: ClipMatte? = nil, hidden: Bool = false) -> NativeNode {
        NativeNode(id: id, layer: NativeLayer(trackID: track,
            range: CMTimeRange(start: CMTime(seconds: start, preferredTimescale: 600_000), duration: CMTime(seconds: duration, preferredTimescale: 600_000)),
            baseTransform: .identity, placement: ClipTransform(), outputSize: bounds.size,
            motion: nil, motionLocalStart: 0, motionRate: 1, opacity: 0.8,
            originalStart: start, originalDuration: duration, fadeIn: 0, fadeOut: 0,
            exposure: 0, saturation: 1, blur: 0), children: children, matte: matte, matteOnly: hidden)
    }
    func testTemporalSchedulePreservesGroupsMattesAndBoundaryPixels() throws {
        let children = [timedNode("a",track:1,start:0,duration:1), timedNode("b",track:2,start:2,duration:1)]
        for inverted in [false,true] {
            let nodes = [timedNode("provider",track:3,start:0.5,duration:2,hidden:true),
                         timedNode("group",track:0,start:0,duration:3,children:children,matte:ClipMatte(sourceClipId:"provider",mode:.luma,inverted:inverted))]
            let schedule = NativeInstruction.timeline(duration:CMTime(seconds:3,preferredTimescale:600_000),nodes:nodes)
            XCTAssertEqual(schedule.map { $0.timeRange.start.seconds },[0,0.5,1,2,2.5])
            for time in [0,0.49,0.5,0.99,1,1.5,1.999,2,2.5,2.99] {
                let cm = CMTime(seconds:time,preferredTimescale:600_000)
                let item = try XCTUnwrap(schedule.first { CMTimeRangeContainsTime($0.timeRange,time:cm) })
                XCTAssertEqual(try pixels(nodes,at:time),try pixels(item.nodes,at:time),"Changed pixels at \(time), inverted=\(inverted)")
                XCTAssertLessThanOrEqual(item.requiredSourceTrackIDs!.count,2)
            }
            for (a,b) in zip(schedule,schedule.dropFirst()) { XCTAssertEqual(a.timeRange.end,b.timeRange.start) }
            XCTAssertEqual(schedule.first!.timeRange.start,.zero)
            XCTAssertEqual(schedule.last!.timeRange.end.seconds,3)
        }
    }
    func testSequentialClipsRequestOneDecoderAndGapsRequestNone() {
        let nodes = (0..<256).map { timedNode("shot-\($0)",track:Int32($0+1),start:Double($0)*2,duration:1) }
        let schedule = NativeInstruction.timeline(duration:CMTime(seconds:512,preferredTimescale:600_000),nodes:nodes)
        XCTAssertEqual(schedule.count,512)
        for (index,item) in schedule.enumerated() {
            XCTAssertEqual(item.requiredSourceTrackIDs?.count,index%2 == 0 ? 1 : 0)
            XCTAssertEqual(item.nodes.count,index%2 == 0 ? 1 : 0)
        }
    }
    func testScheduleStorageBudgetKeepsDecodeSavingsAndExactPixels() throws {
        let nodes = (0..<12).map { timedNode("shot-\($0)",track:Int32($0+1),start:Double($0),duration:1) }
        let schedule = NativeInstruction.timeline(duration:CMTime(seconds:12,preferredTimescale:600_000),nodes:nodes,nodeBudget:1)
        XCTAssertEqual(schedule[0].nodes.count,1)
        XCTAssertEqual(schedule[1].nodes.count,12,"Budget overflow must share the original graph")
        for (index,item) in schedule.enumerated() {
            XCTAssertEqual(item.requiredSourceTrackIDs?.count,1)
            var reads:[Int32] = []
            _ = try NativeSceneRenderer.render(item.nodes,time:CMTime(seconds:Double(index)+0.5,preferredTimescale:600_000),bounds:bounds) { id in
                reads.append(id); return CIImage(color:.white).cropped(to:self.bounds)
            }
            XCTAssertEqual(reads,[Int32(index+1)],"Fallback must not request discarded decoders")
            XCTAssertEqual(try pixels(nodes,at:Double(index)+0.5),try pixels(item.nodes,at:Double(index)+0.5))
        }
    }
    func testScheduleCPUSetupBenchmark() throws {
        let nodes = (0..<128).map { timedNode("shot-\($0)",track:Int32($0+1),start:Double($0),duration:1) }
        let schedule = NativeInstruction.timeline(duration:CMTime(seconds:128,preferredTimescale:600_000),nodes:nodes)
        let time = CMTime(seconds:64.5,preferredTimescale:600_000)
        let active = schedule[64].nodes
        let source = CIImage(color:.white).cropped(to:bounds)
        func measure(_ graph:[NativeNode]) throws -> Double {
            var samples:[Double] = []
            for _ in 0..<31 {
                let start = ProcessInfo.processInfo.systemUptime
                try autoreleasepool { _ = try NativeSceneRenderer.render(graph,time:time,bounds:bounds) { _ in source } }
                samples.append((ProcessInfo.processInfo.systemUptime-start)*1000)
            }
            return samples.sorted()[15]
        }
        let baseline = try measure(nodes), optimized = try measure(active)
        print("NATIVE_SCHEDULE_BENCHMARK \(baseline) ms baseline / \(optimized) ms optimized median CI-graph setup; 128 -> 1 requested tracks")
        // Timing is recorded, not a machine-dependent pass threshold. This does
        // not measure GPU rendering, decoder throughput or sustained playback FPS.
        XCTAssertEqual(try pixels(nodes,at:64.5),try pixels(active,at:64.5))
    }
}

extension MediaTests {
    @MainActor func testScheduledNativeDecodeAndExportAcrossCutsAndEmptyIntervals() async throws {
        guard let outputPath = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_OUTPUT"] else { throw XCTSkip("Supply generated native fixtures.") }
        var p = try motionFixtureBase()
        let track = p.sequences[0].tracks[0].id
        let asset = p.media[0]
        p.sequences[0].videoClips = (0..<3).map { Clip(assetId:asset.id,trackId:track,start:Double($0),duration:0.5) }
        let built = try await NativeMedia.build(p,sequenceId:p.mainSequenceId)
        let instructions = try XCTUnwrap(built.videoComposition?.instructions as? [NativeInstruction])
        XCTAssertEqual(instructions.map { $0.requiredSourceTrackIDs!.count },[1,0,1,0,1])
        let preview = AVAssetImageGenerator(asset:built.composition); preview.videoComposition = built.videoComposition
        let output = URL(fileURLWithPath:outputPath).deletingLastPathComponent().appendingPathComponent("scheduled-master.mp4")
        try await NativeExporter().export(built,to:output)
        let decoded = AVAssetImageGenerator(asset:AVURLAsset(url:output))
        for time in [0.2,0.5,0.7,1,1.2,1.5,1.7,2,2.2] {
            let frame = try pixels(preview,at:time)
            XCTAssertLessThan(pixelError(frame,try pixels(decoded,at:time)),8)
            if time == 0.5 || time == 0.7 || time == 1.5 || time == 1.7 {
                XCTAssertLessThan(frame.enumerated().filter { $0.offset%4 != 3 }.map { Int($0.element) }.max() ?? 255,5)
            } else { XCTAssertGreaterThan(frame[0],100) }
        }
    }
    private func motionFixtureBase() throws -> Project {
        guard let path = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_MEDIA"] else { throw XCTSkip("Supply generated fixture.") }
        var p = Project(); p.media = [Media(path:path,duration:3,hasVideo:true,hasAudio:true)]
        p.sequences[0].width = 640; p.sequences[0].height = 360; return p
    }
}
