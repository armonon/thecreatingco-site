import Foundation
import Vision
import CoreML
import CoreGraphics
import CoreVideo

let errorDomain = "ScenePilotRoto"
let modelLock = NSLock()
var loadedModels: [String: MLModel] = [:]

struct NeuralAnchor {
    let embedding: MLMultiArray
    let foregroundPrototype: [Double]
    let backgroundPrototype: [Double]
    let alpha: Data
    let width: Int
    let height: Int
    let frameIndex: Int
    let centroidX: Double
    let centroidY: Double
    let area: Double
    let protected: Bool
}

struct NeuralMemory {
    let anchors: [NeuralAnchor]
    let frames: Int
}

var sessionMemories: [String: NeuralMemory] = [:]
var sessionOrder: [String] = []
var processedRequests = 0

func makeError(_ code: Int, _ message: String) -> NSError {
    NSError(domain: errorDomain, code: code, userInfo: [NSLocalizedDescriptionKey: message])
}

func fail(_ message: String, code: Int32 = 1) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(code)
}

if CommandLine.arguments.contains("--version") {
    print("scenepilot-vision-roto/3")
    exit(0)
}

guard #available(macOS 13.0, *) else { fail("Native roto requires macOS 13 or newer.") }

func integer(_ value: Any?) -> Int? {
    if let number = value as? NSNumber { return number.intValue }
    return value as? Int
}

func bool(_ value: Any?) -> Bool {
    (value as? NSNumber)?.boolValue ?? (value as? Bool ?? false)
}

func number(_ array: MLMultiArray, _ indexes: [Int]) -> Double {
    // Core ML tensors expose strided storage. Avoid allocating an NSNumber index
    // array for every pixel/channel in memory attention and matting loops.
    let strides = array.strides
    guard indexes.count == strides.count else { return array[indexes.map { NSNumber(value: $0) }].doubleValue }
    var offset = 0
    for axis in indexes.indices { offset += indexes[axis] * strides[axis].intValue }
    switch array.dataType {
    case .float16: return Double(array.dataPointer.assumingMemoryBound(to: Float16.self)[offset])
    case .float32: return Double(array.dataPointer.assumingMemoryBound(to: Float.self)[offset])
    case .double: return array.dataPointer.assumingMemoryBound(to: Double.self)[offset]
    case .int32: return Double(array.dataPointer.assumingMemoryBound(to: Int32.self)[offset])
    default: return array[indexes.map { NSNumber(value: $0) }].doubleValue
    }
}

func setNumber(_ array: MLMultiArray, _ indexes: [Int], _ value: Double) {
    array[indexes.map { NSNumber(value: $0) }] = NSNumber(value: value)
}

func featureProvider(_ values: [String: MLFeatureValue]) throws -> MLDictionaryFeatureProvider {
    try MLDictionaryFeatureProvider(dictionary: values)
}

func cgImage(rgba: Data, width: Int, height: Int) throws -> CGImage {
    guard rgba.count == width * height * 4,
          let provider = CGDataProvider(data: rgba as CFData),
          let image = CGImage(
            width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue),
            provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent
          ) else { throw makeError(1, "Could not create the native image surface.") }
    return image
}

func imagePixelBuffer(_ image: CGImage, size: Int) throws -> CVPixelBuffer {
    var buffer: CVPixelBuffer?
    let attributes: [CFString: Any] = [kCVPixelBufferCGImageCompatibilityKey: true, kCVPixelBufferCGBitmapContextCompatibilityKey: true]
    guard CVPixelBufferCreate(kCFAllocatorDefault, size, size, kCVPixelFormatType_32ARGB, attributes as CFDictionary, &buffer) == kCVReturnSuccess,
          let pixelBuffer = buffer else { throw makeError(2, "Could not allocate the Core ML image surface.") }
    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }
    guard let context = CGContext(
        data: CVPixelBufferGetBaseAddress(pixelBuffer), width: size, height: size, bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer), space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
    ) else { throw makeError(3, "Could not draw the Core ML image surface.") }
    context.interpolationQuality = .high
    context.draw(image, in: CGRect(x: 0, y: 0, width: size, height: size))
    return pixelBuffer
}

