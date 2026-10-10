import AVFoundation
import CoreImage
import Metal
import ScenePilotCore

public struct NativeLayer: Sendable {
    let trackID: CMPersistentTrackID
    let range: CMTimeRange
    let baseTransform: CGAffineTransform
    let placement: ClipTransform
    let outputSize: CGSize
    let motion: ClipMotion?
    let motionLocalStart: Double
    let motionRate: Double
    let opacity: Double
    let originalStart: Double
    let originalDuration: Double
    let fadeIn: Double
    let fadeOut: Double
    let exposure: Double
    let saturation: Double
    let blur: Double
    var mask: ClipMask? = nil
    var maskAnimation: MaskAnimation? = nil
    /// The sequence's beat punch, when this clip's track follows the beat.
    var beat: LayerBeat? = nil
    var transition: CutTransition? = nil

    func picture(at time: Double) -> (transform: CGAffineTransform, opacity: Double) {
        let local = motionLocalStart + (time - range.start.seconds) * motionRate
        let value = motion?.value(atLocalTime: local)
        let t = value?.applying(to: placement) ?? placement
        // Punch and transition zoom about the frame centre, like the clip's own scale.
        let scale = t.scale * (beat.map { $0.punch.scale(at: time, rhythm: $0.rhythm) } ?? 1) * (transition?.scale(elapsed: local) ?? 1)
        let cx = outputSize.width / 2, cy = outputSize.height / 2
        let transform = CGAffineTransform.identity
            .concatenating(CGAffineTransform(translationX: -cx, y: -cy))
            .concatenating(CGAffineTransform(scaleX: scale * (t.flipH ? -1 : 1), y: scale * (t.flipV ? -1 : 1)))
            .concatenating(CGAffineTransform(rotationAngle: -t.rotation * .pi / 180))
            .concatenating(CGAffineTransform(translationX: cx + t.x * outputSize.width, y: cy - t.y * outputSize.height))
        let elapsed = time - originalStart
        let incoming = fadeIn > 0 ? min(1, max(0, elapsed / fadeIn)) : 1
        let outgoing = fadeOut > 0 ? min(1, max(0, (originalDuration - elapsed) / fadeOut)) : 1
        return (transform, (value?.opacity ?? opacity) * incoming * outgoing)
    }
}

struct LayerBeat: Sendable {
    let rhythm: SequenceRhythm
    let punch: BeatPunch
}

/// The look of the sequence being played, with the rhythm that drives its pulse.
struct NativeLook: Sendable {
    let look: SequenceLook
    let rhythm: SequenceRhythm?
}

struct NativeNode: Sendable {
    let id: String
    let layer: NativeLayer
    let children: [NativeNode]
    let matte: ClipMatte?
    let matteOnly: Bool
    var trackIDs: [CMPersistentTrackID] {
        (layer.trackID == kCMPersistentTrackID_Invalid ? [] : [layer.trackID]) + children.flatMap(\.trackIDs)
    }
}

