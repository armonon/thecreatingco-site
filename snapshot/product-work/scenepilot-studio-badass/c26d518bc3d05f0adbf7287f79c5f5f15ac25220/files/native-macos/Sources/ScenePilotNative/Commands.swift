import AppKit
import ScenePilotCore

enum Command: String, CaseIterable {
    case isolateObject, cancelIsolation
    case collectProject, cancelCollection
    case openSource, sourceIn, sourceOut, sourceClear, sourceInsert, sourceOverwrite
    case newProject, open, save, saveAs, recover, importMedia, relink, undo, redo, append, remove, split, play, newComp, addTrack, removeTrack, trackUp, trackDown, toggleTrack, lockTrack, export, cancelExport
    case reviewLegacy, restoreLegacy, trimHead, trimTail, slipBack, slipForward, duplicate, rippleDelete, zoomIn, zoomOut, zoomFit, snapping, fit, fill, flipH, flipV, resetTransform, resetWorkspace, sequenceSettings
    case rollBack, rollForward, slideBack, slideForward
    case addMotionKey, removeMotionKey, previousMotionKey, nextMotionKey, clearMotion
    case motionLinear, motionSmooth, motionEaseIn, motionEaseOut, motionHold
    case retryPreview
    case maskRectangle, maskEllipse, maskInvert, maskRemove, matteAlpha, matteLuma, matteInvert, matteRemove
    case maskBezier, editMaskPath, addMaskKey, removeMaskKey, previousMaskKey, nextMaskKey, bakeMask, maskLinear, maskSmooth, maskHold
    var motionEasing: ScenePilotCore.MotionEasing? {
        switch self {
        case .motionLinear: return .linear
        case .motionSmooth: return .smooth
        case .motionEaseIn: return .easeIn
        case .motionEaseOut: return .easeOut
        case .motionHold: return .hold
        default: return nil
        }
    }
    var title: String {
        switch self {
        case .isolateObject: return "AI Object Isolation…"
        case .collectProject: return "Collect Project + Media…"
        case .cancelCollection: return "Cancel Project Collection"
        case .cancelIsolation: return "Cancel AI Isolation"
        case .openSource: return "Open in Source Monitor"
        case .sourceIn: return "Mark Source In"
        case .sourceOut: return "Mark Source Out"
        case .sourceClear: return "Clear Marks"
        case .sourceInsert: return "Insert on Track"
        case .sourceOverwrite: return "Overwrite on Track"
        case .newProject: return "New Project"
        case .open: return "Open Native Project…"
        case .save: return "Save"
        case .saveAs: return "Save As…"
        case .recover: return "Recover Native Autosave…"
        case .importMedia: return "Import Media…"
        case .relink: return "Relink Selected Media…"
        case .undo: return "Undo"
        case .redo: return "Redo"
        case .append: return "Add to Track"
        case .remove: return "Delete Clip"
        case .split: return "Split at Playhead"
        case .play: return "Play / Pause"
        case .newComp: return "New Matched Composition"
        case .addTrack: return "Add Track"
        case .removeTrack: return "Remove Empty Track"
        case .trackUp: return "Move Track Up"
        case .trackDown: return "Move Track Down"
        case .toggleTrack: return "Enable / Disable Track"
        case .lockTrack: return "Lock / Unlock Track"
        case .export: return "Export MP4…"
        case .cancelExport: return "Cancel Export"
        case .reviewLegacy: return "Review Existing Pro Project…"
        case .restoreLegacy: return "Recover Original Pro Document…"
        case .trimHead: return "Trim In to Playhead"
        case .trimTail: return "Trim Out to Playhead"
        case .slipBack: return "Slip Source −1 Frame"
        case .slipForward: return "Slip Source +1 Frame"
        case .duplicate: return "Duplicate After Clip"
        case .rippleDelete: return "Ripple Delete on Track"
        case .zoomIn: return "Zoom In"
        case .zoomOut: return "Zoom Out"
        case .zoomFit: return "Fit Timeline"
        case .snapping: return "Snapping"
        case .fit: return "Fit Picture"
        case .fill: return "Fill Frame"
        case .flipH: return "Flip Horizontal"
        case .flipV: return "Flip Vertical"
        case .resetTransform: return "Reset Transform"
        case .resetWorkspace: return "Reset Workspace"
        case .sequenceSettings: return "Sequence Settings…"
        case .rollBack: return "Roll Out −1 Frame"
        case .rollForward: return "Roll Out +1 Frame"
        case .slideBack: return "Slide Clip −1 Frame"
        case .slideForward: return "Slide Clip +1 Frame"
        case .addMotionKey: return "Add / Update Motion Key"
        case .removeMotionKey: return "Remove Motion Key"
        case .previousMotionKey: return "Previous Motion Key"
        case .nextMotionKey: return "Next Motion Key"
        case .clearMotion: return "Bake Current Pose"
        case .motionLinear: return "Linear"
        case .motionSmooth: return "Smooth"
        case .motionEaseIn: return "Ease In"
        case .motionEaseOut: return "Ease Out"
        case .motionHold: return "Hold"
        case .retryPreview: return "Retry Preview"
        case .maskRectangle: return "Rectangle Mask"
        case .maskEllipse: return "Ellipse Mask"
        case .maskBezier: return "Bezier Mask"
        case .editMaskPath: return "Edit Bezier Path…"
        case .addMaskKey: return "Add Mask Key"
        case .removeMaskKey: return "Remove Key"
        case .previousMaskKey: return "Previous Key"
        case .nextMaskKey: return "Next Key"
        case .bakeMask: return "Bake Current Mask"
        case .maskLinear: return "Mask: Linear"
        case .maskSmooth: return "Mask: Smooth"
        case .maskHold: return "Mask: Hold"
        case .maskInvert: return "Invert Shape Mask"
        case .maskRemove: return "Remove Shape Mask"
        case .matteAlpha: return "Alpha Matte"
        case .matteLuma: return "Luma Matte"
        case .matteInvert: return "Invert Track Matte"
        case .matteRemove: return "Remove Track Matte"
        }
    }
    var shortcut: String {
        switch self {
        case .sourceIn: return "i"
        case .sourceOut: return "o"
        case .sourceInsert: return ","
        case .sourceOverwrite: return "."
        case .newProject: return "n"
        case .open: return "o"
        case .save: return "s"
        case .undo: return "z"
        case .redo: return "Z"
        case .importMedia: return "i"
        case .split: return "k"
        case .export: return "e"
        case .duplicate: return "d"
        case .zoomIn: return "="
        case .zoomOut: return "-"
        case .zoomFit: return "0"
        case .snapping: return ";"
        case .trimHead: return "["
        case .trimTail: return "]"
        case .rollBack, .slideBack: return "["
        case .rollForward, .slideForward: return "]"
        case .addMotionKey: return "k"
        case .addMaskKey: return "m"
        default: return ""
        }
    }
    var shortcutModifiers: NSEvent.ModifierFlags {
        switch self {
        case .sourceIn, .sourceOut: return [.command, .option]
        case .redo: return [.command, .shift]
        case .rollBack, .rollForward: return [.command, .option]
        case .slideBack, .slideForward: return [.command, .option, .shift]
        case .addMotionKey, .addMaskKey: return [.command, .option]
        default: return [.command]
        }
    }
    var shortcutLabel: String {
        (shortcutModifiers.contains(.shift) ? "⇧" : "") + (shortcutModifiers.contains(.option) ? "⌥" : "") + "⌘" + shortcut.uppercased()
    }
    var symbol: String? {
        switch self {
        case .newProject: return "doc.badge.plus"
        case .open: return "folder"
        case .save: return "square.and.arrow.down"
        case .importMedia: return "plus"
        case .undo: return "arrow.uturn.backward"
        case .redo: return "arrow.uturn.forward"
        case .export: return "square.and.arrow.up"
        case .cancelExport: return "xmark.circle"
        case .play: return "playpause.fill"
        case .split: return "scissors"
        case .addTrack: return "rectangle.stack.badge.plus"
        case .removeTrack, .remove, .rippleDelete: return "trash"
        case .trackUp: return "arrow.up"
        case .trackDown: return "arrow.down"
        case .toggleTrack: return "eye"
        case .lockTrack: return "lock"
        case .zoomIn: return "plus.magnifyingglass"
        case .zoomOut: return "minus.magnifyingglass"
        case .zoomFit: return "arrow.left.and.right"
        case .newComp: return "square.stack.3d.up.badge.a"
        case .snapping: return "arrow.right.to.line"
        case .rollBack: return "arrow.left.to.line"
        case .rollForward: return "arrow.right.to.line"
        case .slideBack: return "arrow.left"
        case .slideForward: return "arrow.right"
        case .addMotionKey: return "diamond.fill"
        case .removeMotionKey: return "diamond"
        case .previousMotionKey: return "chevron.left"
        case .nextMotionKey: return "chevron.right"
        case .retryPreview: return "arrow.clockwise"
        default: return nil
        }
    }
}

enum Panel: String, CaseIterable {
    case media, viewer, inspector, timeline
    var title: String { switch self { case .media: return "PROJECT MEDIA"; case .viewer: return "PROGRAM"; case .inspector: return "CLIP INSPECTOR"; case .timeline: return "SEQUENCE" } }
}
