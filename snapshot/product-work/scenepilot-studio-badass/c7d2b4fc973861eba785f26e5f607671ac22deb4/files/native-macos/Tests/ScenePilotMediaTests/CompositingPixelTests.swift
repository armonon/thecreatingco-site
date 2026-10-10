import XCTest
import AVFoundation
import CoreImage
import ScenePilotCore
@testable import ScenePilotMedia

final class CompositingPixelTests: XCTestCase {
    let bounds = CGRect(x: 0, y: 0, width: 64, height: 64)
    func node(_ id: String, track: Int32 = 1, opacity: Double = 1, mask: ClipMask? = nil, children: [NativeNode] = [], matte: ClipMatte? = nil, hidden: Bool = false, motion: ClipMotion? = nil) -> NativeNode {
        NativeNode(id: id, layer: NativeLayer(trackID: children.isEmpty ? track : kCMPersistentTrackID_Invalid, range: CMTimeRange(start: .zero, duration: CMTime(seconds: 2, preferredTimescale: 600)), baseTransform: .identity, placement: ClipTransform(), outputSize: bounds.size, motion: motion, motionLocalStart: 0, motionRate: 1, opacity: opacity, originalStart: 0, originalDuration: 2, fadeIn: 0, fadeOut: 0, exposure: 0, saturation: 1, blur: 0, mask: mask), children: children, matte: matte, matteOnly: hidden)
    }
    func pixels(_ nodes: [NativeNode], at time: Double = 0.5, sources: [Int32:CIImage] = [:]) throws -> [UInt8] {
        let image = try NativeSceneRenderer.render(nodes, time: CMTime(seconds: time, preferredTimescale: 600), bounds: bounds) { id in
            sources[id] ?? CIImage(color: .white).cropped(to: self.bounds)
        }
        let context = CIContext(options: [.workingColorSpace: CGColorSpace(name: CGColorSpace.linearSRGB)!])
        var bytes = [UInt8](repeating: 0, count: 64 * 64 * 4)
        bytes.withUnsafeMutableBytes { context.render(image, toBitmap: $0.baseAddress!, rowBytes: 64 * 4, bounds: bounds, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.linearSRGB)!) }
        return bytes
    }
    func alpha(_ bytes: [UInt8], _ x: Int, _ y: Int) -> Double { Double(bytes[(y * 64 + x) * 4 + 3]) / 255 }
    func testGroupOpacityIsAppliedOnceAfterOverlappingChildren() throws {
        let image = try pixels([node("group", opacity: 0.5, children: [node("a"),node("b", track: 2)])])
        XCTAssertEqual(alpha(image, 32, 32), 0.5, accuracy: 0.01, "Per-child opacity incorrectly produces 0.75 here")
        let nested = try pixels([node("outer", opacity: 0.5, children: [node("inner", opacity: 0.5, children: [node("a"),node("b")])])])
        XCTAssertEqual(alpha(nested, 32, 32), 0.25, accuracy: 0.01)
    }
    func testShapeMaskInversionFeatherAndAnimation() throws {
        var mask = ClipMask(shape: .ellipse); mask.width = 0.5; mask.height = 0.5
        let hard = try pixels([node("masked", mask: mask)])
        XCTAssertEqual(alpha(hard, 32, 32), 1, accuracy: 0.01); XCTAssertEqual(alpha(hard, 4, 4), 0, accuracy: 0.01)
        mask.inverted = true; let inverted = try pixels([node("masked", mask: mask)])
        for (x,y) in [(32,32),(4,4),(16,32)] { XCTAssertEqual(alpha(hard,x,y) + alpha(inverted,x,y), 1, accuracy: 0.01) }
        mask.inverted = false; mask.shape = .rectangle; mask.feather = 4
        let soft = try pixels([node("masked", mask: mask)])
        XCTAssertGreaterThan(alpha(soft,16,32), 0.2); XCTAssertLessThan(alpha(soft,16,32), 0.8)
        mask.feather = 0
        let motion = ClipMotion(keyframes: [MotionKeyframe(time: 0, value: MotionValue()),MotionKeyframe(time: 1, value: MotionValue(x: 0.5))])
        let shifted = try pixels([node("group", mask: mask, children: [node("child")], motion: motion)], at: 1)
        XCTAssertEqual(alpha(shifted,32,32), 0, accuracy: 0.01); XCTAssertEqual(alpha(shifted,60,32), 1, accuracy: 0.01)
    }
    func testAlphaMatteUsesActualCoverageAndProviderIsNotPainted() throws {
        var mask = ClipMask(shape: .rectangle); mask.width = 0.5; mask.height = 1; mask.x = 0.25
        let provider = node("matte", opacity: 0.5, mask: mask, hidden: true)
        let consumer = node("picture", matte: ClipMatte(sourceClipId: "matte"))
        let image = try pixels([provider,consumer])
        XCTAssertEqual(alpha(image,8,32), 0.5, accuracy: 0.01); XCTAssertEqual(alpha(image,48,32), 0, accuracy: 0.01)
        let inverted = try pixels([provider,node("picture", matte: ClipMatte(sourceClipId: "matte", inverted: true))])
        XCTAssertEqual(alpha(inverted,8,32), 0.5, accuracy: 0.01); XCTAssertEqual(alpha(inverted,48,32), 1, accuracy: 0.01)
    }
    func testLumaMatteUsesPerPixelLinearLuminanceAndAlpha() throws {
        let black = CIImage(color: .black).cropped(to: bounds)
        let stripes = CIImage(color: .white).cropped(to: CGRect(x: 0, y: 0, width: 32, height: 64)).composited(over: black)
        let provider = node("matte", track: 2, opacity: 0.5, hidden: true)
        let image = try pixels([provider,node("picture", matte: ClipMatte(sourceClipId: "matte", mode: .luma))], sources: [2:stripes])
        XCTAssertEqual(alpha(image,8,32), 0.5, accuracy: 0.01); XCTAssertEqual(alpha(image,48,32), 0, accuracy: 0.01)
        let red = CIImage(color: CIColor(red: 1, green: 0, blue: 0)).cropped(to: bounds)
        let colored = try pixels([node("matte", track: 2, hidden: true),node("picture", matte: ClipMatte(sourceClipId: "matte", mode: .luma))], sources: [2:red])
        XCTAssertEqual(alpha(colored,32,32), 0.2126, accuracy: 0.01)
    }
    func testMissingProviderIsTransparentAndInversionIsExplicit() throws {
        let normal = try pixels([node("picture", matte: ClipMatte(sourceClipId: "inactive"))])
        let inverted = try pixels([node("picture", matte: ClipMatte(sourceClipId: "inactive", inverted: true))])
        XCTAssertEqual(alpha(normal,32,32), 0); XCTAssertEqual(alpha(inverted,32,32), 1)
    }
    func testMatteChainAndGroupProviderShareTransparentPixels() throws {
        var mask = ClipMask(shape: .rectangle); mask.width = 0.5; mask.height = 1
        let group = node("group", opacity: 0.5, mask: mask, children: [node("a"),node("b")], hidden: true)
        let intermediary = node("middle", opacity: 0.5, matte: ClipMatte(sourceClipId: "group"), hidden: true)
        let actual = try pixels([group,intermediary,node("picture", matte: ClipMatte(sourceClipId: "middle"))])
        XCTAssertEqual(alpha(actual,32,32), 0.25, accuracy: 0.01); XCTAssertEqual(alpha(actual,2,32), 0)
    }
    func testSharedMatteIsEvaluatedOnceAndTrackOrderDoesNotChangeIt() throws {
        let provider = node("matte", track: 3, opacity: 0.5, hidden: true)
        let a = node("a", track: 1, matte: ClipMatte(sourceClipId: "matte"))
        let b = node("b", track: 2, matte: ClipMatte(sourceClipId: "matte"))
        var reads: [Int32:Int] = [:]
        _ = try NativeSceneRenderer.render([a,provider,b], time: CMTime(seconds: 0.5, preferredTimescale: 600), bounds: bounds) { id in
            reads[id, default: 0] += 1; return CIImage(color: .white).cropped(to: self.bounds)
        }
        XCTAssertEqual(reads[3], 1)
        let x = try pixels([a,provider,b]), y = try pixels([provider,a,b])
        XCTAssertEqual(x,y); XCTAssertEqual(alpha(x,32,32), 0.75, accuracy: 0.01)
    }
}