func resizeOneChannel(_ pixelBuffer: CVPixelBuffer, toWidth width: Int, height: Int) -> Data {
    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(pixelBuffer) else { return Data(count: width * height) }
    let sourceWidth = CVPixelBufferGetWidth(pixelBuffer), sourceHeight = CVPixelBufferGetHeight(pixelBuffer)
    let stride = CVPixelBufferGetBytesPerRow(pixelBuffer)
    var alpha = Data(count: width * height)
    alpha.withUnsafeMutableBytes { destination in
        guard let target = destination.baseAddress?.assumingMemoryBound(to: UInt8.self) else { return }
        let source = base.assumingMemoryBound(to: UInt8.self)
        for y in 0..<height {
            let sy = min(sourceHeight - 1, Int((Double(y) + 0.5) * Double(sourceHeight) / Double(height)))
            for x in 0..<width {
                let sx = min(sourceWidth - 1, Int((Double(x) + 0.5) * Double(sourceWidth) / Double(width)))
                target[y * width + x] = source[sy * stride + sx]
            }
        }
    }
    return alpha
}

func personAlpha(image: CGImage, width: Int, height: Int) throws -> Data {
    let segmentation = VNGeneratePersonSegmentationRequest()
    segmentation.qualityLevel = .accurate
    segmentation.outputPixelFormat = kCVPixelFormatType_OneComponent8
    try VNImageRequestHandler(cgImage: image, orientation: .up).perform([segmentation])
    guard let result = segmentation.results?.first else { throw makeError(4, "Apple Vision found no person.") }
    return resizeOneChannel(result.pixelBuffer, toWidth: width, height: height)
}

func cachedModel(packageURL: URL) throws -> MLModel {
    modelLock.lock()
    defer { modelLock.unlock() }
    if let model = loadedModels[packageURL.path] { return model }
    let fileManager = FileManager.default
    let cacheRoot = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("ScenePilot/CoreML", isDirectory: true)
    try fileManager.createDirectory(at: cacheRoot, withIntermediateDirectories: true)
    let cached = cacheRoot.appendingPathComponent(packageURL.deletingPathExtension().lastPathComponent + ".mlmodelc", isDirectory: true)
    if !fileManager.fileExists(atPath: cached.path) {
        let compiled = try MLModel.compileModel(at: packageURL)
        if fileManager.fileExists(atPath: cached.path) { try fileManager.removeItem(at: cached) }
        try fileManager.copyItem(at: compiled, to: cached)
    }
    let configuration = MLModelConfiguration()
    configuration.computeUnits = .all
    let model = try MLModel(contentsOf: cached, configuration: configuration)
    loadedModels[packageURL.path] = model
    return model
}

func bilinearMask(_ masks: MLMultiArray, candidate: Int, width: Int, height: Int) -> Data {
    var alpha = Data(count: width * height)
    alpha.withUnsafeMutableBytes { bytes in
        guard let output = bytes.baseAddress?.assumingMemoryBound(to: UInt8.self) else { return }
        for y in 0..<height {
            let fy = (Double(y) + 0.5) * 256 / Double(height) - 0.5
            let y0 = max(0, min(255, Int(floor(fy)))), y1 = min(255, y0 + 1), ty = fy - floor(fy)
            for x in 0..<width {
                let fx = (Double(x) + 0.5) * 256 / Double(width) - 0.5
                let x0 = max(0, min(255, Int(floor(fx)))), x1 = min(255, x0 + 1), tx = fx - floor(fx)
                let top = number(masks, [0, candidate, y0, x0]) * (1 - tx) + number(masks, [0, candidate, y0, x1]) * tx
                let bottom = number(masks, [0, candidate, y1, x0]) * (1 - tx) + number(masks, [0, candidate, y1, x1]) * tx
                let probability = 1 / (1 + exp(-(top * (1 - ty) + bottom * ty)))
                output[y * width + x] = UInt8(max(0, min(255, Int((probability * 255).rounded()))))
            }
        }
    }
    return alpha
}

struct MemoryCandidate { let x: Int; let y: Int; let score: Double }
struct NeuralAttention {
    let prompts: [[String: Any]]
    let anchorsUsed: Int
    let probabilities: [Double]
    let confidence: Double
}

