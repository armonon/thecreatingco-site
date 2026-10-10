import XCTest
import AVFoundation
@testable import ScenePilotMedia
import ScenePilotCore

final class ObjectIsolationMediaTests: XCTestCase {
    @MainActor func testRealCoreMLAlphaSidecarAndNativeComposition() async throws {
        let env = ProcessInfo.processInfo.environment
        guard let root = env["SCENEPILOT_ISOLATION_QA_ROOT"] else { throw XCTSkip("Set SCENEPILOT_ISOLATION_QA_ROOT for local model integration test") }
        let sourceURL = URL(fileURLWithPath: root + "/outputs/release-today/media/native-people.mp4")
        let source = try await NativeMedia.inspect(sourceURL)
        let output = URL(fileURLWithPath: root + "/outputs/native-macos/isolation-" + UUID().uuidString + ".mov")
        let job = NativeObjectIsolation()
        let matte = try await job.bake(path: source.path, start: 0, duration: 0.1, frameRate: 30, prompts: [IsolationPrompt(x:0.5,y:0.5)],
            executable: URL(fileURLWithPath: root + "/electron/native-tools/scenepilot-vision-roto"), models: URL(fileURLWithPath: root + "/electron/native-models/sam2-tiny"), destination: output) { _ in }
        XCTAssertTrue(matte.hasVideo); XCTAssertFalse(matte.hasAudio); XCTAssertEqual(matte.duration,0.1,accuracy:0.002)
        let frame = try NativeObjectIsolation.firstFrame(path: matte.path, at: 0)
        var pixels = [UInt8](repeating: 0, count: frame.width * frame.height * 4)
        let context = CGContext(data: &pixels, width: frame.width, height: frame.height, bitsPerComponent: 8, bytesPerRow: frame.width*4, space:CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        context.draw(frame,in:CGRect(x:0,y:0,width:frame.width,height:frame.height))
        let values = stride(from:3,to:pixels.count,by:4).map { pixels[$0] }
        XCTAssertLessThan(values.min()!,20, "Encoded sidecar must retain transparent background")
        XCTAssertGreaterThan(values.max()!,200,"Encoded sidecar must retain selected object")
        var p = Project(); p.sequences[0].width = 640; p.sequences[0].height = 360; p.media = [source]
        let clip = Clip(assetId:source.id,trackId:p.sequences[0].tracks[0].id,start:0,duration:0.1)
        p.sequences[0].videoClips = [clip]
        let isolated = try Edit.isolate(p,sequenceId:p.mainSequenceId,clipId:clip.id,matte:matte)
        let built = try await NativeMedia.build(isolated,sequenceId:p.mainSequenceId)
        XCTAssertEqual(built.duration,0.1,accuracy:0.002)
        try await NativeExporter().export(built,to:output.deletingPathExtension().appendingPathExtension("mp4"))
        try ProjectStore.save(isolated,to:output.deletingPathExtension().appendingPathExtension("scenepilot-native.json"))
        XCTAssertEqual(try ProjectStore.load(output.deletingPathExtension().appendingPathExtension("scenepilot-native.json")),isolated)
    }
    func testCanceledAndInvalidJobsNeverCreateDestination() async throws {
        let job = NativeObjectIsolation(); job.cancel()
        let path = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".mov")
        do {
            _ = try await job.bake(path:"/missing.mov",start:0,duration:1,frameRate:30,prompts:[IsolationPrompt(x:0.5,y:0.5)],executable:path,models:path,destination:path) { _ in }
            XCTFail("Expected cancellation")
        } catch is CancellationError {} catch { XCTFail("Unexpected \(error)") }
        XCTAssertFalse(FileManager.default.fileExists(atPath:path.path))
    }
}
