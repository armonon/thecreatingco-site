import AppKit
import AVKit
import ScenePilotCore

/// Source state is independent of the program playhead and the document's undo stack.
@MainActor final class SourceMonitor: NSWindowController, NSWindowDelegate {
    let player = AVPlayer()
    let marks = NSTextField(labelWithString: "")
    var assetId: String?
    var range = SourceRange(end: 0)
    var duration = 0.0
    var sourcePath: String?
    init(editor: EditorController) {
        let window = NSWindow(contentRect: NSRect(x: 160, y: 160, width: 720, height: 490), styleMask: [.titled,.closable,.resizable], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.minSize = NSSize(width: 660, height: 360)
        super.init(window: window)
        window.delegate = self
        let viewer = AVPlayerView(); viewer.player = player; viewer.controlsStyle = .floating; viewer.videoGravity = .resizeAspect
        viewer.setAccessibilityLabel("Source monitor — independent of timeline")
        let controls = NSStackView(views: [.sourceIn,.sourceOut,.sourceClear,.sourceInsert,.sourceOverwrite].map(editor.button))
        let help = NSTextField(wrappingLabelWithString: "Scrub the source, mark In / Out, then select a destination track and program playhead. Insert ripples ONLY that track; Overwrite replaces ONLY that track. Source Out is exclusive. Audio and video stay together.")
        help.font = .systemFont(ofSize: 11); help.textColor = .secondaryLabelColor
        let root = editor.vertical([viewer, marks, controls, help]); editor.fill(root, in: window.contentView!)
        viewer.heightAnchor.constraint(greaterThanOrEqualToConstant: 220).isActive = true
        viewer.widthAnchor.constraint(equalTo: root.widthAnchor, constant: -24).isActive = true
        help.widthAnchor.constraint(equalTo: viewer.widthAnchor).isActive = true
    }
    required init?(coder: NSCoder) { fatalError() }
    func load(_ media: Media) {
        if assetId != media.id || sourcePath != media.path || duration != media.duration || player.currentItem == nil {
            sourcePath = media.path
            assetId = media.id; duration = media.duration; range = SourceRange(end: media.duration)
            player.replaceCurrentItem(with: AVPlayerItem(url: URL(fileURLWithPath: media.path)))
        }
        window?.title = "SOURCE · " + media.name; refresh(); showWindow(nil); window?.makeKeyAndOrderFront(nil)
    }
    func refresh() { marks.stringValue = String(format: "IN %.3fs    OUT %.3fs    RANGE %.3fs", range.start, range.end, range.end - range.start) }
    func reset() { player.pause(); player.replaceCurrentItem(with: nil); assetId = nil; window?.orderOut(nil) }
    func windowWillClose(_ notification: Notification) { player.pause() }
}

extension EditorController {
    var sourceAvailable: Bool { sourceMonitor?.assetId.map { id in project.media.contains { $0.id == id } } == true }
    func runSource(_ command: Command) throws {
        if command == .openSource {
            guard let id = librarySelection?.0, let media = project.media.first(where: { $0.id == id }) else { return }
            player.pause()
            if sourceMonitor == nil { sourceMonitor = SourceMonitor(editor: self) }
            sourceMonitor?.load(media); updateCommands(); return
        }
        guard let source = sourceMonitor, let id = source.assetId, sourceAvailable else { return }
        let fps = Double(sequence.frameRate)
        let seconds = source.player.currentTime().seconds
        guard seconds.isFinite else { throw ProjectError.invalid("Wait for the source monitor to load.") }
        switch command {
        case .sourceIn, .sourceOut:
            var range = source.range
            if command == .sourceIn { range.start = max(0, min(source.duration, (seconds * fps).rounded() / fps)) }
            else { range.end = min(source.duration, (seconds * fps).rounded() / fps + 1 / fps) }
            try range.validate(duration: source.duration, frameRate: sequence.frameRate)
            source.range = range; source.refresh()
        case .sourceClear: source.range = SourceRange(end: source.duration); source.refresh()
        case .sourceInsert, .sourceOverwrite:
            guard let track = selectedTrackId else { return }
            let clipID = UUID().uuidString
            let next = try Edit.placeSource(project, sequenceId: activeSequenceId, assetId: id, trackId: track,
                range: source.range, at: playhead, mode: command == .sourceInsert ? .insert : .overwrite, clipId: clipID)
            source.player.pause(); selectedClipId = clipID; apply(next)
            status.stringValue = "\(command == .sourceInsert ? "Inserted" : "Overwrote") source range on selected track only · Undo available"
        default: break
        }
        updateCommands()
    }
}