func embeddingPrototype(_ embedding: MLMultiArray, alpha: Data, width: Int, height: Int, channels: Int = 256, grid: Int = 64) -> ([Double], [Double])? {
    guard embedding.shape.count == 4, embedding.shape[1].intValue == channels else { return nil }
    let prior = [UInt8](alpha)
    guard prior.count == width * height else { return nil }
    var foreground = [Double](repeating: 0, count: channels)
    var background = [Double](repeating: 0, count: channels)
    var foregroundWeight = 0.0, backgroundWeight = 0.0
    for y in 0..<grid {
        let py = min(height - 1, Int((Double(y) + 0.5) * Double(height) / Double(grid)))
        for x in 0..<grid {
            let px = min(width - 1, Int((Double(x) + 0.5) * Double(width) / Double(grid)))
            let foregroundPixelWeight = Double(prior[py * width + px]) / 255
            let backgroundPixelWeight = 1 - foregroundPixelWeight
            for channel in 0..<channels {
                let value = number(embedding, [0, channel, y, x])
                foreground[channel] += value * foregroundPixelWeight
                background[channel] += value * backgroundPixelWeight
            }
            foregroundWeight += foregroundPixelWeight
            backgroundWeight += backgroundPixelWeight
        }
    }
    guard foregroundWeight >= 0.25, backgroundWeight >= 0.25 else { return nil }
    for channel in 0..<channels {
        foreground[channel] /= foregroundWeight
        background[channel] /= backgroundWeight
    }
    return (foreground, background)
}

func neuralMemoryAttention(current: MLMultiArray, memory: NeuralMemory, frameIndex: Int) -> NeuralAttention {
    let grid = 64, channels = 256
    guard current.shape.count == 4, current.shape[1].intValue == channels else { return NeuralAttention(prompts: [], anchorsUsed: 0, probabilities: [], confidence: 0) }
    var foreground = [Double](repeating: 0, count: channels)
    var background = [Double](repeating: 0, count: channels)
    var totalWeight = 0.0
    var anchorsUsed = 0
    for anchor in memory.anchors {
        let prototype = (anchor.foregroundPrototype, anchor.backgroundPrototype)
        let distance = abs(frameIndex - anchor.frameIndex)
        let recency = 1 / (1 + Double(distance) / 30)
        let weight = recency * (anchor.protected ? 1.4 : 1)
        for channel in 0..<channels {
            foreground[channel] += prototype.0[channel] * weight
            background[channel] += prototype.1[channel] * weight
        }
        totalWeight += weight
        anchorsUsed += 1
    }
    guard anchorsUsed > 0, totalWeight > 0 else { return NeuralAttention(prompts: [], anchorsUsed: 0, probabilities: [], confidence: 0) }
    var foregroundNorm = 0.0, backgroundNorm = 0.0
    for channel in 0..<channels {
        foreground[channel] /= totalWeight
        background[channel] /= totalWeight
        foregroundNorm += foreground[channel] * foreground[channel]
        backgroundNorm += background[channel] * background[channel]
    }
    foregroundNorm = sqrt(max(1e-12, foregroundNorm)); backgroundNorm = sqrt(max(1e-12, backgroundNorm))
    var candidates: [MemoryCandidate] = []
    for y in 0..<grid {
        for x in 0..<grid {
            var fgDot = 0.0, bgDot = 0.0, cellNorm = 0.0
            for channel in 0..<channels {
                let value = number(current, [0, channel, y, x])
                fgDot += value * foreground[channel]; bgDot += value * background[channel]; cellNorm += value * value
            }
            let norm = sqrt(max(1e-12, cellNorm))
            candidates.append(MemoryCandidate(x: x, y: y, score: fgDot / (norm * foregroundNorm) - bgDot / (norm * backgroundNorm)))
        }
    }
    let ranked = candidates.sorted { $0.score > $1.score }
    let low = ranked[min(ranked.count - 1, ranked.count * 3 / 4)].score
    let high = ranked[min(ranked.count - 1, ranked.count / 4)].score
    let midpoint = (low + high) / 2
    let scale = max(0.04, high - low)
    var probabilities = [Double](repeating: 0.5, count: grid * grid)
    var certainty = 0.0
    for candidate in candidates {
        let probability = 1 / (1 + exp(-4 * (candidate.score - midpoint) / scale))
        probabilities[candidate.y * grid + candidate.x] = probability
        certainty += abs(probability - 0.5) * 2
    }
    var selected: [(MemoryCandidate, String)] = []
    func appendSeparated(_ pool: [MemoryCandidate], kind: String, count: Int) {
        for item in pool {
            if selected.allSatisfy({ prior, _ in let dx = prior.x - item.x, dy = prior.y - item.y; return dx * dx + dy * dy >= 36 }) {
                selected.append((item, kind))
                if selected.filter({ $0.1 == kind }).count == count { break }
            }
        }
    }
    appendSeparated(ranked, kind: "foreground", count: 6)
    appendSeparated(Array(ranked.reversed()), kind: "background", count: 4)
    return NeuralAttention(
        prompts: selected.map { item, kind in ["x": (Double(item.x) + 0.5) / Double(grid), "y": (Double(item.y) + 0.5) / Double(grid), "kind": kind] },
        anchorsUsed: anchorsUsed,
        probabilities: probabilities,
        confidence: min(1, max(0, certainty / Double(grid * grid)))
    )
}

