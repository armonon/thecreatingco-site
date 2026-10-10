import AppKit
import AVKit
import ScenePilotCore
import ScenePilotMedia

@MainActor final class EditorController: NSWindowController, NSWindowDelegate, NSTableViewDataSource, NSTableViewDelegate, NSMenuItemValidation {
    var history = DocumentHistory(Project())
    var activeSequenceId: String
    var selectedClipId: String?
    var selectedTrackId: String?
    var documentURL: URL?
    var busy = false
    var closeApproved = false
    var playhead = 0.0
    var buildTask: Task<Void, Never>?
    var previewWaitTask: Task<Void, Never>?
    var previewBuildId = UUID()
    var exportTask: Task<Void, Never>?
    var journalTask: Task<Void, Never>?
    var playerObserver: Any?
    var seekQueue = LatestSeek()
    var built: BuiltSequence?
    var sourceMonitor: SourceMonitor?
    var isolationJob: NativeObjectIsolation?
    var isolationTask: Task<Media, Error>?
    var collectionTask: Task<URL, Error>?
    let exporter = NativeExporter()
    let player = AVPlayer()
    let viewer = AVPlayerView()
    let mediaTable = ContextMediaTable()
    let timeline = TimelineView()
    let timelineScroll = NSScrollView()
    let sequencePicker = NSPopUpButton()
    let sequenceTabs = NSStackView()
    let sequenceInfo = NSTextField(labelWithString: "")
    let mediaSearch = NSSearchField()
    let horizontalPanels = NSSplitView(), verticalPanels = NSSplitView()
    let exportProgress = NSProgressIndicator()
    var progressTask: Task<Void, Never>?
    var sequenceViews: [String: (Double, String?, String?, Double)] = [:]
    var workspaceReady = false
    let status = NSTextField(labelWithString: "NATIVE MIGRATION BUILD · AppKit + AVFoundation + Metal · No Electron")
    let position = NSTextField(labelWithString: "00:00.00")
    let inspectorTitle = NSTextField(labelWithString: "Select a clip")
    let motionStatus = NSTextField(labelWithString: "")
    let motionEasingPicker = NSPopUpButton()
    let maskPicker = NSPopUpButton(), mattePicker = NSPopUpButton(), matteModePicker = NSPopUpButton()
    let maskEasingPicker = NSPopUpButton(), maskKeyStatus = NSTextField(labelWithString:"")
    var fields: [String: NSTextField] = [:]
    var commandButtons: [Command: [NSButton]] = [:]
    var project: Project { history.project }
    var sequence: ScenePilotCore.Sequence { project.sequences.first { $0.id == activeSequenceId } ?? project.sequences[0] }
    var selectedClip: Clip? { sequence.videoClips.first { $0.id == selectedClipId } }
    var selectedTrack: Track? { sequence.tracks.first { $0.id == selectedTrackId } }
    var libraryRows: [(String, String, String)] {
        let all = project.media.map { ($0.id, $0.name, $0.hasVideo ? "VIDEO" : "AUDIO") } + project.sequences.filter { $0.id != activeSequenceId }.map { ($0.id, $0.name, "COMP") }
        return all.filter { mediaSearch.stringValue.isEmpty || $0.1.localizedCaseInsensitiveContains(mediaSearch.stringValue) }
    }
    var librarySelection: (String, String, String)? { libraryRows.indices.contains(mediaTable.selectedRow) ? libraryRows[mediaTable.selectedRow] : nil }

