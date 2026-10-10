import AppKit
import AVKit
import ScenePilotCore

final class InspectorStack: NSStackView { override var isFlipped: Bool { true } }

/// Layout and panel construction only. Editing and media operations stay outside the shell.
@MainActor extension EditorController {
    func iconButton(_ command: Command) -> NSButton {
        let control = button(command)
        if let symbol = command.symbol, let image = NSImage(systemSymbolName: symbol, accessibilityDescription: command.title) {
            control.image = image; control.imagePosition = .imageOnly
            control.widthAnchor.constraint(equalToConstant: 30).isActive = true
        }
        control.setAccessibilityLabel(command.title)
        return control
    }
    func setup() {
        guard let content = window?.contentView else { return }
        let savedLayout = WorkspaceLayout.restore(UserDefaults.standard.data(forKey: "Native.Workspace.v1"))
        let root = NSStackView(); root.orientation = .vertical; root.spacing = 0; root.alignment = .leading
        fill(root, in: content)
        let brand = label("SCENEPILOT  /  NATIVE")
        brand.textColor = .labelColor
        let spring = NSView(); spring.setContentHuggingPriority(.defaultLow, for: .horizontal)
        let toolbar = NSStackView(views: [brand, iconButton(.open), iconButton(.save), button(.importMedia), iconButton(.undo), iconButton(.redo), spring, label("MIGRATION PREVIEW"), button(.export), iconButton(.cancelExport)])
        toolbar.edgeInsets = NSEdgeInsets(top: 8, left: 12, bottom: 8, right: 12); toolbar.spacing = 8
        root.addArrangedSubview(toolbar)
        toolbar.heightAnchor.constraint(equalToConstant: 42).isActive = true
        horizontalPanels.isVertical = true; horizontalPanels.dividerStyle = .thin

        let mediaColumn = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("name")); mediaColumn.width = 210
        mediaTable.addTableColumn(mediaColumn); mediaTable.headerView = nil; mediaTable.rowHeight = 42
        mediaTable.dataSource = self; mediaTable.delegate = self; mediaTable.allowsMultipleSelection = false
        mediaTable.setDraggingSourceOperationMask(.copy, forLocal: true)
        mediaTable.target = self; mediaTable.doubleAction = #selector(appendSelected)
        mediaTable.contextMenuForSelection = { [weak self] in
            self?.contextMenu([[.openSource, .append, .relink], [.importMedia, .newComp]]) ?? NSMenu()
        }
        mediaTable.setAccessibilityLabel("Project media and compositions")
        mediaSearch.placeholderString = "Search media & compositions"; mediaSearch.target = self; mediaSearch.action = #selector(searchMedia)
        mediaSearch.sendsSearchStringImmediately = true
        let mediaScroll = NSScrollView(); mediaScroll.documentView = mediaTable; mediaScroll.hasVerticalScroller = true
        mediaScroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 100).isActive = true
        let mediaHelp = NSTextField(wrappingLabelWithString: "Drag media or a comp onto a track, or double-click to append. New compositions inherit the sequence settings.")
        mediaHelp.font = .systemFont(ofSize: 11); mediaHelp.textColor = .secondaryLabelColor
        let mediaPanel = vertical([label(Panel.media.title), mediaSearch, NSStackView(views: [button(.importMedia), iconButton(.newComp)]), mediaScroll, button(.openSource), button(.append), button(.relink), mediaHelp, button(.reviewLegacy)])
        for view in [mediaSearch, mediaScroll, mediaHelp] { view.widthAnchor.constraint(equalTo: mediaPanel.widthAnchor, constant: -24).isActive = true }
        mediaPanel.widthAnchor.constraint(greaterThanOrEqualToConstant: 218).isActive = true
        mediaPanel.widthAnchor.constraint(lessThanOrEqualToConstant: 400).isActive = true
        horizontalPanels.addArrangedSubview(mediaPanel)

        viewer.player = player; viewer.controlsStyle = .none; viewer.videoGravity = .resizeAspect
        viewer.setAccessibilityLabel("Native program viewer")
        sequenceInfo.font = .monospacedSystemFont(ofSize: 11, weight: .regular); sequenceInfo.textColor = .secondaryLabelColor
        let transport = NSStackView(views: [iconButton(.play), position, iconButton(.split), iconButton(.retryPreview)])
        let middle = vertical([label(Panel.viewer.title), sequenceInfo, viewer, transport])
        viewer.widthAnchor.constraint(equalTo: middle.widthAnchor, constant: -24).isActive = true
        viewer.heightAnchor.constraint(greaterThanOrEqualToConstant: 160).isActive = true
        middle.widthAnchor.constraint(greaterThanOrEqualToConstant: 310).isActive = true
        horizontalPanels.addArrangedSubview(middle)

        let inspector = InspectorStack(views: [label(Panel.inspector.title), inspectorTitle])
        inspector.orientation = .vertical; inspector.alignment = .leading; inspector.spacing = 8
        inspector.edgeInsets = NSEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
        func section(_ title: String, _ entries: [(String, String)]) {
            inspector.addArrangedSubview(label(title))
            for (key, name) in entries {
                let field = NSTextField(string: ""); field.identifier = NSUserInterfaceItemIdentifier(key); field.target = self; field.action = #selector(applyInspector)
                // Explicit Return commits once. A later focus change must not replay
                // the old value against a different selected clip or animation frame.
                field.cell?.sendsActionOnEndEditing = false
                field.setAccessibilityLabel(name); field.widthAnchor.constraint(equalToConstant: 80).isActive = true
                fields[key] = field
                let nameView = label(name); nameView.widthAnchor.constraint(equalToConstant: 132).isActive = true
                let row = NSStackView(views: [nameView, field]); row.spacing = 8; inspector.addArrangedSubview(row)
            }
        }
        section("TIMING", [("start","Timeline start (s)"),("sourceStart","Source in (s)"),("duration","Duration (s)"),("rate","Speed ×")])
        inspector.addArrangedSubview(NSStackView(views: [button(.trimHead), button(.trimTail)]))
        inspector.addArrangedSubview(NSStackView(views: [label("ROLL OUT"), iconButton(.rollBack), iconButton(.rollForward)]))
        inspector.addArrangedSubview(NSStackView(views: [label("SLIDE CLIP"), iconButton(.slideBack), iconButton(.slideForward)]))
        buildMotionControls(in: inspector)
        section("TRANSFORM", [("x","Position X (frame %)"),("y","Position Y (frame %)"),("scale","Scale (%)"),("rotation","Rotation (°)")])
        inspector.addArrangedSubview(NSStackView(views: [button(.fit), button(.fill)]))
        inspector.addArrangedSubview(NSStackView(views: [button(.flipH), button(.flipV)]))
        inspector.addArrangedSubview(button(.resetTransform))
        section("PICTURE & SOUND", [("opacity","Opacity 0–1"),("gain","Audio gain 0–4"),("fadeIn","Fade in (s)"),("fadeOut","Fade out (s)"),("exposure","Exposure −4–4"),("saturation","Saturation 0–3"),("blur","Blur 0–100")])
        buildCompositingControls(in: inspector)
        inspector.addArrangedSubview(button(.isolateObject)); inspector.addArrangedSubview(button(.cancelIsolation))
        section("MASK GEOMETRY", [("maskX","Mask center X (%)"),("maskY","Mask center Y (%)"),("maskWidth","Mask width (%)"),("maskHeight","Mask height (%)"),("maskFeather","Mask feather (px)")])
        let help = NSTextField(wrappingLabelWithString: "Return applies one undoable edit. Add a mask key, seek, then edit geometry or the Bezier path to animate. Bake before changing shape type or vertex count. Group fades affect picture and sound; opacity keys affect picture only. Matte sources are hidden visually, not muted.")
        help.font = .systemFont(ofSize: 11); help.textColor = .secondaryLabelColor
        inspector.addArrangedSubview(help); help.widthAnchor.constraint(equalToConstant: 230).isActive = true
        let inspectorScroll = NSScrollView(); inspectorScroll.documentView = inspector; inspectorScroll.hasVerticalScroller = true
        inspector.translatesAutoresizingMaskIntoConstraints = false
        inspector.widthAnchor.constraint(equalTo: inspectorScroll.contentView.widthAnchor).isActive = true
        inspectorScroll.widthAnchor.constraint(greaterThanOrEqualToConstant: 264).isActive = true
        inspectorScroll.widthAnchor.constraint(lessThanOrEqualToConstant: 290).isActive = true
        horizontalPanels.addArrangedSubview(inspectorScroll)

        verticalPanels.isVertical = false; verticalPanels.dividerStyle = .thin
        verticalPanels.addArrangedSubview(horizontalPanels)
        timelineScroll.documentView = timeline; timelineScroll.hasVerticalScroller = true; timelineScroll.hasHorizontalScroller = true
        sequenceTabs.orientation = .horizontal; sequenceTabs.spacing = 4
        let tabScroll = NSScrollView(); tabScroll.documentView = sequenceTabs; tabScroll.hasHorizontalScroller = true
        sequenceTabs.translatesAutoresizingMaskIntoConstraints = false
        sequenceTabs.heightAnchor.constraint(equalToConstant: 30).isActive = true
        tabScroll.heightAnchor.constraint(equalToConstant: 38).isActive = true
        let tabRow = NSStackView(views: [tabScroll, iconButton(.newComp), button(.sequenceSettings)])
        let trackTools = NSStackView(views: [label("TRACKS"), iconButton(.addTrack), iconButton(.removeTrack), iconButton(.trackUp), iconButton(.trackDown), iconButton(.toggleTrack), iconButton(.lockTrack), label("EDIT"), iconButton(.split), button(.duplicate), button(.snapping), iconButton(.zoomOut), iconButton(.zoomFit), iconButton(.zoomIn)])
        trackTools.spacing = 6
        let timelinePanel = vertical([tabRow, trackTools, timelineScroll])
        timelinePanel.heightAnchor.constraint(greaterThanOrEqualToConstant: 230).isActive = true
        for view in [tabRow, timelineScroll] { view.widthAnchor.constraint(equalTo: timelinePanel.widthAnchor, constant: -24).isActive = true }
        timelineScroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 130).isActive = true
        verticalPanels.addArrangedSubview(timelinePanel); root.addArrangedSubview(verticalPanels)
        verticalPanels.heightAnchor.constraint(equalTo: root.heightAnchor, constant: -72).isActive = true
        status.font = .systemFont(ofSize: 11); status.lineBreakMode = .byTruncatingMiddle
        let footer = NSStackView(views: [status, exportProgress]); footer.edgeInsets = NSEdgeInsets(top: 6, left: 12, bottom: 6, right: 12)
        exportProgress.isIndeterminate = false; exportProgress.minValue = 0; exportProgress.maxValue = 1; exportProgress.isHidden = true
        exportProgress.widthAnchor.constraint(equalToConstant: 130).isActive = true
        root.addArrangedSubview(footer)
        for view in [toolbar, verticalPanels, footer] { view.widthAnchor.constraint(equalTo: root.widthAnchor).isActive = true }
        footer.heightAnchor.constraint(equalToConstant: 30).isActive = true

        timeline.onSelect = { [weak self] clip, track in self?.selectedClipId = clip; self?.selectedTrackId = track; self?.reload(rebuild: false) }
        timeline.contextMenuForSelection = { [weak self] hasClip in
            self?.contextMenu(hasClip
                ? [[.split, .duplicate, .trimHead, .trimTail], [.slipBack, .slipForward, .rollBack, .rollForward, .slideBack, .slideForward], [.addMotionKey, .removeMotionKey, .previousMotionKey, .nextMotionKey, .clearMotion], [.fit, .fill, .flipH, .flipV, .resetTransform], [.maskRectangle, .maskEllipse, .maskBezier, .editMaskPath, .maskInvert, .maskRemove], [.addMaskKey, .removeMaskKey, .bakeMask], [.matteAlpha, .matteLuma, .matteInvert, .matteRemove], [.remove, .rippleDelete]]
                : [[.addTrack, .toggleTrack, .lockTrack], [.trackUp, .trackDown, .removeTrack], [.newComp, .sequenceSettings]]) ?? NSMenu()
        }
        timeline.onSeek = { [weak self] time in self?.player.pause(); self?.seek(time) }
        timeline.onMoveMotionKey = { [weak self] id, keyTime, target in
            guard let self, !self.busy else { return }
            do { try self.retimeMotionKey(id, keyTime: keyTime, to: target) } catch { self.fail(error) }
        }
        timeline.onMove = { [weak self] id, track, time in self?.moveClip(id, track: track, time: time) }
        timeline.canDrop = { [weak self] id in
            guard let self else { return false }
            return self.project.media.contains { $0.id == id } || self.project.sequences.contains { $0.id == id && id != self.activeSequenceId && $0.duration > 0 }
        }
        timeline.onDrop = { [weak self] id, track, time in self?.dropLibraryItem(id, track: track, time: time) ?? false }
        timeline.onTrim = { [weak self] id, edge, time in
            guard let self, !self.busy else { return }
            do { self.apply(try Edit.trim(self.project, sequenceId: self.activeSequenceId, clipId: id, edge: edge, to: time)) } catch { self.fail(error) }
        }
        timeline.onDelete = { [weak self] in self?.run(.remove) }; timeline.onPlay = { [weak self] in self?.run(.play) }
        timeline.clipName = { [weak self] clip in self?.name(for: clip) ?? "Clip" }
        playerObserver = player.addPeriodicTimeObserver(forInterval: CMTime(value: 1, timescale: 30), queue: .main) { [weak self] time in
            MainActor.assumeIsolated {
                guard let self, time.seconds.isFinite, !self.seekQueue.isSeeking, self.player.rate != 0 else { return }
                self.playhead = time.seconds; self.timeline.playhead = time.seconds; self.updatePosition(); self.updateMotionInspector()
            }
        }
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            content.layoutSubtreeIfNeeded()
            self.applyPanelLayout(savedLayout)
            content.layoutSubtreeIfNeeded(); self.timeline.updateSize(width: self.timelineScroll.contentSize.width)
            self.workspaceReady = true
            NotificationCenter.default.addObserver(self, selector: #selector(self.panelsDidResize), name: NSSplitView.didResizeSubviewsNotification, object: self.horizontalPanels)
            NotificationCenter.default.addObserver(self, selector: #selector(self.panelsDidResize), name: NSSplitView.didResizeSubviewsNotification, object: self.verticalPanels)
            self.panelsDidResize()
        }
    }
    func resetPanelPositions() {
        applyPanelLayout(WorkspaceLayout()); panelsDidResize()
    }
    func applyPanelLayout(_ layout: WorkspaceLayout) {
        let p = layout.positions(width: horizontalPanels.bounds.width, height: verticalPanels.bounds.height)
        horizontalPanels.setPosition(p.left, ofDividerAt: 0)
        horizontalPanels.setPosition(p.right, ofDividerAt: 1)
        verticalPanels.setPosition(p.top, ofDividerAt: 0)
    }
    @objc func panelsDidResize() {
        guard workspaceReady, horizontalPanels.arrangedSubviews.count == 3, verticalPanels.bounds.height > 0 else { return }
        var layout = WorkspaceLayout()
        layout.mediaWidth = horizontalPanels.arrangedSubviews[0].frame.width
        layout.inspectorWidth = horizontalPanels.arrangedSubviews[2].frame.width
        layout.upperFraction = horizontalPanels.frame.height / verticalPanels.bounds.height
        if let data = try? JSONEncoder().encode(layout) { UserDefaults.standard.set(data, forKey: "Native.Workspace.v1") }
        timeline.updateSize(width: timelineScroll.contentSize.width)
    }
    func updateSequenceTabs() {
        for view in sequenceTabs.arrangedSubviews { sequenceTabs.removeArrangedSubview(view); view.removeFromSuperview() }
        for sequence in project.sequences {
            let tab = NSButton(title: (sequence.id == project.mainSequenceId ? "MAIN · " : "COMP · ") + sequence.name, target: self, action: #selector(selectSequenceTab(_:)))
            tab.identifier = NSUserInterfaceItemIdentifier(sequence.id); tab.bezelStyle = .rounded; tab.setButtonType(.toggle)
            tab.state = sequence.id == activeSequenceId ? .on : .off; tab.isEnabled = !busy
            tab.setAccessibilityLabel(tab.title); sequenceTabs.addArrangedSubview(tab)
        }
        sequenceInfo.stringValue = "\(sequence.width) × \(sequence.height)  ·  \(sequence.frameRate) fps  ·  SDR / sRGB"
    }
    @objc func selectSequenceTab(_ sender: NSButton) {
        guard !busy, let id = sender.identifier?.rawValue, id != activeSequenceId else { return }
        sequenceViews[activeSequenceId] = (playhead, selectedClipId, selectedTrackId, timeline.pixelsPerSecond)
        activeSequenceId = id
        let view = sequenceViews[id]
        playhead = view?.0 ?? 0; selectedClipId = view?.1; selectedTrackId = view?.2 ?? sequence.tracks.last?.id; timeline.pixelsPerSecond = view?.3 ?? 70
        reload()
    }
    @objc func searchMedia() { mediaTable.deselectAll(nil); mediaTable.reloadData(); updateCommands() }
}