func attentionAlpha(_ attention: NeuralAttention, width: Int, height: Int) -> Data? {
    let grid = 64
    guard attention.probabilities.count == grid * grid else { return nil }
    var alpha = Data(count: width * height)
    alpha.withUnsafeMutableBytes { bytes in
        guard let output = bytes.baseAddress?.assumingMemoryBound(to: UInt8.self) else { return }
        for y in 0..<height {
            let fy = (Double(y) + 0.5) * Double(grid) / Double(height) - 0.5
            let y0 = max(0, min(grid - 1, Int(floor(fy)))), y1 = min(grid - 1, y0 + 1), ty = fy - floor(fy)
            for x in 0..<width {
                let fx = (Double(x) + 0.5) * Double(grid) / Double(width) - 0.5
                let x0 = max(0, min(grid - 1, Int(floor(fx)))), x1 = min(grid - 1, x0 + 1), tx = fx - floor(fx)
                let top = attention.probabilities[y0 * grid + x0] * (1 - tx) + attention.probabilities[y0 * grid + x1] * tx
                let bottom = attention.probabilities[y1 * grid + x0] * (1 - tx) + attention.probabilities[y1 * grid + x1] * tx
                output[y * width + x] = UInt8(max(0, min(255, Int(((top * (1 - ty) + bottom * ty) * 255).rounded()))))
            }
        }
    }
    return alpha
}

/** Feature-memory attention only adjusts SAM's uncertain band. Decisive pixels
 * remain owned by the current frame and explicit user prompts, preventing an
 * old anchor from painting a disappeared subject back into the shot. */
func fuseNeuralAttention(_ current: Data, attention: Data?, confidence: Double) -> Data {
    guard let attention, attention.count == current.count, confidence >= 0.08 else { return current }
    let now = [UInt8](current), remembered = [UInt8](attention)
    let weight = min(0.32, max(0.08, confidence * 0.32))
    var fused = now
    for index in now.indices {
        let value = Int(now[index])
        if value <= 28 || value >= 227 { continue }
        let support = Int(remembered[index])
        fused[index] = UInt8(max(0, min(255, Int((Double(value) * (1 - weight) + Double(support) * weight).rounded()))))
    }
    return Data(fused)
}

func describeAlpha(_ alpha: Data, width: Int, height: Int) -> (Double, Double, Double) {
    let bytes = [UInt8](alpha)
    guard bytes.count == width * height else { return (0.5, 0.5, 0) }
    var weight = 0.0, weightedX = 0.0, weightedY = 0.0
    for y in stride(from: 0, to: height, by: max(1, height / 128)) {
        for x in stride(from: 0, to: width, by: max(1, width / 128)) {
            let value = Double(bytes[y * width + x]) / 255
            weight += value
            weightedX += value * (Double(x) + 0.5) / Double(width)
            weightedY += value * (Double(y) + 0.5) / Double(height)
        }
    }
    let samples = Double(((height - 1) / max(1, height / 128) + 1) * ((width - 1) / max(1, width / 128) + 1))
    return weight > 1e-6 ? (weightedX / weight, weightedY / weight, weight / max(1, samples)) : (0.5, 0.5, 0)
}

func anchorDistance(_ left: NeuralAnchor, _ right: NeuralAnchor) -> Double {
    let spatial = hypot(left.centroidX - right.centroidX, left.centroidY - right.centroidY)
    let area = abs(left.area - right.area)
    let temporal = min(1, Double(abs(left.frameIndex - right.frameIndex)) / 90)
    return spatial * 1.8 + area * 1.2 + temporal * 0.35
}

