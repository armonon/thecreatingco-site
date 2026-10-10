import Foundation
import AVFoundation
import CoreGraphics
import CoreImage
import ScenePilotCore

public struct IsolationPrompt: Sendable {
    public let x: Double, y: Double
    public let foreground: Bool
    public init(x: Double, y: Double, foreground: Bool = true) { self.x = x; self.y = y; self.foreground = foreground }
}

/// One persistent Core ML service per bake, off the UI thread. Cancellation kills inference, not just the progress UI.
public final class NativeObjectIsolation: @unchecked Sendable {
    private let lock = NSLock()
    private var process: Process?
    private var canceled = false
    public init() {}
    public func cancel() { lock.lock(); canceled = true; let p = process; lock.unlock(); if p?.isRunning == true { p?.terminate() } }
    private func check() throws { lock.lock(); let value = canceled; lock.unlock(); if value { throw CancellationError() } }
    private func install(_ p: Process) throws { lock.lock(); defer { lock.unlock() }; if canceled { throw CancellationError() }; try p.run(); process = p }
    public static func firstFrame(path: String, at time: Double) throws -> CGImage {
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: URL(fileURLWithPath: path)))
        generator.appliesPreferredTrackTransform = true; generator.maximumSize = CGSize(width: 1024, height: 1024)
        generator.requestedTimeToleranceBefore = .zero; generator.requestedTimeToleranceAfter = .zero
        return try generator.copyCGImage(at: CMTime(seconds: time, preferredTimescale: 600_000), actualTime: nil)
    }
    public func bake(path: String, start: Double, duration: Double, frameRate: Double, prompts: [IsolationPrompt],
                     executable: URL, models: URL, destination: URL,
                     reviewFirstFrame: (@Sendable (CGImage, Data) async -> Bool)? = nil,
                     progress: @escaping @Sendable (Double) -> Void) async throws -> Media {
        guard destination.isFileURL, !FileManager.default.fileExists(atPath: destination.path),
              start.isFinite, start >= 0, duration.isFinite, duration > 0, frameRate.isFinite, frameRate >= 1, frameRate <= 480,
              duration * frameRate <= 18_000, prompts.contains(where: \.foreground), prompts.count <= 96,
              prompts.allSatisfy({ $0.x.isFinite && $0.y.isFinite && (0...1).contains($0.x) && (0...1).contains($0.y) }) else {
            throw ProjectError.invalid("Choose a new .mov sidecar, a foreground point, and a range of at most 18,000 frames.")
        }
        try check()
        let temp = FileManager.default.temporaryDirectory.appendingPathComponent("scenepilot-isolation-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: temp, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: temp) }
        let partial = destination.deletingLastPathComponent().appendingPathComponent(".isolation-" + UUID().uuidString + ".mov")
        defer { try? FileManager.default.removeItem(at: partial) }
        let service = Process(), input = Pipe(), output = Pipe()
        service.executableURL = executable; service.arguments = ["--serve"]
        service.standardInput = input; service.standardOutput = output; service.standardError = FileHandle.nullDevice
        try install(service)
        defer { if service.isRunning { service.terminate() }; try? input.fileHandleForWriting.close(); try? output.fileHandleForReading.close() }
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: URL(fileURLWithPath: path)))
        generator.appliesPreferredTrackTransform = true; generator.maximumSize = CGSize(width: 2048, height: 2048)
        generator.requestedTimeToleranceBefore = .zero; generator.requestedTimeToleranceAfter = .zero
        let first = try generator.copyCGImage(at: CMTime(seconds: start, preferredTimescale: 600_000), actualTime: nil)
        let width = first.width, height = first.height
        let count = Int(ceil(duration * frameRate)), session = UUID().uuidString
        let scratchBytes = Int64(count) * Int64(width) * Int64(height)
        guard scratchBytes <= 8 * 1024 * 1024 * 1024 else { throw ProjectError.invalid("Isolation scratch cache exceeds 8 GiB. Split the shot into shorter ranges.") }
        let free = try temp.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey]).volumeAvailableCapacityForImportantUsage
        if let free, free < scratchBytes + 512 * 1024 * 1024 { throw ProjectError.invalid("Not enough local space for the bounded alpha cache. Free space or isolate a shorter range.") }
        var buffered = Data()
        for frame in 0..<count {
            try check(); try Task.checkCancellation()
            let alpha: Data = try autoreleasepool {
                let image = frame == 0 ? first : try generator.copyCGImage(at: CMTime(seconds: start + Double(frame) / frameRate, preferredTimescale: 600_000), actualTime: nil)
                var rgba = Data(count: width * height * 4)
                try rgba.withUnsafeMutableBytes { bytes in
                    guard let context = CGContext(data: bytes.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw ProjectError.invalid("Cannot allocate inference frame.") }
                    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
                }
                let frameURL = temp.appendingPathComponent("frame.rgba"), requestURL = temp.appendingPathComponent("request.json")
                try rgba.write(to: frameURL)
                let requestID = UUID().uuidString
                let request: [String: Any] = ["schema": "scenepilot-native-roto/v3", "requestId": requestID, "width": width, "height": height,
                    "framePath": frameURL.path, "target": "object", "modelDirectory": models.path, "sessionId": session,
                    "frameIndex": frame, "resetMemory": frame == 0, "memoryAnchor": frame == 0, "refineAlpha": true,
                    "prompts": frame == 0 ? prompts.map { ["x": $0.x, "y": $0.y, "kind": $0.foreground ? "foreground" : "background"] as [String: Any] } : []]
                try JSONSerialization.data(withJSONObject: request).write(to: requestURL)
                let timeout = DispatchWorkItem { if service.isRunning { service.terminate() } }
                DispatchQueue.global().asyncAfter(deadline: .now() + 120, execute: timeout)
                defer { timeout.cancel() }
                try input.fileHandleForWriting.write(contentsOf: Data((requestURL.path + "\n").utf8))
                while true {
                    if let newline = buffered.firstIndex(of: 10) {
                        let line = buffered.prefix(upTo: newline); buffered.removeSubrange(...newline)
                        guard let begin = line.firstIndex(of: 123), let response = try? JSONSerialization.jsonObject(with: Data(line[begin...])) as? [String: Any], response["requestId"] as? String == requestID else { continue }
                        if let error = response["error"] as? String { throw ProjectError.invalid(error) }
                        guard response["width"] as? Int == width, response["height"] as? Int == height,
                              let encoded = response["alpha"] as? String, let alpha = Data(base64Encoded: encoded), alpha.count == width * height else { throw ProjectError.invalid("Invalid AI alpha response.") }
                        return alpha
                    }
                    let chunk = output.fileHandleForReading.availableData
                    try check()
                    guard !chunk.isEmpty else { throw ProjectError.invalid("AI helper stopped or exceeded the 120-second inference deadline. Project unchanged.") }
                    buffered.append(chunk)
                    guard buffered.count <= 8 * 1024 * 1024 else { throw ProjectError.invalid("AI helper response exceeded its memory limit.") }
                }
            }
            if frame == 0, let reviewFirstFrame, !(await reviewFirstFrame(first, alpha)) { throw CancellationError() }
            try alpha.write(to: temp.appendingPathComponent("\(frame).alpha"))
            progress(0.9 * Double(frame + 1) / Double(count))
        }
        // Keep the encoder out of long-running inference. Disk-backed alpha avoids
        // holding an idle hardware codec session or an entire shot in RAM.
        if service.isRunning { service.terminate() }
        try check(); try Task.checkCancellation()
        let writer = try AVAssetWriter(outputURL: partial, fileType: .mov)
        let video = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.proRes4444, AVVideoWidthKey: width, AVVideoHeightKey: height])
        video.expectsMediaDataInRealTime = false
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: video, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height])
        guard writer.canAdd(video) else { throw ProjectError.invalid("ProRes alpha sidecar encoding is unavailable.") }
        writer.add(video); guard writer.startWriting() else { throw ProjectError.invalid("Alpha encoder start: \(writer.error?.localizedDescription ?? "unknown error")") }
        writer.startSession(atSourceTime: .zero)
        defer { if writer.status == .writing { writer.cancelWriting() } }
        for frame in 0..<count {
            try check(); try Task.checkCancellation()
            let alpha = try Data(contentsOf: temp.appendingPathComponent("\(frame).alpha"), options: .mappedIfSafe)
            let deadline = Date().addingTimeInterval(30)
            while !video.isReadyForMoreMediaData {
                try check(); try Task.checkCancellation()
                guard writer.status == .writing else { throw writer.error ?? ProjectError.invalid("Alpha encoding failed.") }
                guard Date() < deadline else { throw ProjectError.invalid("Alpha encoder did not accept a frame within 30 seconds.") }
                try await Task.sleep(nanoseconds: 5_000_000)
            }
            var buffer: CVPixelBuffer?
            guard let pool = adaptor.pixelBufferPool, CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer) == kCVReturnSuccess, let buffer else { throw ProjectError.invalid("Cannot allocate alpha encoder frame.") }
            CVPixelBufferLockBaseAddress(buffer, [])
            let base = CVPixelBufferGetBaseAddress(buffer)!.assumingMemoryBound(to: UInt8.self), stride = CVPixelBufferGetBytesPerRow(buffer)
            alpha.withUnsafeBytes { bytes in
                let a = bytes.bindMemory(to: UInt8.self)
                for y in 0..<height { for x in 0..<width { let i = y * stride + x * 4; base[i] = 0; base[i+1] = 0; base[i+2] = 0; base[i+3] = a[y * width + x] } }
            }
            CVPixelBufferUnlockBaseAddress(buffer, [])
            guard adaptor.append(buffer, withPresentationTime: CMTime(seconds: Double(frame) / frameRate, preferredTimescale: 600_000)) else { throw writer.error ?? ProjectError.invalid("Alpha frame encoding failed.") }
            progress(0.9 + 0.1 * Double(frame + 1) / Double(count))
        }
        writer.endSession(atSourceTime: CMTime(seconds: duration, preferredTimescale: 600_000)); video.markAsFinished()
        await writer.finishWriting(); try check(); try Task.checkCancellation()
        guard writer.status == .completed else { throw writer.error ?? ProjectError.invalid("Alpha sidecar did not finish.") }
        // Move refuses an existing destination, including one created while inference was running.
        let published = partial.withUnsafeFileSystemRepresentation { from in destination.withUnsafeFileSystemRepresentation { to in Darwin.renamex_np(from!, to!, UInt32(RENAME_EXCL)) } }
        guard published == 0 else { throw ProjectError.invalid("Cannot publish alpha sidecar without overwriting: \(POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO).localizedDescription)") }
        var media = try await NativeMedia.inspect(destination); media.name = "AI Alpha · " + destination.lastPathComponent
        return media
    }
}
