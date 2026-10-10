import AppKit
import ScenePilotCore

@MainActor extension EditorController {
    var motionFrameTime: Double { (playhead * Double(sequence.frameRate)).rounded() / Double(sequence.frameRate) }
    var canEditMotion: Bool {
        guard !busy, let clip = selectedClip, selectedTrack?.locked == false,
              clip.compositionId != nil || project.media.contains(where: { $0.id == clip.assetId && $0.hasVideo }) else { return false }
        let local = motionFrameTime - clip.start
        return local >= -0.00001 && local < clip.duration - 0.00001
    }
    var currentMotionKey: MotionKeyframe? {
        guard let clip = selectedClip else { return nil }
        let time = clip.motionKeyTime(at: playhead, frameRate: sequence.frameRate)
        return clip.motion?.keyframes.first { abs($0.time - time) < 0.00001 }
    }
    func neighboringMotionKey(forward: Bool) -> Double? {
        guard let clip = selectedClip, let motion = clip.motion else { return nil }
        let times = motion.keyframes.map { clip.start + $0.time - motion.offset }.filter { $0 >= clip.start - 0.00001 && $0 < clip.start + clip.duration - 0.00001 }
        return forward ? times.first { $0 > motionFrameTime + 0.00001 } : times.last { $0 < motionFrameTime - 0.00001 }
    }
    func runMotion(_ command: Command) throws {
        guard let clip = selectedClip else { return }
        window?.makeFirstResponder(timeline)
        switch command {
        case .previousMotionKey, .nextMotionKey:
            if let time = neighboringMotionKey(forward: command == .nextMotionKey) { player.pause(); seek(time) }
        case .clearMotion:
            apply(try Edit.clearMotion(project, sequenceId: activeSequenceId, clipId: clip.id, at: motionFrameTime))
        default:
            player.pause()
            apply(try Edit.motionKey(project, sequenceId: activeSequenceId, clipId: clip.id, at: motionFrameTime, easing: command.motionEasing, remove: command == .removeMotionKey))
        }
    }
    /// Seek/playback update only contextual motion values, never rebuild the scene.
    /// Leave AppKit's active text editor alone while the user types.
    func updateMotionInspector() {
        updateMaskAnimationInspector()
        for command in [Command.addMotionKey, .removeMotionKey, .previousMotionKey, .nextMotionKey, .clearMotion, .resetTransform, .split] {
            for button in commandButtons[command] ?? [] { button.isEnabled = enabled(command) }
        }
        let clip = selectedClip, key = currentMotionKey
        motionStatus.stringValue = clip?.motion.map { "\($0.keyframes.count) keys · \(key == nil ? "between keys" : "on key")" } ?? "Static · add a key to animate"
        motionEasingPicker.isEnabled = canEditMotion && key != nil
        motionEasingPicker.selectItem(withTitle: key.map { easingTitle($0.easing) } ?? "Linear")
        if let field = fields["motionTime"] {
            if field.currentEditor() == nil { field.stringValue = key.map { String(format: "%.3f", (clip?.start ?? 0) + $0.time - (clip?.motion?.offset ?? 0)) } ?? "" }
            field.isEnabled = canEditMotion && key != nil
        }
        if let clip, clip.motion != nil {
            let value = clip.motionValue(atLocalTime: motionFrameTime - clip.start)
            for (name, number) in ["x":value.x * 100,"y":value.y * 100,"scale":value.scale * 100,"rotation":value.rotation,"opacity":value.opacity] {
                guard let field = fields[name] else { continue }
                if field.currentEditor() == nil { field.stringValue = String(format: "%.3f", number) }
                field.isEnabled = canEditMotion
            }
        }
    }
    func easingTitle(_ easing: MotionEasing) -> String {
        Command.allCases.first { $0.motionEasing == easing }!.title
    }
    func buildMotionControls(in inspector: NSStackView) {
        inspector.addArrangedSubview(label("MOTION KEYFRAMES"))
        inspector.addArrangedSubview(NSStackView(views: [iconButton(.previousMotionKey), iconButton(.addMotionKey), iconButton(.removeMotionKey), iconButton(.nextMotionKey)]))
        motionStatus.font = .systemFont(ofSize: 11); motionStatus.textColor = .secondaryLabelColor
        inspector.addArrangedSubview(motionStatus)
        let time = NSTextField(string: ""); time.identifier = NSUserInterfaceItemIdentifier("motionTime")
        time.target = self; time.action = #selector(applyInspector); time.cell?.sendsActionOnEndEditing = false
        time.widthAnchor.constraint(equalToConstant: 80).isActive = true; time.setAccessibilityLabel("Motion key timeline time (s)")
        fields["motionTime"] = time
        inspector.addArrangedSubview(NSStackView(views: [label("KEY TIME (s)"), time]))
        motionEasingPicker.setAccessibilityLabel("Outgoing motion easing")
        for command in Command.allCases where command.motionEasing != nil {
            motionEasingPicker.addItem(withTitle: command.title)
            let item = motionEasingPicker.lastItem!; item.target = self; item.action = #selector(invoke(_:)); item.representedObject = command.rawValue
        }
        inspector.addArrangedSubview(NSStackView(views: [label("OUTGOING"), motionEasingPicker]))
        inspector.addArrangedSubview(button(.clearMotion))
        let help = NSTextField(wrappingLabelWithString: "Add a key, seek, then edit transform or opacity. Drag yellow timeline diamonds or edit Key Time to retime. Keys store all five channels. Bake holds the current pose.")
        help.font = .systemFont(ofSize: 11); help.textColor = .secondaryLabelColor
        help.widthAnchor.constraint(equalToConstant: 230).isActive = true; inspector.addArrangedSubview(help)
    }
    func editAnimatedField(_ key: String, value: Double, clip: Clip) throws -> Bool {
        if key == "motionTime", let current = currentMotionKey {
            try retimeMotionKey(clip.id, keyTime: current.time, to: value); return true
        }
        guard clip.motion != nil, ["x","y","scale","rotation","opacity"].contains(key) else { return false }
        var pose = clip.motionValue(atLocalTime: motionFrameTime - clip.start)
        switch key { case "x": pose.x = value / 100; case "y": pose.y = value / 100; case "scale": pose.scale = value / 100; case "rotation": pose.rotation = value; default: pose.opacity = value }
        player.pause()
        apply(try Edit.motionKey(project, sequenceId: activeSequenceId, clipId: clip.id, at: motionFrameTime, value: pose))
        return true
    }
    func retimeMotionKey(_ clipId: String, keyTime: Double, to time: Double) throws {
        let next = try Edit.moveMotionKey(project, sequenceId: activeSequenceId, clipId: clipId, keyTime: keyTime, to: time)
        player.pause(); playhead = (time * Double(sequence.frameRate)).rounded() / Double(sequence.frameRate)
        timeline.playhead = playhead; apply(next)
    }
}