func updateMemory(_ memory: NeuralMemory?, embedding: MLMultiArray, alpha: Data, width: Int, height: Int, frameIndex: Int, protected: Bool) -> NeuralMemory {
    let descriptor = describeAlpha(alpha, width: width, height: height)
    guard let prototypes = embeddingPrototype(embedding, alpha: alpha, width: width, height: height) else { return memory ?? NeuralMemory(anchors: [], frames: 0) }
    let anchor = NeuralAnchor(embedding: embedding, foregroundPrototype: prototypes.0, backgroundPrototype: prototypes.1, alpha: alpha, width: width, height: height, frameIndex: frameIndex, centroidX: descriptor.0, centroidY: descriptor.1, area: descriptor.2, protected: protected)
    var candidates = (memory?.anchors ?? []).filter { $0.frameIndex != frameIndex } + [anchor]
    candidates.sort { $0.frameIndex < $1.frameIndex }
    if candidates.count > 5 {
        var selected = candidates.filter(\.protected)
        if selected.count > 2 { selected = [selected.first!, selected.last!] }
        if let latest = candidates.last, !selected.contains(where: { $0.frameIndex == latest.frameIndex }) { selected.append(latest) }
        while selected.count < 5 {
            let remaining = candidates.filter { candidate in !selected.contains(where: { $0.frameIndex == candidate.frameIndex }) }
            guard let best = remaining.max(by: { left, right in
                let leftScore = selected.map { anchorDistance(left, $0) }.min() ?? 1
                let rightScore = selected.map { anchorDistance(right, $0) }.min() ?? 1
                return leftScore == rightScore ? left.frameIndex < right.frameIndex : leftScore < rightScore
            }) else { break }
            selected.append(best)
        }
        candidates = selected.sorted { $0.frameIndex < $1.frameIndex }
    }
    return NeuralMemory(anchors: candidates, frames: (memory?.frames ?? 0) + 1)
}

func storeMemory(_ memory: NeuralMemory, sessionId: String) {
    sessionMemories[sessionId] = memory
    sessionOrder.removeAll { $0 == sessionId }
    sessionOrder.append(sessionId)
    while sessionOrder.count > 16 {
        sessionMemories.removeValue(forKey: sessionOrder.removeFirst())
    }
}

func resetMemory(sessionId: String) {
    sessionMemories.removeValue(forKey: sessionId)
    sessionOrder.removeAll { $0 == sessionId }
}

struct Sam2Result { let alpha: Data; let embedding: MLMultiArray; let usedMemoryAttention: Bool; let memoryAnchorsUsed: Int; let memoryConfidence: Double }

func promptAgreement(_ masks: MLMultiArray, candidate: Int, prompts: [[String: Any]]) -> Double {
    guard !prompts.isEmpty else { return 0 }
    var agreement = 0.0, weight = 0.0
    for prompt in prompts {
        let x = min(255, max(0, Int((((prompt["x"] as? NSNumber)?.doubleValue ?? 0.5) * 255).rounded())))
        let y = min(255, max(0, Int((((prompt["y"] as? NSNumber)?.doubleValue ?? 0.5) * 255).rounded())))
        let probability = 1 / (1 + exp(-number(masks, [0, candidate, y, x])))
        let promptWeight = prompt["detail"] as? String == "solid" ? 1.35 : 1.0
        agreement += (prompt["kind"] as? String == "background" ? 1 - probability : probability) * promptWeight
        weight += promptWeight
    }
    return agreement / max(1, weight)
}

