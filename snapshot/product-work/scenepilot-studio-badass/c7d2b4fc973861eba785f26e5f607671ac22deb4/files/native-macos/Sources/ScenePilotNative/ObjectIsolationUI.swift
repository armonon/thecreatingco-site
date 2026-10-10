import AppKit
import CoreImage
import ScenePilotCore
import ScenePilotMedia

final class IsolationPicker: NSView {
    let image: NSImage
    var prompts: [IsolationPrompt] = []
    var cursor = CGPoint(x: 0.5, y: 0.5)
    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    init(image: CGImage) {
        self.image = NSImage(cgImage: image, size: .zero); super.init(frame: NSRect(x: 0, y: 0, width: 600, height: 340))
        setAccessibilityElement(true); setAccessibilityRole(.image)
        setAccessibilityLabel("Object selection. Arrow keys move cursor; Space adds foreground, Option-Space adds background, Delete removes last point.")
        refresh()
    }
    required init?(coder: NSCoder) { fatalError() }
    var pictureRect: CGRect {
        let scale = min(bounds.width / image.size.width, bounds.height / image.size.height)
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        return CGRect(x: (bounds.width-size.width)/2, y: (bounds.height-size.height)/2, width: size.width, height: size.height)
    }
    override func draw(_ dirtyRect: NSRect) {
        NSColor.black.setFill(); bounds.fill()
        image.draw(in: pictureRect, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
        for point in prompts {
            let r = CGRect(x: pictureRect.minX + point.x * pictureRect.width - 5, y: pictureRect.minY + point.y * pictureRect.height - 5, width: 10, height: 10)
            (point.foreground ? NSColor.systemGreen : NSColor.systemRed).setFill(); NSBezierPath(ovalIn: r).fill()
        }
        if window?.firstResponder === self {
            NSColor.white.setStroke()
            let r = CGRect(x: pictureRect.minX + cursor.x * pictureRect.width - 7, y: pictureRect.minY + cursor.y * pictureRect.height - 7, width: 14, height: 14)
            NSBezierPath(ovalIn: r).stroke()
        }
    }
    func refresh() {
        setAccessibilityValue("\(prompts.filter(\.foreground).count) foreground, \(prompts.filter { !$0.foreground }.count) background points. Cursor \(Int(cursor.x*100)) percent across, \(Int(cursor.y*100)) percent down.")
        needsDisplay = true
    }
    override func mouseDown(with event: NSEvent) {
        window?.makeFirstResponder(self)
        let p = convert(event.locationInWindow, from: nil), r = pictureRect
        guard r.contains(p), prompts.count < 96 else { return }
        cursor = CGPoint(x: (p.x-r.minX)/r.width, y: (p.y-r.minY)/r.height)
        prompts.append(IsolationPrompt(x: cursor.x, y: cursor.y, foreground: !event.modifierFlags.contains(.option))); refresh()
    }
    override func rightMouseDown(with event: NSEvent) { if !prompts.isEmpty { prompts.removeLast(); refresh() } }
    override func keyDown(with event: NSEvent) {
        let step = event.modifierFlags.contains(.shift) ? 0.05 : 0.01
        switch event.keyCode {
        case 123: cursor.x = max(0,cursor.x-step)
        case 124: cursor.x = min(1,cursor.x+step)
        case 125: cursor.y = min(1,cursor.y+step)
        case 126: cursor.y = max(0,cursor.y-step)
        case 49:
            if prompts.count < 96 { prompts.append(IsolationPrompt(x:cursor.x,y:cursor.y,foreground:!event.modifierFlags.contains(.option))) }
        case 51: if !prompts.isEmpty { prompts.removeLast() }
        default: super.keyDown(with:event)
        }
        refresh()
    }
}

final class IsolationReviewImage: NSView {
    let image: NSImage
    init(_ image: CGImage) { self.image = NSImage(cgImage:image,size:.zero); super.init(frame:NSRect(x:0,y:0,width:600,height:340)) }
    required init?(coder:NSCoder) { fatalError() }
    override func draw(_ dirtyRect:NSRect) {
        for row in 0...Int(bounds.height/16) { for col in 0...Int(bounds.width/16) {
            NSColor(white:(row+col)%2 == 0 ? 0.2 : 0.3,alpha:1).setFill(); NSRect(x:col*16,y:row*16,width:16,height:16).fill()
        } }
        let scale = min(bounds.width/image.size.width,bounds.height/image.size.height)
        let size = NSSize(width:image.size.width*scale,height:image.size.height*scale)
        image.draw(in:NSRect(x:(bounds.width-size.width)/2,y:(bounds.height-size.height)/2,width:size.width,height:size.height))
    }
}

extension EditorController {
    var isolationResources: (URL, URL)? {
        guard let root = Bundle.main.resourceURL else { return nil }
        let helper = root.appendingPathComponent("native-tools/scenepilot-vision-roto"), models = root.appendingPathComponent("native-models/sam2-tiny")
        guard FileManager.default.isExecutableFile(atPath: helper.path), FileManager.default.fileExists(atPath: models.appendingPathComponent("scenepilot-model.json").path) else { return nil }
        return (helper, models)
    }
    func isolateObject() {
        guard let clip = selectedClip, let media = project.media.first(where: { $0.id == clip.assetId && $0.hasVideo }), let resources = isolationResources else {
            fail(ProjectError.invalid("The bundled Core ML object models are unavailable. Rebuild the native app with its staged models.")); return
        }
        let snapshot = project, sequenceId = activeSequenceId, fps = Double(sequence.frameRate) * clip.rate
        guard clip.duration * Double(sequence.frameRate) <= 18_000, clip.duration * clip.rate >= 1 / Double(sequence.frameRate) else { fail(ProjectError.invalid("Use a source span of at least one sequence frame and at most 18,000 output frames before isolation.")); return }
        player.pause(); busy = true; reload(rebuild: false); status.stringValue = "Loading first source frame for object selection…"
        Task { [weak self] in
            guard let self else { return }
            defer { self.isolationTask = nil; self.isolationJob = nil; self.busy = false; self.exportProgress.isHidden = true; self.reload(rebuild: false) }
            do {
                let image = try await Task.detached { try NativeObjectIsolation.firstFrame(path: media.path, at: clip.sourceStart) }.value
                let picker = IsolationPicker(image: image), alert = NSAlert()
                alert.messageText = "Isolate an object · first frame"
                alert.informativeText = "Click the subject (green). Option-click exclusions (red); right-click removes a point. Keyboard: arrows move the cursor, Space adds foreground, Option-Space adds background, Delete removes a point. You will review the first alpha before tracking the clip."
                alert.accessoryView = picker; alert.addButton(withTitle: "Generate Alpha + Composition"); alert.addButton(withTitle: "Cancel")
                guard alert.runModal() == .alertFirstButtonReturn else { return }
                guard picker.prompts.contains(where: \.foreground) else { throw ProjectError.invalid("Select at least one foreground point before generating.") }
                let save = NSSavePanel(); save.nameFieldStringValue = "\(media.name)-alpha.mov"; save.message = "Choose a NEW alpha sidecar file. Keep it with the project media; it is required for reopening and export. Existing files are never overwritten."
                guard save.runModal() == .OK, let output = save.url else { return }
                let job = NativeObjectIsolation(), prompts = picker.prompts
                self.isolationJob = job; self.exportProgress.doubleValue = 0; self.exportProgress.isHidden = false; self.updateCommands()
                self.status.stringValue = "Generating tracked alpha locally · use Compositing → Cancel AI Isolation to stop"
                let task = Task.detached { try await job.bake(path: media.path, start: clip.sourceStart, duration: clip.duration * clip.rate, frameRate: fps, prompts: prompts,
                    executable: resources.0, models: resources.1, destination: output, reviewFirstFrame: { frame, alpha in
                        await Self.reviewIsolation(frame, alpha: alpha)
                    }) { progress in
                        Task { @MainActor [weak self] in self?.exportProgress.doubleValue = progress }
                    }
                }
                self.isolationTask = task
                let matte = try await task.value
                guard self.project == snapshot else { throw ProjectError.invalid("Project changed during generation. The alpha sidecar was preserved; no edit was applied.") }
                self.apply(try Edit.isolate(snapshot, sequenceId: sequenceId, clipId: clip.id, matte: matte))
                self.status.stringValue = "Isolated composition created · original media/audio preserved · Undo available · review the full shot"
            } catch { self.fail(error) }
        }
    }
    static func reviewIsolation(_ frame: CGImage, alpha: Data) -> Bool {
        guard let provider = CGDataProvider(data: alpha as CFData), let mask = CGImage(width:frame.width,height:frame.height,bitsPerComponent:8,bitsPerPixel:8,bytesPerRow:frame.width,
            space:CGColorSpaceCreateDeviceGray(),bitmapInfo:CGBitmapInfo(rawValue:CGImageAlphaInfo.none.rawValue),provider:provider,decode:nil,shouldInterpolate:false,intent:.defaultIntent) else { return false }
        let foreground = CIImage(cgImage:frame)
        let result = foreground.applyingFilter("CIBlendWithMask",parameters:[kCIInputMaskImageKey:CIImage(cgImage:mask),kCIInputBackgroundImageKey:CIImage(color:.clear).cropped(to:foreground.extent)])
        guard let rendered = CIContext().createCGImage(result,from:foreground.extent) else { return false }
        let alert = NSAlert(); alert.messageText = "Review the selected subject"
        alert.informativeText = "Checkerboard is transparent. Check that the correct object is isolated before continuing. This is the first frame only; inspect hair, occlusions and scene changes after tracking. Cancel to choose different points."
        alert.accessoryView = IsolationReviewImage(rendered)
        alert.addButton(withTitle:"Continue Tracking"); alert.addButton(withTitle:"Cancel and Reselect")
        return alert.runModal() == .alertFirstButtonReturn
    }
}
