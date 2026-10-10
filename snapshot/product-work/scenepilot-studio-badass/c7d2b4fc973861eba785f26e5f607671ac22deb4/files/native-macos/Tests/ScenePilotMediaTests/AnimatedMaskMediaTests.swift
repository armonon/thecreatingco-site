import XCTest
import AVFoundation
import CoreImage
import ScenePilotCore
@testable import ScenePilotMedia

extension MediaTests {
    func animatedMaskFixture() async throws -> Project {
        var p = try await compositingFixture()
        p.sequences[0].videoClips.removeFirst()
        var group = p.sequences[0].videoClips[0]; group.matte = nil; group.motion = nil; group.gain = 1; group.opacity = 1
        group.mask = ClipMask(shape:.ellipse).convertedToBezier()
        var end = group.mask!; end.width = 0.35; end.x = 0.7; end.feather = 15
        end.points?[0].anchor.y = 0.3; end.points?[0].outgoing.y = 0.3
        group.maskAnimation = MaskAnimation(keyframes:[MaskKeyframe(time:0,value:group.mask!),MaskKeyframe(time:1.5,value:end,easing:.smooth)])
        group.fadeIn = 1; group.fadeOut = 0.5; p.sequences[0].videoClips = [group]
        p.sequences[1].videoClips.removeLast()
        p.sequences[1].videoClips[0].fadeIn = 1.2; p.sequences[1].videoClips[0].fadeOut = 0.7
        return p
    }
    func pcm(_ asset: AVAsset, mix: AVAudioMix? = nil) async throws -> [Float] {
        let tracks = try await asset.loadTracks(withMediaType:.audio)
        let reader = try AVAssetReader(asset:asset)
        let output = AVAssetReaderAudioMixOutput(audioTracks:tracks,audioSettings:[AVFormatIDKey:kAudioFormatLinearPCM,AVSampleRateKey:48000,AVNumberOfChannelsKey:1,AVLinearPCMBitDepthKey:32,AVLinearPCMIsFloatKey:true,AVLinearPCMIsNonInterleaved:false])
        output.audioMix = mix
        guard reader.canAdd(output) else { throw ProjectError.invalid("Cannot decode test PCM.") }; reader.add(output)
        guard reader.startReading() else { throw reader.error ?? ProjectError.invalid("PCM start failed.") }
        var result: [Float] = []
        while let buffer = output.copyNextSampleBuffer() {
            guard let block = CMSampleBufferGetDataBuffer(buffer) else { throw ProjectError.invalid("No PCM buffer.") }
            let count = CMBlockBufferGetDataLength(block)/4
            var data = [Float](repeating:0,count:count)
            let status = data.withUnsafeMutableBytes { CMBlockBufferCopyDataBytes(block,atOffset:0,dataLength:count*4,destination:$0.baseAddress!) }
            guard status == noErr else { throw ProjectError.invalid("PCM copy failed.") }
            let offset = max(0,Int((CMSampleBufferGetPresentationTimeStamp(buffer).seconds*48000).rounded()))
            if result.count < offset+count { result.append(contentsOf:repeatElement(0,count:offset+count-result.count)) }
            result.replaceSubrange(offset..<offset+count,with:data)
        }
        guard reader.status == .completed else { throw reader.error ?? ProjectError.invalid("PCM decode incomplete.") }
        return result
    }
    @MainActor func testBezierShapeAnimationAndGroupFadesMatchMP4PixelsAndPCM() async throws {
        guard let outputPath = ProcessInfo.processInfo.environment["SCENEPILOT_NATIVE_QA_OUTPUT"] else { throw XCTSkip("Supply generated native fixtures.") }
        let p = try await animatedMaskFixture()
        let built = try await NativeMedia.build(p,sequenceId:p.mainSequenceId)
        let preview = AVAssetImageGenerator(asset:built.composition); preview.videoComposition = built.videoComposition
        let split = try Edit.split(p,sequenceId:p.mainSequenceId,clipId:"group",at:0.5)
        let splitBuilt = try await NativeMedia.build(split,sequenceId:split.mainSequenceId)
        let splitFrames = AVAssetImageGenerator(asset:splitBuilt.composition); splitFrames.videoComposition = splitBuilt.videoComposition
        for time in [0.2,0.6,1.0,1.4,1.8] {
            var frozen = p; frozen.sequences[0].videoClips[0].maskAnimation = nil
            frozen.sequences[0].videoClips[0].mask = p.sequences[0].videoClips[0].maskValue(atLocalTime:time)
            let frozenFrames = try await motionGenerator(frozen)
            let expected = try pixels(preview,at:time)
            XCTAssertLessThan(pixelError(expected,try pixels(frozenFrames,at:time)),1)
            XCTAssertLessThan(pixelError(expected,try pixels(splitFrames,at:time)),1)
        }
        let audio = try await pcm(built.composition,mix:built.audioMix)
        let splitAudio = try await pcm(splitBuilt.composition,mix:splitBuilt.audioMix)
        XCTAssertEqual(audio.count,splitAudio.count)
        let splitError = zip(audio,splitAudio).map { abs(Double($0)-Double($1)) }.max() ?? 1
        if splitError >= 0.001 {
            for t in [0.2,0.49,0.5,0.51,0.6,1.0,1.5] {
                let a = Int(t*48000), b = a+480
                let x = audio[a..<b].map(Double.init), y = splitAudio[a..<b].map(Double.init)
                print("split-qa",t,"peak",zip(x,y).map { abs($0-$1) }.max()!,"rms",sqrt(x.reduce(0) { $0+$1*$1 }/480),sqrt(y.reduce(0) { $0+$1*$1 }/480))
            }
        }
        XCTAssertLessThan(splitError,0.001,"Splitting a group restarted an audio fade")
        var raw = p
        for s in raw.sequences.indices { for c in raw.sequences[s].videoClips.indices { raw.sequences[s].videoClips[c].fadeIn = 0; raw.sequences[s].videoClips[c].fadeOut = 0 } }
        let rawBuilt = try await NativeMedia.build(raw,sequenceId:raw.mainSequenceId)
        let baseline = try await pcm(rawBuilt.composition,mix:rawBuilt.audioMix)
        let envelopes = [AudioFadeEnvelope(start:0,duration:2,fadeIn:1,fadeOut:0.5),AudioFadeEnvelope(start:0,duration:2,fadeIn:1.2,fadeOut:0.7)]
        var maxError = 0.0
        for i in 0..<min(audio.count,baseline.count) {
            let gain = envelopes.reduce(1.0) { $0*$1.value(at:Double(i)/48000) }
            maxError = max(maxError,abs(Double(audio[i])-Double(baseline[i])*gain))
        }
        XCTAssertLessThan(maxError,0.001,"Native decoded PCM disagrees with parent × child envelopes")
        let url = URL(fileURLWithPath:outputPath).deletingLastPathComponent().appendingPathComponent("animated-mask-fades-master.mp4")
        try await NativeExporter().export(built,to:url)
        let encoded = AVURLAsset(url:url), frames = AVAssetImageGenerator(asset:encoded)
        for time in [0.2,0.6,1.0,1.4,1.8] { XCTAssertLessThan(pixelError(try pixels(preview,at:time),try pixels(frames,at:time)),8) }
        let exportedAudio = try await pcm(encoded)
        for start in [0.1,0.4,0.8,1.2,1.6,1.9] {
            let a = Int(start*48000), b = a+480
            func rms(_ samples:[Float]) -> Double { sqrt(samples[a..<min(b,samples.count)].reduce(0) { $0+Double($1*$1) }/Double(b-a)) }
            XCTAssertEqual(rms(audio),rms(exportedAudio),accuracy:0.003,"AAC fade mismatch at \(start)")
        }
    }
    func testBezierMaskIsNotItsBoundingBox() throws {
        var mask = ClipMask(shape:.ellipse).convertedToBezier(); mask.width = 1; mask.height = 1
        let image = try NativeSceneRenderer.maskImage(mask,bounds:CGRect(x:0,y:0,width:64,height:64))
        var data = [UInt8](repeating:0,count:64*64*4)
        let context = CIContext()
        data.withUnsafeMutableBytes { context.render(image,toBitmap:$0.baseAddress!,rowBytes:256,bounds:CGRect(x:0,y:0,width:64,height:64),format:.RGBA8,colorSpace:CGColorSpaceCreateDeviceRGB()) }
        XCTAssertLessThan(data[(2*64+2)*4],10); XCTAssertGreaterThan(data[(32*64+32)*4],245)
    }
    func testStaticBezierCacheReusesAndEvictsWithinBudget() throws {
        let cache = NativeMaskCache(budget:5000), bounds = CGRect(x:0,y:0,width:64,height:64)
        var mask = ClipMask(shape:.ellipse).convertedToBezier()
        _ = try cache.image(mask,bounds:bounds); _ = try cache.image(mask,bounds:bounds)
        XCTAssertEqual(cache.rasterizations,1)
        mask.x = 0.3; _ = try cache.image(mask,bounds:bounds)
        XCTAssertEqual(cache.rasterizations,2); XCTAssertLessThanOrEqual(cache.byteCount,5000)
        mask.x = 0.5; _ = try cache.image(mask,bounds:bounds); XCTAssertEqual(cache.rasterizations,3)
    }
    func testReusedAnimatedMaskAtDifferentRates() async throws {
        var p = try await animatedMaskFixture(); var child = p.sequences[0]; child.id = "animated-mask-child"; p.sequences.append(child)
        let track = p.sequences[0].tracks[0].id
        var fast = Clip(compositionId:child.id,trackId:track,start:0,duration:1); fast.rate = 2
        var slow = Clip(compositionId:child.id,trackId:track,start:1,duration:3); slow.sourceStart = 0.5; slow.rate = 0.5
        p.sequences[0].videoClips = [fast,slow]
        let a = try await motionGenerator(p), b = try await motionGenerator(p,sequenceId:child.id)
        for (time,source) in [(0.3,0.6),(0.6,1.2),(1.4,0.7),(2.2,1.1),(3.4,1.7)] { XCTAssertLessThan(pixelError(try pixels(a,at:time),try pixels(b,at:source)),2) }
    }
}