func sam2Alpha(image: CGImage, width: Int, height: Int, frameIndex: Int, modelDirectory: URL, prompts: [[String: Any]], memory: NeuralMemory?) throws -> Sam2Result {
    let encoder = try cachedModel(packageURL: modelDirectory.appendingPathComponent("SAM2TinyImageEncoderFLOAT16.mlpackage"))
    let promptEncoder = try cachedModel(packageURL: modelDirectory.appendingPathComponent("SAM2TinyPromptEncoderFLOAT16.mlpackage"))
    let decoder = try cachedModel(packageURL: modelDirectory.appendingPathComponent("SAM2TinyMaskDecoderFLOAT16.mlpackage"))
    let encoded = try encoder.prediction(from: try featureProvider(["image": MLFeatureValue(pixelBuffer: try imagePixelBuffer(image, size: 1024))]))
    guard let imageEmbeddingValue = encoded.featureValue(for: "image_embedding"), let imageEmbedding = imageEmbeddingValue.multiArrayValue else { throw makeError(5, "SAM2 image embedding is unavailable.") }
    let memoryResult = memory.map { neuralMemoryAttention(current: imageEmbedding, memory: $0, frameIndex: frameIndex) } ?? NeuralAttention(prompts: [], anchorsUsed: 0, probabilities: [], confidence: 0)
    let memoryPrompts = memoryResult.prompts
    let combinedPrompts = Array((prompts + memoryPrompts).prefix(96))
    guard !combinedPrompts.isEmpty else { throw makeError(6, "Object selection needs a foreground point or tracked neural memory.") }
    let pointCount = combinedPrompts.count
    let points = try MLMultiArray(shape: [1, NSNumber(value: pointCount), 2], dataType: .float32)
    let labels = try MLMultiArray(shape: [1, NSNumber(value: pointCount)], dataType: .float32)
    for index in 0..<pointCount {
        let prompt = combinedPrompts[index]
        let x = min(1, max(0, (prompt["x"] as? NSNumber)?.doubleValue ?? 0.5)), y = min(1, max(0, (prompt["y"] as? NSNumber)?.doubleValue ?? 0.5))
        setNumber(points, [0, index, 0], x * 1024); setNumber(points, [0, index, 1], y * 1024)
        setNumber(labels, [0, index], prompt["kind"] as? String == "background" ? 0 : 1)
    }
    let prompted = try promptEncoder.prediction(from: try featureProvider(["points": MLFeatureValue(multiArray: points), "labels": MLFeatureValue(multiArray: labels)]))
    guard let feats0 = encoded.featureValue(for: "feats_s0"), let feats1 = encoded.featureValue(for: "feats_s1"),
          let sparse = prompted.featureValue(for: "sparse_embeddings"), let dense = prompted.featureValue(for: "dense_embeddings") else { throw makeError(7, "SAM2 encoder outputs are incomplete.") }
    let decoded = try decoder.prediction(from: try featureProvider([
        "image_embedding": imageEmbeddingValue, "sparse_embedding": sparse, "dense_embedding": dense, "feats_s0": feats0, "feats_s1": feats1,
    ]))
    guard let masks = decoded.featureValue(for: "low_res_masks")?.multiArrayValue,
          let scores = decoded.featureValue(for: "scores")?.multiArrayValue else { throw makeError(8, "SAM2 mask outputs are incomplete.") }
    var selected = 0
    let candidateCount = min(3, scores.count)
    for candidate in 1..<candidateCount {
        let candidateScore = number(scores, [0, candidate]) + promptAgreement(masks, candidate: candidate, prompts: combinedPrompts) * 0.85
        let selectedScore = number(scores, [0, selected]) + promptAgreement(masks, candidate: selected, prompts: combinedPrompts) * 0.85
        if candidateScore > selectedScore { selected = candidate }
    }
    let coarse = bilinearMask(masks, candidate: selected, width: width, height: height)
    let attended = fuseNeuralAttention(coarse, attention: attentionAlpha(memoryResult, width: width, height: height), confidence: memoryResult.confidence)
    return Sam2Result(alpha: attended, embedding: imageEmbedding, usedMemoryAttention: !memoryPrompts.isEmpty, memoryAnchorsUsed: memoryResult.anchorsUsed, memoryConfidence: memoryResult.confidence)
}

func fuseMemory(_ current: Data, memoryPath: String?) -> (Data, Bool) {
    guard let memoryPath, !memoryPath.isEmpty, let memory = try? Data(contentsOf: URL(fileURLWithPath: memoryPath)), memory.count == current.count else { return (current, false) }
    let now = [UInt8](current), before = [UInt8](memory)
    var fused = [UInt8](repeating: 0, count: now.count)
    for index in now.indices {
        let c = Int(now[index]), m = Int(before[index])
        if c < 20 && m > 190 || c > 235 || m < 12 { fused[index] = now[index] }
        else { fused[index] = UInt8((c * 7 + m) / 8) }
    }
    return (Data(fused), true)
}

