import AppKit
import ScenePilotCore

@MainActor extension EditorController {
    var canEditPicture: Bool {
        guard !busy, let clip = selectedClip, selectedTrack?.locked == false else { return false }
        return clip.compositionId != nil || project.media.contains { $0.id == clip.assetId && $0.hasVideo }
    }
    func runCompositing(_ command: Command) throws {
        guard let clip = selectedClip else { return }
        window?.makeFirstResponder(timeline)
        var mask = evaluatedMask, matte = clip.matte
        switch command {
        case .editMaskPath:
            guard let mask else { return }
            player.pause()
            if let value = BezierPathEditor(mask:mask,animated:clip.maskAnimation != nil).edit() {
                apply(try Edit.mask(project,sequenceId:activeSequenceId,clipId:clip.id,value:value,at:motionFrameTime))
            }
            return
        case .maskBezier: mask = (mask ?? ClipMask(shape:.rectangle)).convertedToBezier()
        case .maskRectangle, .maskEllipse:
            let shape: ClipMask.Shape = command == .maskRectangle ? .rectangle : .ellipse
            if mask == nil { mask = ClipMask(shape: shape) } else { mask?.shape = shape; mask?.points = nil }
        case .maskInvert: mask?.inverted.toggle()
        case .maskRemove: mask = nil
        case .matteAlpha: matte?.mode = .alpha
        case .matteLuma: matte?.mode = .luma
        case .matteInvert: matte?.inverted.toggle()
        case .matteRemove: matte = nil
        default: return
        }
        if [.maskRectangle,.maskEllipse,.maskBezier,.maskInvert,.maskRemove].contains(command) {
            apply(try Edit.mask(project, sequenceId: activeSequenceId, clipId: clip.id, value: mask, at:motionFrameTime))
        } else { apply(try Edit.matte(project, sequenceId: activeSequenceId, clipId: clip.id, value: matte)) }
    }
    @objc func chooseMatte(_ sender: NSPopUpButton) {
        guard canEditPicture, let clip = selectedClip else { return }
        let id = sender.selectedItem?.representedObject as? String
        window?.makeFirstResponder(timeline)
        do {
            let value = id.map { ClipMatte(sourceClipId: $0, mode: clip.matte?.mode ?? .alpha, inverted: clip.matte?.inverted ?? false) }
            apply(try Edit.matte(project, sequenceId: activeSequenceId, clipId: clip.id, value: value))
        } catch { reload(rebuild: false); fail(error) }
    }
    func buildCompositingControls(in inspector: NSStackView) {
        func commands(_ picker: NSPopUpButton, label text: String, items: [Command]) {
            picker.setAccessibilityLabel(text)
            for command in items {
                picker.addItem(withTitle: command.title)
                let item = picker.lastItem!; item.target = self; item.action = #selector(invoke(_:)); item.representedObject = command.rawValue
            }
            inspector.addArrangedSubview(picker)
        }
        inspector.addArrangedSubview(label("MASKS & MATTES"))
        commands(maskPicker, label: "Shape mask", items: [.maskRemove,.maskRectangle,.maskEllipse,.maskBezier])
        maskPicker.item(at: 0)?.title = "No shape mask"
        inspector.addArrangedSubview(button(.maskInvert))
        buildMaskAnimationControls(in:inspector)
        mattePicker.target = self; mattePicker.action = #selector(chooseMatte(_:)); mattePicker.setAccessibilityLabel("Matte source clip")
        mattePicker.widthAnchor.constraint(equalToConstant: 230).isActive = true
        inspector.addArrangedSubview(label("MATTE SOURCE · SAME SEQUENCE")); inspector.addArrangedSubview(mattePicker)
        commands(matteModePicker, label: "Track matte channel", items: [.matteAlpha,.matteLuma])
        inspector.addArrangedSubview(button(.matteInvert)); inspector.addArrangedSubview(button(.matteRemove))
    }
    func updateCompositingInspector() {
        let clip = selectedClip
        maskPicker.isEnabled = canEditPicture
        matteModePicker.isEnabled = canEditPicture && clip?.matte != nil
        matteModePicker.selectItem(at: clip?.matte?.mode == .luma ? 1 : 0)
        mattePicker.removeAllItems(); mattePicker.addItem(withTitle: "None")
        if let clip {
            let byID = Dictionary(uniqueKeysWithValues: sequence.videoClips.map { ($0.id, $0) })
            let video = Set(project.media.filter(\.hasVideo).map(\.id))
            for source in sequence.videoClips where source.id != clip.id {
                guard source.compositionId != nil || source.assetId.map(video.contains) == true else { continue }
                // Bounded dependency traversal; do not revalidate/copy the whole project
                // for every menu item on each selection or scrub.
                var cursor: Clip? = source, visited: Set<String> = [clip.id], safe = true
                while let current = cursor {
                    if visited.contains(current.id) || visited.count >= 32 { safe = false; break }
                    visited.insert(current.id); cursor = current.matte.flatMap { byID[$0.sourceClipId] }
                }
                guard safe else { continue }
                let track = sequence.tracks.first { $0.id == source.trackId }?.name ?? "Track"
                mattePicker.addItem(withTitle: "\(track) · \(name(for: source)) · \(String(format: "%.2fs", source.start)) · \(source.id.prefix(6))")
                mattePicker.lastItem?.representedObject = source.id
            }
        }
        if let index = mattePicker.itemArray.firstIndex(where: { ($0.representedObject as? String) == clip?.matte?.sourceClipId }) { mattePicker.selectItem(at: index) }
        mattePicker.isEnabled = canEditPicture
        updateMaskAnimationInspector()
    }
    func editMaskField(_ key: String, value: Double, clip: Clip) throws -> Bool {
        guard key.hasPrefix("mask"), var mask = evaluatedMask else { return false }
        switch key {
        case "maskX": mask.x = value / 100
        case "maskY": mask.y = value / 100
        case "maskWidth": mask.width = value / 100
        case "maskHeight": mask.height = value / 100
        case "maskFeather": mask.feather = value
        default: return false
        }
        apply(try Edit.mask(project, sequenceId: activeSequenceId, clipId: clip.id, value: mask, at:motionFrameTime)); return true
    }
}