    init() {
        activeSequenceId = history.project.mainSequenceId
        let window = NSWindow(contentRect: NSRect(x: 100, y: 100, width: 1440, height: 900), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "ScenePilot Native — Migration Preview"
        window.minSize = NSSize(width: 1000, height: 700)
        window.setFrameAutosaveName("ScenePilotNative.Main.v1")
        super.init(window: window)
        window.delegate = self; window.appearance = NSAppearance(named: .darkAqua)
        selectedTrackId = sequence.tracks.last?.id
        setup(); reload(rebuild: false)
    }
    required init?(coder: NSCoder) { fatalError() }

    func label(_ text: String) -> NSTextField { let view = NSTextField(labelWithString: text); view.font = .systemFont(ofSize: 11, weight: .semibold); view.textColor = .secondaryLabelColor; return view }
    func button(_ command: Command) -> NSButton {
        let control = NSButton(title: command.title, target: self, action: #selector(invoke(_:)))
        control.identifier = NSUserInterfaceItemIdentifier(command.rawValue)
        if [.snapping,.lockTrack,.toggleTrack,.fit,.fill,.flipH,.flipV,.maskInvert,.matteInvert].contains(command) { control.setButtonType(.toggle) }
        control.bezelStyle = .rounded; control.controlSize = .small; control.toolTip = command.shortcut.isEmpty ? command.title : "\(command.title) · \(command.shortcutLabel)"
        commandButtons[command, default: []].append(control); return control
    }
    func vertical(_ views: [NSView]) -> NSStackView {
        let stack = NSStackView(views: views); stack.orientation = .vertical; stack.alignment = .leading; stack.spacing = 8
        stack.edgeInsets = NSEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
        return stack
    }
    func fill(_ child: NSView, in parent: NSView) {
        child.translatesAutoresizingMaskIntoConstraints = false; parent.addSubview(child)
        NSLayoutConstraint.activate([child.leadingAnchor.constraint(equalTo: parent.leadingAnchor), child.trailingAnchor.constraint(equalTo: parent.trailingAnchor), child.topAnchor.constraint(equalTo: parent.topAnchor), child.bottomAnchor.constraint(equalTo: parent.bottomAnchor)])
    }
    func name(for clip: Clip) -> String { project.media.first { $0.id == clip.assetId }?.name ?? project.sequences.first { $0.id == clip.compositionId }?.name ?? "Missing source" }
    func numberOfRows(in tableView: NSTableView) -> Int { libraryRows.count }
    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard libraryRows.indices.contains(row) else { return nil }; let item = libraryRows[row]
        let text = NSTextField(labelWithString: "\(item.1)\n\(item.2)"); text.font = .systemFont(ofSize: 11); text.lineBreakMode = .byTruncatingMiddle; return text
    }
    func tableViewSelectionDidChange(_ notification: Notification) { updateCommands() }
    func tableView(_ tableView: NSTableView, pasteboardWriterForRow row: Int) -> NSPasteboardWriting? {
        guard !busy, libraryRows.indices.contains(row) else { return nil }
        status.stringValue = "Drag \(libraryRows[row].1) onto an unlocked track. A highlighted destination accepts the drop."
        let item = NSPasteboardItem(); item.setString(libraryRows[row].0, forType: TimelineView.libraryType); return item
    }
    func dropLibraryItem(_ id: String, track: String, time: Double) -> Bool {
        guard !busy, sequence.tracks.contains(where: { $0.id == track && !$0.locked }) else { return false }
        let media = project.media.first { $0.id == id }, comp = project.sequences.first { $0.id == id && $0.id != activeSequenceId }
        guard let duration = media?.duration ?? comp?.duration else { return false }
        do {
            let clip = Clip(assetId: media?.id, compositionId: comp?.id, trackId: track, start: time, duration: duration)
            let next = try Edit.transact(project, sequenceId: activeSequenceId) { $0.videoClips.append(clip) }
            selectedClipId = clip.id; selectedTrackId = track; apply(next); return true
        } catch { fail(error); return false }
    }
    func enabled(_ command: Command) -> Bool {
        if command == .cancelCollection { return collectionTask != nil }
        if command == .cancelIsolation { return isolationJob != nil }
        if command == .cancelExport { return exportTask != nil }
        if busy { return false }
        switch command {
        case .isolateObject: return selectedTrack?.locked == false && selectedClip?.assetId.map { id in project.media.contains { $0.id == id && $0.hasVideo } } == true
        case .openSource: return librarySelection.map { row in project.media.contains { $0.id == row.0 } } ?? false
        case .sourceIn, .sourceOut, .sourceClear: return sourceAvailable
        case .sourceInsert, .sourceOverwrite: return sourceAvailable && selectedTrack?.locked == false
        case .undo: return history.canUndo
        case .redo: return history.canRedo
        case .append: return libraryRows.indices.contains(mediaTable.selectedRow) && selectedTrack?.locked != true
        case .relink: return librarySelection.map { row in project.media.contains { $0.id == row.0 } } ?? false
        case .split:
            guard let clip = selectedClip, selectedTrack?.locked != true else { return false }
            return !sequence.videoClips.contains { $0.matte?.sourceClipId == clip.id } && playhead > clip.start + 0.001 && playhead < clip.start + clip.duration - 0.001
        case .remove, .rippleDelete:
            guard let clip = selectedClip, selectedTrack?.locked != true else { return false }
            return !sequence.videoClips.contains { $0.matte?.sourceClipId == clip.id }
        case .trimHead, .trimTail, .slipBack, .slipForward, .duplicate: return selectedClip != nil && selectedTrack?.locked != true
        case .rollBack, .rollForward, .slideBack, .slideForward:
            return (try? adjacentEdit(command)) != nil
        case .fit, .fill, .flipH, .flipV: return canEditPicture
        case .resetTransform: return canEditPicture && (selectedClip?.motion == nil || canEditMotion)
        case .maskRectangle, .maskEllipse, .maskBezier: return canEditMask
        case .maskInvert: return canEditMask && evaluatedMask != nil
        case .maskRemove: return canEditPicture && selectedClip?.mask != nil
        case .editMaskPath: return canEditMask && evaluatedMask != nil && (selectedClip?.maskAnimation == nil || evaluatedMask?.shape == .bezier)
        case .addMaskKey: return canEditMotion && evaluatedMask != nil
        case .removeMaskKey, .maskLinear, .maskSmooth, .maskHold: return canEditMotion && currentMaskKey != nil
        case .previousMaskKey, .nextMaskKey: return neighboringMaskKey(forward:command == .nextMaskKey) != nil
        case .bakeMask: return canEditPicture && selectedClip?.maskAnimation != nil
        case .matteAlpha, .matteLuma, .matteInvert, .matteRemove: return canEditPicture && selectedClip?.matte != nil
        case .addMotionKey: return canEditMotion
        case .removeMotionKey, .motionLinear, .motionSmooth, .motionEaseIn, .motionEaseOut, .motionHold: return canEditMotion && currentMotionKey != nil
        case .previousMotionKey, .nextMotionKey: return neighboringMotionKey(forward: command == .nextMotionKey) != nil
        case .clearMotion: return selectedClip?.motion != nil && selectedTrack?.locked == false
        case .restoreLegacy: return project.legacyArchive != nil
        case .removeTrack: return sequence.tracks.count > 1 && selectedTrack?.locked == false && !sequence.videoClips.contains { $0.trackId == selectedTrackId }
        case .trackUp, .trackDown:
            guard selectedTrack?.locked == false, let index = sequence.tracks.firstIndex(where: { $0.id == selectedTrackId }) else { return false }
            let next = index + (command == .trackUp ? -1 : 1)
            return sequence.tracks.indices.contains(next) && !sequence.tracks[next].locked
        case .toggleTrack, .lockTrack: return selectedTrack != nil
        case .play: return built != nil
        case .retryPreview: return sequence.duration > 0
        case .export: return sequence.duration > 0
        default: return true
        }
    }
    func checked(_ command: Command) -> Bool {
        if let easing = command.motionEasing { return currentMotionKey?.easing == easing }
        switch command {
        case .snapping: return timeline.snapping
        case .lockTrack: return selectedTrack?.locked == true
        case .toggleTrack: return selectedTrack?.enabled == false
        case .fit: return selectedClip != nil && selectedClip?.transform?.fill != true
        case .fill: return selectedClip?.transform?.fill == true
        case .flipH: return selectedClip?.transform?.flipH == true
        case .flipV: return selectedClip?.transform?.flipV == true
        case .maskRectangle: return evaluatedMask?.shape == .rectangle
        case .maskEllipse: return evaluatedMask?.shape == .ellipse
        case .maskBezier: return evaluatedMask?.shape == .bezier
        case .maskInvert: return evaluatedMask?.inverted == true
        case .maskLinear, .maskSmooth, .maskHold: return currentMaskKey?.easing == command.maskEasing
        case .matteAlpha: return selectedClip?.matte?.mode == .alpha
        case .matteLuma: return selectedClip?.matte?.mode == .luma
        case .matteInvert: return selectedClip?.matte?.inverted == true
        default: return false
        }
    }
    func updateCommands() {
        for (command, buttons) in commandButtons { for button in buttons { button.isEnabled = enabled(command); button.state = checked(command) ? .on : .off } }
        timeline.interactionsEnabled = !busy; mediaSearch.isEnabled = !busy; sequencePicker.isEnabled = !busy
    }
    @objc func invoke(_ sender: AnyObject) {
        let raw = (sender as? NSButton)?.identifier?.rawValue ?? (sender as? NSMenuItem)?.representedObject as? String
        guard let raw, let command = Command(rawValue: raw), enabled(command) else { return }; run(command)
    }
    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool { guard let raw = menuItem.representedObject as? String, let c = Command(rawValue: raw) else { return true }; menuItem.state = checked(c) ? .on : .off; return enabled(c) }
    func fail(_ error: Error) { status.stringValue = error is CancellationError ? "Canceled. Your project and previous output are unchanged." : error.localizedDescription }
    func apply(_ next: Project, forcePreview: Bool = false) {
        let previous = project
        do {
            try history.apply(next)
            let changed = forcePreview || PreviewInputs(previous, sequenceId: activeSequenceId) != PreviewInputs(project, sequenceId: activeSequenceId)
            selectedClipId = sequence.videoClips.contains { $0.id == selectedClipId } ? selectedClipId : nil
            reload(rebuild: changed); journal()
        }
        catch { reload(rebuild: false); fail(error) }
    }
    func reload(rebuild: Bool = true) {
        if !sourceAvailable { sourceMonitor?.reset() }
        if let source = sourceMonitor, let id = source.assetId, let media = project.media.first(where: { $0.id == id }), source.sourcePath != media.path || source.duration != media.duration { source.reset() }
        if !project.sequences.contains(where: { $0.id == activeSequenceId }) { activeSequenceId = project.mainSequenceId }
        if let clip = selectedClip { selectedTrackId = clip.trackId } else { selectedClipId = nil }
        if !sequence.tracks.contains(where: { $0.id == selectedTrackId }) { selectedTrackId = sequence.tracks.last?.id }
        window?.title = "\(project.name) — ScenePilot Native · Migration Preview"; window?.isDocumentEdited = history.dirty
        sequencePicker.removeAllItems(); sequencePicker.addItems(withTitles: project.sequences.map { ($0.id == project.mainSequenceId ? "MAIN · " : "COMP · ") + $0.name })
        sequencePicker.selectItem(at: project.sequences.firstIndex { $0.id == activeSequenceId } ?? 0)
        let selectedLibraryID = librarySelection?.0
        mediaTable.reloadData()
        if let selectedLibraryID, let row = libraryRows.firstIndex(where: { $0.0 == selectedLibraryID }) { mediaTable.selectRowIndexes(IndexSet(integer: row), byExtendingSelection: false) } else { mediaTable.deselectAll(nil) }
        updateSequenceTabs(); timeline.sequence = sequence; timeline.selectedClip = selectedClipId; timeline.selectedTrack = selectedTrackId
        timeline.updateSize(width: timelineScroll.contentSize.width)
        inspectorTitle.stringValue = selectedClip.map(name) ?? "Select a clip"
        let clip = selectedClip
        let transform = clip?.transform ?? ClipTransform()
        let values = ["start":clip?.start,"sourceStart":clip?.sourceStart,"duration":clip?.duration,"rate":clip?.rate,"opacity":clip?.opacity,"gain":clip?.gain,"fadeIn":clip?.fadeIn,"fadeOut":clip?.fadeOut,"exposure":clip?.exposure,"saturation":clip?.saturation,"blur":clip?.blur,"x":clip == nil ? nil : transform.x * 100,"y":clip == nil ? nil : transform.y * 100,"scale":clip == nil ? nil : transform.scale * 100,"rotation":clip == nil ? nil : transform.rotation]
        for (key, field) in fields {
            field.stringValue = values[key].flatMap { $0 }.map { String(format:"%.3f",$0) } ?? ""
            field.isEnabled = clip != nil && selectedTrack?.locked != true && !busy
        }
        updatePosition(); updateMotionInspector(); updateCompositingInspector(); updateCommands(); if rebuild { rebuildPreview() }
    }
    func rebuildPreview() {
        player.pause(); buildTask?.cancel(); previewWaitTask?.cancel(); seekQueue.reset(); built = nil; player.replaceCurrentItem(with: nil)
        let requestId = UUID(); previewBuildId = requestId
        guard sequence.duration > 0 else { status.stringValue = "Import media, select a track, then Add to Track. Native migration preview—not feature-complete Pro."; updateCommands(); return }
        let snapshot = project, id = activeSequenceId
        status.stringValue = "Building native preview…"
        buildTask = Task { [weak self] in
            defer { if self?.previewBuildId == requestId { self?.previewWaitTask?.cancel(); self?.previewWaitTask = nil } }
            do {
                // Collapse rapid inspector/key-repeat edits before opening decoders.
                try await Task.sleep(nanoseconds: 40_000_000); try Task.checkCancellation()
                let result = try await NativeMedia.build(snapshot, sequenceId: id); try Task.checkCancellation()
                guard let self, self.previewBuildId == requestId else { return }; self.built = result; self.player.replaceCurrentItem(with: result.playerItem()); self.seek(min(self.playhead, result.duration)); self.status.stringValue = "Native preview ready · shared Metal/Core Image composition for preview + export"; self.updateCommands()
            } catch { if !Task.isCancelled { self?.fail(error) } }
        }
        previewWaitTask = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 8_000_000_000); try Task.checkCancellation() } catch { return }
            guard let self, self.previewBuildId == requestId, self.built == nil, !self.busy else { return }
            self.status.stringValue = "Preview waiting · Check macOS file-access prompts or relink media, then Retry Preview. No frames have been substituted."
        }
        updateCommands()
    }
    func updatePosition() { position.stringValue = String(format: "%02d:%05.2f / %.2fs", Int(playhead) / 60, playhead.truncatingRemainder(dividingBy: 60), sequence.duration) }
    func seek(_ seconds: Double) {
        guard seconds.isFinite else { return }
        playhead = max(0, min(sequence.duration, seconds)); timeline.playhead = playhead; updatePosition(); updateMotionInspector()
        if built != nil, let ticket = seekQueue.submit(playhead) { performSeek(ticket) }
    }
    func performSeek(_ ticket: LatestSeek.Ticket) {
        player.seek(to: CMTime(seconds: ticket.seconds, preferredTimescale: 600_000), toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                if let next = self.seekQueue.complete(ticket) { self.performSeek(next) }
            }
        }
    }
    @objc func changeSequence() { guard project.sequences.indices.contains(sequencePicker.indexOfSelectedItem) else { return }; activeSequenceId = project.sequences[sequencePicker.indexOfSelectedItem].id; selectedClipId = nil; selectedTrackId = sequence.tracks.last?.id; playhead = 0; reload() }
    @objc func appendSelected() { run(.append) }
    func run(_ command: Command) {
        guard enabled(command) else { return }
        do {
            switch command {
            case .isolateObject: isolateObject()
            case .collectProject: collectProject()
            case .cancelCollection: collectionTask?.cancel()
            case .cancelIsolation: isolationJob?.cancel(); isolationTask?.cancel()
            case .openSource, .sourceIn, .sourceOut, .sourceClear, .sourceInsert, .sourceOverwrite: try runSource(command)
            case .newProject: if mayReplace() { let next = Project(); history = DocumentHistory(next); sequenceViews = [:]; activeSequenceId = next.mainSequenceId; documentURL = nil; selectedClipId = nil; playhead = 0; reload() }
            case .open, .recover: open(recovery: command == .recover)
            case .save, .saveAs: _ = save(asNew: command == .saveAs)
            case .importMedia: importMedia(relink: false)
            case .relink: importMedia(relink: true)
            case .undo: history.undo(); reload(); journal()
            case .redo: history.redo(); reload(); journal()
            case .append:
                guard libraryRows.indices.contains(mediaTable.selectedRow), let track = selectedTrackId else { return }
                let row = libraryRows[mediaTable.selectedRow]
                let duration = project.media.first { $0.id == row.0 }?.duration ?? project.sequences.first { $0.id == row.0 }?.duration ?? 0
                let start = sequence.videoClips.filter { $0.trackId == track }.map { $0.start + $0.duration }.max() ?? 0
                let clip = Clip(assetId: row.2 == "COMP" ? nil : row.0, compositionId: row.2 == "COMP" ? row.0 : nil, trackId: track, start: start, duration: duration)
                let next = try Edit.transact(project, sequenceId: activeSequenceId) { $0.videoClips.append(clip) }; selectedClipId = clip.id; apply(next)
            case .remove: apply(try Edit.transact(project, sequenceId: activeSequenceId) { $0.videoClips.removeAll { $0.id == selectedClipId } })
            case .split: if let id = selectedClipId { apply(try Edit.split(project, sequenceId: activeSequenceId, clipId: id, at: playhead)) }
            case .play: if player.rate != 0 { player.pause() } else { if playhead >= sequence.duration - 0.04 { seek(0) }; player.play() }
            case .retryPreview: rebuildPreview()
            case .maskRectangle, .maskEllipse, .maskBezier, .editMaskPath, .maskInvert, .maskRemove, .matteAlpha, .matteLuma, .matteInvert, .matteRemove: try runCompositing(command)
            case .addMaskKey, .removeMaskKey, .previousMaskKey, .nextMaskKey, .bakeMask, .maskLinear, .maskSmooth, .maskHold: try runMaskAnimation(command)
            case .newComp:
                sequenceViews[activeSequenceId] = (playhead, selectedClipId, selectedTrackId, timeline.pixelsPerSecond)
                var next = project; let comp = ScenePilotCore.Sequence(name: "Composition \(project.sequences.count)", width: sequence.width, height: sequence.height, frameRate: sequence.frameRate)
                next.sequences.append(comp); try history.apply(next); activeSequenceId = comp.id; selectedClipId = nil; selectedTrackId = comp.tracks.last?.id; playhead = 0; reload(); journal()
            case .addTrack: apply(try Edit.transact(project, sequenceId: activeSequenceId) { $0.tracks.insert(Track(name: "Track \($0.tracks.count + 1)"), at: 0) })
            case .removeTrack: if let id = selectedTrackId { apply(try Edit.removeTrack(project, sequenceId: activeSequenceId, trackId: id)) }
            case .trackUp, .trackDown: if let id = selectedTrackId { apply(try Edit.moveTrack(project, sequenceId: activeSequenceId, trackId: id, by: command == .trackUp ? -1 : 1)) }
            case .toggleTrack, .lockTrack:
                apply(try Edit.transact(project, sequenceId: activeSequenceId) { s in if let i = s.tracks.firstIndex(where: { $0.id == selectedTrackId }) { if command == .toggleTrack { s.tracks[i].enabled.toggle() } else { s.tracks[i].locked.toggle() } } })
            case .export: export()
            case .cancelExport: exportTask?.cancel(); exporter.cancel()
            case .reviewLegacy: reviewLegacy()
            case .restoreLegacy: restoreLegacy()
            case .trimHead, .trimTail:
                if let id = selectedClipId { apply(try Edit.trim(project, sequenceId: activeSequenceId, clipId: id, edge: command == .trimHead ? .head : .tail, to: playhead)) }
            case .slipBack, .slipForward:
                if let id = selectedClipId { apply(try Edit.slip(project, sequenceId: activeSequenceId, clipId: id, by: command == .slipBack ? -1 : 1)) }
            case .duplicate: if let id = selectedClipId { apply(try Edit.duplicate(project, sequenceId: activeSequenceId, clipId: id)) }
            case .rippleDelete: if let id = selectedClipId { apply(try Edit.rippleDelete(project, sequenceId: activeSequenceId, clipId: id)) }
            case .rollBack, .rollForward, .slideBack, .slideForward: apply(try adjacentEdit(command))
            case .addMotionKey, .removeMotionKey, .previousMotionKey, .nextMotionKey, .clearMotion, .motionLinear, .motionSmooth, .motionEaseIn, .motionEaseOut, .motionHold: try runMotion(command)
            case .zoomIn, .zoomOut, .zoomFit:
                let zoom = command == .zoomFit ? (timelineScroll.contentSize.width - timeline.labelWidth - 24) / max(1, sequence.duration) : timeline.pixelsPerSecond * (command == .zoomIn ? 1.5 : 1 / 1.5)
                timeline.pixelsPerSecond = min(600, max(0.01, zoom)); timeline.updateSize(width: timelineScroll.contentSize.width); timeline.needsDisplay = true
            case .snapping: timeline.snapping.toggle(); updateCommands()
            case .fit, .fill, .flipH, .flipV, .resetTransform:
                var next = project
                if command == .resetTransform, let clip = selectedClip, clip.motion != nil {
                    let pose = MotionValue(opacity: clip.motionValue(atLocalTime: motionFrameTime - clip.start).opacity)
                    next = try Edit.motionKey(project, sequenceId: activeSequenceId, clipId: clip.id, at: motionFrameTime, value: pose)
                }
                apply(try Edit.transact(next, sequenceId: activeSequenceId) { s in
                    guard let i = s.videoClips.firstIndex(where: { $0.id == selectedClipId }) else { return }
                    var t = s.videoClips[i].transform ?? ClipTransform()
                    switch command { case .fit: t.fill = false; case .fill: t.fill = true; case .flipH: t.flipH.toggle(); case .flipV: t.flipV.toggle(); default: t = ClipTransform() }
                    s.videoClips[i].transform = t
                })
            case .resetWorkspace: resetPanelPositions()
            case .sequenceSettings: editSequenceSettings()
            }
        } catch { fail(error) }
    }
    /// Availability and execution share the exact transaction, including source handles.
    func adjacentEdit(_ command: Command) throws -> Project {
        guard let id = selectedClipId else { throw ProjectError.invalid("Select a clip to roll or slide.") }
        switch command {
        case .rollBack, .rollForward:
            return try Edit.roll(project, sequenceId: activeSequenceId, clipId: id, by: command == .rollBack ? -1 : 1)
        case .slideBack, .slideForward:
            return try Edit.slide(project, sequenceId: activeSequenceId, clipId: id, by: command == .slideBack ? -1 : 1)
        default: throw ProjectError.invalid("Not an adjacent edit command.")
        }
    }
    @objc func applyInspector(_ sender: NSTextField) {
        guard !busy, let clip = selectedClip, selectedTrack?.locked != true, let key = sender.identifier?.rawValue, let value = Double(sender.stringValue), value.isFinite else { reload(rebuild: false); return }
        window?.makeFirstResponder(timeline)
        do {
            if try editAnimatedField(key, value: value, clip: clip) { return }
            if try editMaskField(key, value: value, clip: clip) { return }
            apply(try Edit.transact(project, sequenceId: activeSequenceId) { s in
                guard let i = s.videoClips.firstIndex(where: { $0.id == clip.id }) else { return }
                switch key {
                case "start": s.videoClips[i].start = value
                case "sourceStart": s.videoClips[i].sourceStart = value
                case "duration": s.videoClips[i].duration = value
                case "rate": s.videoClips[i].rate = value
                case "gain": s.videoClips[i].gain = value
                case "opacity": s.videoClips[i].opacity = value
                case "fadeIn": s.videoClips[i].fadeWindow = nil; s.videoClips[i].fadeIn = value; s.videoClips[i].fadeOut = min(s.videoClips[i].fadeOut, max(0, s.videoClips[i].duration - value))
                case "fadeOut": s.videoClips[i].fadeWindow = nil; s.videoClips[i].fadeOut = value; s.videoClips[i].fadeIn = min(s.videoClips[i].fadeIn, max(0, s.videoClips[i].duration - value))
                case "exposure": s.videoClips[i].exposure = value
                case "saturation": s.videoClips[i].saturation = value
                case "blur": s.videoClips[i].blur = value
                case "x", "y", "scale", "rotation":
                    var t = s.videoClips[i].transform ?? ClipTransform()
                    switch key { case "x": t.x = value / 100; case "y": t.y = value / 100; case "scale": t.scale = value / 100; default: t.rotation = value }
                    s.videoClips[i].transform = t
                default: return
                }
            })
        } catch { reload(rebuild: false); fail(error) }
    }
    func moveClip(_ id: String, track: String, time: Double) {
        guard !busy else { return }
        do { let next = try Edit.transact(project, sequenceId: activeSequenceId) { s in guard let i = s.videoClips.firstIndex(where: { $0.id == id }), !s.tracks.contains(where: { ($0.id == track || $0.id == s.videoClips[i].trackId) && $0.locked }) else { throw ProjectError.invalid("Unlock the source and destination tracks first.") }; s.videoClips[i].trackId = track; s.videoClips[i].start = time }; selectedTrackId = track; apply(next) } catch { fail(error) }
    }
    func importMedia(relink: Bool) {
        let target = relink ? librarySelection?.0 : nil
        let panel = NSOpenPanel(); panel.allowsMultipleSelection = !relink; panel.canChooseDirectories = false
        panel.message = relink ? "Choose the original source or a compatible replacement." : "Import local video or audio. Images and camera RAW are not yet supported by the native build."
        guard panel.runModal() == .OK else { return }
        busy = true; reload(rebuild: false); status.stringValue = "Inspecting media natively…"
        Task { [weak self] in
            guard let self else { return }
            defer { self.busy = false; self.reload(rebuild: false) }
            do {
                var next = self.project
                for url in panel.urls {
                    var media = try await NativeMedia.inspect(url)
                    if let target, let index = next.media.firstIndex(where: { $0.id == target }) {
                        guard media.hasVideo == next.media[index].hasVideo && media.hasAudio == next.media[index].hasAudio else { throw ProjectError.invalid("Replacement stream types do not match the original media.") }
                        media.id = target; next.media[index] = media
                    } else if !next.media.contains(where: { $0.path == media.path }) { next.media.append(media) }
                }
                _ = try next.validated(); self.apply(next, forcePreview: relink); self.status.stringValue = "Media ready. Select it in Project Media and choose Add to Track."
            } catch { self.fail(error) }
        }
    }
    func save(asNew: Bool = false) -> Bool {
        var target = asNew ? nil : documentURL
        if target == nil {
            let panel = NSSavePanel(); panel.nameFieldStringValue = project.name + ".scenepilot-native.json"; panel.message = "Native migration project. Existing Electron projects use a different format and are not overwritten."
            guard panel.runModal() == .OK, let url = panel.url else { return false }; target = url
        }
        do { let snapshot = project; try ProjectStore.save(snapshot, to: target!); documentURL = target; history.markSaved(snapshot); reload(rebuild: false); status.stringValue = "Saved atomically: \(target!.lastPathComponent)"; return true } catch { fail(error); return false }
    }
    func mayReplace() -> Bool {
        guard !busy else { status.stringValue = "Finish or cancel the current operation first."; return false }
        guard history.dirty else { return true }
        let alert = NSAlert(); alert.messageText = "Save changes to \(project.name)?"; alert.informativeText = "Unsaved edits will be lost if you discard them."
        alert.addButton(withTitle: "Save"); alert.addButton(withTitle: "Discard"); alert.addButton(withTitle: "Cancel")
        switch alert.runModal() { case .alertFirstButtonReturn: return save(); case .alertSecondButtonReturn: return true; default: return false }
    }
    var recoveryRoot: URL { FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("ScenePilot Native/Recovery", isDirectory: true) }
    func open(recovery: Bool) {
        guard mayReplace() else { return }
        let panel = NSOpenPanel(); panel.canChooseDirectories = false; panel.allowsMultipleSelection = false
        if recovery { panel.directoryURL = recoveryRoot; panel.message = "Choose a native recovery journal. Save As a new document after inspecting it." }
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            let loaded = try ProjectStore.load(url)
            history = DocumentHistory(recovery ? Project() : loaded); sequenceViews = [:]
            if recovery { try history.apply(loaded) }
            documentURL = recovery ? nil : url; activeSequenceId = loaded.mainSequenceId; selectedClipId = nil; playhead = 0; reload()
        } catch { fail(error) }
    }
    func journal() {
        journalTask?.cancel(); let snapshot = project, root = recoveryRoot
        journalTask = Task { [weak self] in
            do {
                try await Task.sleep(nanoseconds: 500_000_000); try Task.checkCancellation()
                try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
                try ProjectStore.save(snapshot, to: root.appendingPathComponent(snapshot.id + ".scenepilot-native.json"))
            } catch { if !Task.isCancelled { self?.status.stringValue = "Autosave failed: \(error.localizedDescription). Save manually." } }
        }
    }
    func export() {
        let panel = NSSavePanel(); panel.nameFieldStringValue = sequence.name + ".mp4"; panel.allowedContentTypes = [.mpeg4Movie]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        busy = true; player.pause(); reload(rebuild: false)
        let snapshot = project, id = activeSequenceId
        exportTask = Task { [weak self] in
            guard let self else { return }
            defer { self.progressTask?.cancel(); self.progressTask = nil; self.exportProgress.isHidden = true; self.busy = false; self.exportTask = nil; self.reload(rebuild: false) }
            do {
                self.status.stringValue = "Preparing native export…"
                let result = try await NativeMedia.build(snapshot, sequenceId: id); try Task.checkCancellation()
                self.status.stringValue = "Exporting with the same native compositor used by preview…"
                self.exportProgress.doubleValue = 0; self.exportProgress.isHidden = false
                self.progressTask = Task { [weak self] in
                    while !Task.isCancelled {
                        self?.exportProgress.doubleValue = Double(self?.exporter.progress ?? 0)
                        do { try await Task.sleep(nanoseconds: 200_000_000) } catch { break }
                    }
                }
                try await self.exporter.export(result, to: url)
                self.status.stringValue = "Export complete: \(url.path)"
                NSWorkspace.shared.activateFileViewerSelecting([url])
            } catch { self.fail(error) }
        }
        updateCommands()
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool { closeApproved = mayReplace(); return closeApproved }
    func windowDidResize(_ notification: Notification) { timeline.updateSize(width: timelineScroll.contentSize.width) }
}