func trimap(from alpha: Data, width: Int, height: Int, prompts: [[String: Any]], size: Int = 512) throws -> MLMultiArray {
    let source = [UInt8](alpha)
    let result = try MLMultiArray(shape: [1, 1, NSNumber(value: size), NSNumber(value: size)], dataType: .float32)
    var classes = [UInt8](repeating: 1, count: size * size)
    for y in 0..<size {
        let sy = min(height - 1, Int((Double(y) + 0.5) * Double(height) / Double(size)))
        for x in 0..<size {
            let sx = min(width - 1, Int((Double(x) + 0.5) * Double(width) / Double(size)))
            let value = source[sy * width + sx]
            classes[y * size + x] = value <= 48 ? 0 : value >= 207 ? 2 : 1
        }
    }
    var guides = [Int8](repeating: -1, count: size * size)
    for prompt in prompts {
        let detail = prompt["detail"] as? String
        if prompt["kind"] as? String != "background" && detail != "hair" && detail != "solid" { continue }
        let cx = min(size - 1, max(0, Int((((prompt["x"] as? NSNumber)?.doubleValue ?? 0.5) * Double(size - 1)).rounded())))
        let cy = min(size - 1, max(0, Int((((prompt["y"] as? NSNumber)?.doubleValue ?? 0.5) * Double(size - 1)).rounded())))
        let normalizedRadius = max(0.004, min(0.08, (prompt["radius"] as? NSNumber)?.doubleValue ?? (detail == "hair" ? 0.022 : detail == "solid" ? 0.017 : 0.014)))
        let strength = max(0.1, min(1.0, (prompt["strength"] as? NSNumber)?.doubleValue ?? 0.8))
        let effectiveRadius = normalizedRadius * (0.6 + 0.4 * strength)
        let radius = max(2, min(48, Int((effectiveRadius * Double(size)).rounded())))
        let value: Int8 = prompt["kind"] as? String == "background" ? 0 : detail == "solid" && strength >= 0.55 ? 2 : 1
        for y in max(0, cy - radius)...min(size - 1, cy + radius) {
            for x in max(0, cx - radius)...min(size - 1, cx + radius) where (x - cx) * (x - cx) + (y - cy) * (y - cy) <= radius * radius {
                guides[y * size + x] = value
            }
        }
    }
    for y in 0..<size {
        for x in 0..<size {
            var kind = classes[y * size + x]
            if kind != 1 {
                for dy in -2...2 where kind != 1 {
                    for dx in -2...2 {
                        let nx = max(0, min(size - 1, x + dx)), ny = max(0, min(size - 1, y + dy))
                        if classes[ny * size + nx] != kind { kind = 1; break }
                    }
                }
            }
            let guided = guides[y * size + x]
            if guided >= 0 { kind = UInt8(guided) }
            setNumber(result, [0, 0, y, x], kind == 0 ? 0 : kind == 2 ? 1 : 0.5)
        }
    }
    return result
}

func refineAlpha(image: CGImage, coarse: Data, width: Int, height: Int, prompts: [[String: Any]], modelDirectory: URL) throws -> Data {
    let model = try cachedModel(packageURL: modelDirectory.appendingPathComponent("ScenePilotViTMatteSmall.mlpackage"))
    let prediction = try model.prediction(from: try featureProvider([
        "image": MLFeatureValue(pixelBuffer: try imagePixelBuffer(image, size: 512)),
        "trimap": MLFeatureValue(multiArray: try trimap(from: coarse, width: width, height: height, prompts: prompts)),
    ]))
    guard let matte = prediction.featureValue(for: "alpha")?.multiArrayValue else { throw makeError(9, "ViTMatte returned no alpha output.") }
    var result = Data(count: width * height)
    result.withUnsafeMutableBytes { bytes in
        guard let output = bytes.baseAddress?.assumingMemoryBound(to: UInt8.self) else { return }
        for y in 0..<height {
            let fy = (Double(y) + 0.5) * 512 / Double(height) - 0.5
            let y0 = max(0, min(511, Int(floor(fy)))), y1 = min(511, y0 + 1), ty = fy - floor(fy)
            for x in 0..<width {
                let fx = (Double(x) + 0.5) * 512 / Double(width) - 0.5
                let x0 = max(0, min(511, Int(floor(fx)))), x1 = min(511, x0 + 1), tx = fx - floor(fx)
                let top = number(matte, [0, 0, y0, x0]) * (1 - tx) + number(matte, [0, 0, y0, x1]) * tx
                let bottom = number(matte, [0, 0, y1, x0]) * (1 - tx) + number(matte, [0, 0, y1, x1]) * tx
                output[y * width + x] = UInt8(max(0, min(255, Int(((top * (1 - ty) + bottom * ty) * 255).rounded()))))
            }
        }
    }
    return result
}