/// Transparent intermediate groups are shared by preview and export, never flattened
/// onto black until the root. A frame-local sibling cache also shares matte providers.
enum NativeSceneRenderer {
    static func maskImage(_ mask: ClipMask, bounds: CGRect) throws -> CIImage {
        let width = mask.width * bounds.width, height = mask.height * bounds.height
        let cx = mask.x * bounds.width, cy = (1 - mask.y) * bounds.height
        let black = CIImage(color: .black)
        var image: CIImage
        if mask.shape == .bezier {
            image = try NativeMaskPath.image(mask, bounds: bounds)
        } else if mask.shape == .ellipse {
            image = CIFilter(name: "CIRadialGradient", parameters: ["inputCenter": CIVector(x: 0, y: 0), "inputRadius0": 1.0, "inputRadius1": 1.002,
                "inputColor0": CIColor.white, "inputColor1": CIColor.black])!.outputImage!
                .transformed(by: CGAffineTransform(scaleX: width / 2, y: height / 2).concatenating(CGAffineTransform(translationX: cx, y: cy)))
        } else {
            image = CIImage(color: .white).cropped(to: CGRect(x: cx - width / 2, y: cy - height / 2, width: width, height: height)).composited(over: black)
        }
        // Extend the mask domain before blurring, so off-canvas edges feather correctly.
        if mask.feather > 0 { image = image.applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: mask.feather]) }
        image = image.cropped(to: bounds)
        if mask.inverted { image = image.applyingFilter("CIColorInvert") }
        return image
    }
    static func render(_ nodes: [NativeNode], time: CMTime, bounds: CGRect,
                       maskSource: ((ClipMask, CGRect) throws -> CIImage)? = nil,
                       source: (CMPersistentTrackID) throws -> CIImage) throws -> CIImage {
        let clear = CIImage(color: .clear).cropped(to: bounds)
        let byID = Dictionary(uniqueKeysWithValues: nodes.map { ($0.id, $0) })
        var cache: [String: CIImage] = [:]
        func picture(_ node: NativeNode) throws -> CIImage {
            if let cached = cache[node.id] { return cached }
            let layer = node.layer
            guard CMTimeRangeContainsTime(layer.range, time: time) else { return clear }
            var image = layer.trackID == kCMPersistentTrackID_Invalid
                ? try render(node.children, time: time, bounds: bounds, maskSource: maskSource, source: source)
                : try source(layer.trackID).transformed(by: layer.baseTransform)
            if let mask = layer.maskAnimation?.value(atLocalTime: layer.motionLocalStart + (time.seconds-layer.range.start.seconds)*layer.motionRate) ?? layer.mask {
                let coverage = try maskSource?(mask,bounds) ?? maskImage(mask,bounds:bounds)
                image = image.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: clear, kCIInputMaskImageKey: coverage])
            }
            let pose = layer.picture(at: time.seconds)
            image = image.transformed(by: pose.transform)
            if layer.exposure != 0 { image = image.applyingFilter("CIExposureAdjust", parameters: [kCIInputEVKey: layer.exposure]) }
            if layer.saturation != 1 { image = image.applyingFilter("CIColorControls", parameters: [kCIInputSaturationKey: layer.saturation]) }
            if layer.blur > 0 { image = image.clampedToExtent().applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: layer.blur]).cropped(to: bounds) }
            image = image.applyingFilter("CIColorMatrix", parameters: ["inputAVector": CIVector(x: 0, y: 0, z: 0, w: pose.opacity)]).cropped(to: bounds)
            if let matte = node.matte {
                let provider = try byID[matte.sourceClipId].map { try picture($0) } ?? clear
                // Composite onto opaque black for luma: transparency must contribute zero,
                // not the provider's unassociated RGB. Luminance is linear Rec.709.
                let weights = matte.mode == .alpha ? CIVector(x: 0, y: 0, z: 0, w: 1) : CIVector(x: 0.2126, y: 0.7152, z: 0.0722, w: 0)
                let input = matte.mode == .alpha ? provider : provider.composited(over: CIImage(color: .black).cropped(to: bounds))
                var coverage = input.applyingFilter("CIColorMatrix", parameters: ["inputRVector": weights, "inputGVector": weights, "inputBVector": weights,
                    "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0), "inputBiasVector": CIVector(x: 0, y: 0, z: 0, w: 1)])
                    .applyingFilter("CIColorClamp")
                if matte.inverted { coverage = coverage.applyingFilter("CIColorInvert") }
                image = image.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: clear, kCIInputMaskImageKey: coverage])
            }
            cache[node.id] = image; return image
        }
        var frame = clear
        for node in nodes.reversed() where !node.matteOnly {
            frame = try picture(node).composited(over: frame).cropped(to: bounds)
        }
        return frame
    }
}

// Immutable NSNumber track IDs bridge an Objective-C protocol across render queues.
final class NativeInstruction: NSObject, AVVideoCompositionInstructionProtocol, @unchecked Sendable {
    let timeRange: CMTimeRange
    let enablePostProcessing = false
    let containsTweening = true
    let requiredSourceTrackIDs: [NSValue]?
    let passthroughTrackID = kCMPersistentTrackID_Invalid
    let nodes: [NativeNode]
    let blendSpace: BlendSpace
    let look: NativeLook?
    convenience init(duration: CMTime, nodes: [NativeNode], blendSpace: BlendSpace = .linear, look: NativeLook? = nil) {
        self.init(timeRange: CMTimeRange(start: .zero, duration: duration), nodes: nodes, blendSpace: blendSpace, look: look)
    }
    init(timeRange: CMTimeRange, nodes: [NativeNode], sourceTrackIDs: [CMPersistentTrackID]? = nil, blendSpace: BlendSpace = .linear, look: NativeLook? = nil) {
        self.timeRange = timeRange; self.nodes = nodes; self.blendSpace = blendSpace; self.look = look
        self.requiredSourceTrackIDs = Array(Set(sourceTrackIDs ?? nodes.flatMap(\.trackIDs))).sorted().map { NSNumber(value: $0) }
    }
}

