import AppKit
import ScenePilotCore

extension Command {
    var maskEasing: MotionEasing? {
        switch self { case .maskLinear:return .linear; case .maskSmooth:return .smooth; case .maskHold:return .hold; default:return nil }
    }
}
@MainActor extension EditorController {
    var evaluatedMask: ClipMask? { selectedClip.flatMap { $0.maskValue(atLocalTime:motionFrameTime-$0.start) } }
    var canEditMask: Bool { canEditPicture && (selectedClip?.maskAnimation == nil || canEditMotion) }
    var currentMaskKey: MaskKeyframe? {
        guard let clip = selectedClip else { return nil }
        let time = clip.maskKeyTime(at:playhead,frameRate:sequence.frameRate)
        return clip.maskAnimation?.keyframes.first { abs($0.time-time) < 0.00001 }
    }
    func neighboringMaskKey(forward: Bool) -> Double? {
        guard let clip = selectedClip, let animation = clip.maskAnimation else { return nil }
        let times = animation.keyframes.map { clip.start+$0.time-animation.offset }.filter { $0 >= clip.start-0.00001 && $0 < clip.start+clip.duration-0.00001 }
        return forward ? times.first { $0 > motionFrameTime+0.00001 } : times.last { $0 < motionFrameTime-0.00001 }
    }
    func runMaskAnimation(_ command:Command) throws {
        guard let clip = selectedClip else { return }; window?.makeFirstResponder(timeline); player.pause()
        if command == .previousMaskKey || command == .nextMaskKey { if let time = neighboringMaskKey(forward:command == .nextMaskKey) { seek(time) }; return }
        if command == .bakeMask { apply(try Edit.bakeMask(project,sequenceId:activeSequenceId,clipId:clip.id,at:motionFrameTime)); return }
        apply(try Edit.maskKey(project,sequenceId:activeSequenceId,clipId:clip.id,at:motionFrameTime,easing:command.maskEasing,remove:command == .removeMaskKey))
    }
    func buildMaskAnimationControls(in inspector:NSStackView) {
        inspector.addArrangedSubview(button(.editMaskPath))
        inspector.addArrangedSubview(label("MASK SHAPE KEYFRAMES"))
        inspector.addArrangedSubview(NSStackView(views:[button(.previousMaskKey),button(.nextMaskKey)]))
        inspector.addArrangedSubview(NSStackView(views:[button(.addMaskKey),button(.removeMaskKey)]))
        maskKeyStatus.font = .systemFont(ofSize:11); inspector.addArrangedSubview(maskKeyStatus)
        maskEasingPicker.setAccessibilityLabel("Outgoing mask easing")
        for command in [Command.maskLinear,.maskSmooth,.maskHold] {
            maskEasingPicker.addItem(withTitle:command.title)
            let item = maskEasingPicker.lastItem!; item.target = self; item.action = #selector(invoke(_:)); item.representedObject = command.rawValue
        }
        inspector.addArrangedSubview(maskEasingPicker); inspector.addArrangedSubview(button(.bakeMask))
    }
    func updateMaskAnimationInspector() {
        let mask = evaluatedMask
        maskPicker.selectItem(at:mask.map { $0.shape == .rectangle ? 1 : $0.shape == .ellipse ? 2 : 3 } ?? 0)
        maskPicker.isEnabled = canEditMask
        let values:[String:Double?] = ["maskX":mask.map { $0.x*100 },"maskY":mask.map { $0.y*100 },"maskWidth":mask.map { $0.width*100 },"maskHeight":mask.map { $0.height*100 },"maskFeather":mask?.feather]
        for (key,value) in values {
            if fields[key]?.currentEditor() == nil { fields[key]?.stringValue = value.map { String(format:"%.3f",$0) } ?? "" }
            fields[key]?.isEnabled = canEditMask && mask != nil
        }
        maskKeyStatus.stringValue = selectedClip?.maskAnimation.map { "\($0.keyframes.count) mask keys · \(currentMaskKey == nil ? "between keys" : "on key")" } ?? "Static mask · add a key to animate"
        maskEasingPicker.isEnabled = canEditMotion && currentMaskKey != nil
        maskEasingPicker.selectItem(withTitle:Command.allCases.first { $0.maskEasing == currentMaskKey?.easing && $0.maskEasing != nil }?.title ?? Command.maskLinear.title)
        for command in [Command.maskInvert,.editMaskPath,.addMaskKey,.removeMaskKey,.previousMaskKey,.nextMaskKey,.bakeMask] {
            for button in commandButtons[command] ?? [] { button.isEnabled = enabled(command); button.state = checked(command) ? .on : .off }
        }
    }
}