func processRequest(at requestURL: URL, serving: Bool) throws -> [String: Any] {
    let data = try Data(contentsOf: requestURL)
    let request = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    let requestId = request["requestId"] as? String ?? ""
    guard request["schema"] as? String == "scenepilot-native-roto/v3", let width = integer(request["width"]), let height = integer(request["height"]),
          width > 0, height > 0, width <= 2048, height <= 2048, let framePath = request["framePath"] as? String else { throw makeError(10, "Native roto request is invalid.") }
    let rgba = try Data(contentsOf: URL(fileURLWithPath: framePath), options: .mappedIfSafe)
    guard rgba.count == width * height * 4 else { throw makeError(11, "Native roto frame byte count does not match its dimensions.") }
    let image = try cgImage(rgba: rgba, width: width, height: height)
    let target = request["target"] as? String ?? "auto", prompts = request["prompts"] as? [[String: Any]] ?? []
    let modelDirectory = (request["modelDirectory"] as? String).flatMap { $0.isEmpty ? nil : URL(fileURLWithPath: $0) }
    let sessionId = request["sessionId"] as? String ?? "default"
    if bool(request["resetMemory"]) { resetMemory(sessionId: sessionId) }
    let priorMemory = sessionMemories[sessionId], frameIndex = integer(request["frameIndex"]) ?? 0
    var embedding: MLMultiArray?, usedMemoryAttention = false, memoryAnchorsUsed = 0, memoryConfidence = 0.0
    let baseAlpha: Data, provider: String, model: String
    if target == "person" || (target == "auto" && modelDirectory == nil) {
        baseAlpha = try personAlpha(image: image, width: width, height: height)
        provider = "apple-vision-coreml"; model = "Apple Vision accurate person alpha"
    } else if let modelDirectory {
        let result = try sam2Alpha(image: image, width: width, height: height, frameIndex: frameIndex, modelDirectory: modelDirectory, prompts: prompts, memory: priorMemory)
        baseAlpha = result.alpha; embedding = result.embedding; usedMemoryAttention = result.usedMemoryAttention; memoryAnchorsUsed = result.memoryAnchorsUsed; memoryConfidence = result.memoryConfidence
        provider = "apple-coreml-sam2-vitmatte"; model = "SAM2 Tiny neural key/value feature memory"
    } else { throw makeError(12, "Promptable object segmentation models are not installed.") }
    let fused = fuseMemory(baseAlpha, memoryPath: request["memoryAlphaPath"] as? String)
    var alpha = fused.0, alphaRefined = false, mattingModel = ""
    if bool(request["refineAlpha"]), let modelDirectory,
       FileManager.default.fileExists(atPath: modelDirectory.appendingPathComponent("ScenePilotViTMatteSmall.mlpackage/Manifest.json").path) {
        alpha = try refineAlpha(image: image, coarse: alpha, width: width, height: height, prompts: prompts, modelDirectory: modelDirectory)
        alphaRefined = true; mattingModel = "ViTMatte Small Composition-1K"
    }
    if let embedding {
        storeMemory(updateMemory(priorMemory, embedding: embedding, alpha: alpha, width: width, height: height, frameIndex: frameIndex, protected: bool(request["memoryAnchor"])), sessionId: sessionId)
    }
    let response: [String: Any] = [
        "requestId": requestId, "width": width, "height": height, "alpha": alpha.base64EncodedString(), "provider": provider,
        "model": alphaRefined ? model + " + ViTMatte" : model, "temporalMemory": fused.1 || usedMemoryAttention,
        "memoryAttention": usedMemoryAttention, "memoryConfidence": memoryConfidence, "memoryFrames": sessionMemories[sessionId]?.frames ?? 0,
        "memoryAnchors": sessionMemories[sessionId]?.anchors.count ?? 0, "memoryAnchorsUsed": memoryAnchorsUsed,
        "alphaRefined": alphaRefined, "mattingModel": mattingModel, "serviceReused": serving && processedRequests > 0,
    ]
    processedRequests += 1
    return response
}

func writePayload(_ payload: [String: Any]) throws {
    var output = try JSONSerialization.data(withJSONObject: payload); output.append(0x0a); FileHandle.standardOutput.write(output)
}

func handle(_ path: String, serving: Bool) {
    var requestId = ""
    if let data = try? Data(contentsOf: URL(fileURLWithPath: path)), let request = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
        requestId = request["requestId"] as? String ?? ""
    }
    do { try writePayload(processRequest(at: URL(fileURLWithPath: path), serving: serving)) }
    catch { try? writePayload(["requestId": requestId, "error": "Native segmentation failed: \(error.localizedDescription)"]) }
}

if CommandLine.arguments.contains("--serve") {
    while let path = readLine() { if !path.isEmpty { handle(path, serving: true) } }
    exit(0)
}

guard CommandLine.arguments.count == 2 else { fail("Usage: scenepilot-vision-roto request.json, or --serve") }
handle(CommandLine.arguments[1], serving: false)