/// One native pixel implementation is used by AVPlayer and AVAssetExportSession.
/// Core Image renders on Metal when available. No browser, canvas, or JS fallback.
public final class NativeCompositor: NSObject, AVVideoCompositing {
    public var sourcePixelBufferAttributes: [String: any Sendable]? { [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA] }
    public var requiredPixelBufferAttributesForRenderContext: [String: any Sendable] { [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferMetalCompatibilityKey as String: true] }
    private let queue = DispatchQueue(label: "studio.scenepilot.native.compositor")
    /// The working color space is where every blend and filter happens. Linear light
    /// is the native default; the gamma context blends encoded sRGB like a canvas.
    private let contexts: [BlendSpace: CIContext]
    private let maskCache = NativeMaskCache()
    private let cancellationLock = NSLock()
    private var generation = 0
    private func currentGeneration() -> Int { cancellationLock.lock(); defer { cancellationLock.unlock() }; return generation }
    public override init() {
        let device = MTLCreateSystemDefaultDevice()
        func make(_ space: CFString) -> CIContext {
            let options: [CIContextOption: Any] = [.workingColorSpace: CGColorSpace(name: space)!, .cacheIntermediates: false]
            return device.map { CIContext(mtlDevice: $0, options: options) } ?? CIContext(options: options)
        }
        contexts = [.linear: make(CGColorSpace.linearSRGB), .gamma: make(CGColorSpace.sRGB)]
        super.init()
    }
    public func renderContextChanged(_ newRenderContext: AVVideoCompositionRenderContext) {}
    public func startRequest(_ request: AVAsynchronousVideoCompositionRequest) {
        let requestedGeneration = currentGeneration()
        queue.async { [self] in
            autoreleasepool {
                guard requestedGeneration == currentGeneration() else { request.finishCancelledRequest(); return }
                guard let instruction = request.videoCompositionInstruction as? NativeInstruction,
                      let output = request.renderContext.newPixelBuffer() else {
                    request.finish(with: NSError(domain: "ScenePilotNative", code: 1, userInfo: [NSLocalizedDescriptionKey: "Native compositor could not allocate an output frame."])); return
                }
                let size = request.renderContext.size
                let bounds = CGRect(origin: .zero, size: size)
                do {
                    var frame = try NativeSceneRenderer.render(instruction.nodes, time: request.compositionTime, bounds: bounds, maskSource: { try self.maskCache.image($0,bounds:$1) }) { id in
                        guard let buffer = request.sourceFrame(byTrackID: id) else {
                            throw ProjectError.invalid("A required source frame is unavailable at \(request.compositionTime.seconds)s. Export stopped rather than substituting black.")
                        }
                        return CIImage(cvPixelBuffer: buffer)
                    }.composited(over: CIImage(color: .black).cropped(to: bounds))
                    if let look = instruction.look {
                        frame = NativeLookRenderer.apply(frame, look: look, time: request.compositionTime.seconds, bounds: bounds, encoded: instruction.blendSpace == .gamma)
                    }
                    contexts[instruction.blendSpace]!.render(frame, to: output, bounds: bounds, colorSpace: CGColorSpace(name: CGColorSpace.sRGB))
                } catch { request.finish(with: error); return }
                guard requestedGeneration == currentGeneration() else { request.finishCancelledRequest(); return }
                request.finish(withComposedVideoFrame: output)
            }
        }
    }
    public func cancelAllPendingVideoCompositionRequests() {
        cancellationLock.lock(); generation &+= 1; cancellationLock.unlock()
        queue.sync {} // Drain old requests; each completes or acknowledges cancellation.
    }
}
