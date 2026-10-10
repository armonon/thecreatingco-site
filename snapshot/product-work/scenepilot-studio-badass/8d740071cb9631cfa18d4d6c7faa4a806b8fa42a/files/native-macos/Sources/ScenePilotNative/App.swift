import AppKit

@MainActor final class ApplicationDelegate: NSObject, NSApplicationDelegate {
    var editor: EditorController?
    func applicationDidFinishLaunching(_ notification: Notification) {
        let editor = EditorController(); self.editor = editor
        let bar = NSMenu()
        let appItem = NSMenuItem(); let appMenu = NSMenu(); appItem.submenu = appMenu; bar.addItem(appItem)
        appMenu.addItem(withTitle: "About ScenePilot Native", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator()); appMenu.addItem(withTitle: "Quit ScenePilot Native", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        for (title, commands) in [("File",[Command.newProject,.open,.save,.saveAs,.recover,.reviewLegacy,.restoreLegacy,.importMedia,.relink,.export,.cancelExport]),("Edit",[.undo,.redo,.append,.remove,.split,.trimHead,.trimTail,.slipBack,.slipForward,.rollBack,.rollForward,.slideBack,.slideForward,.duplicate,.rippleDelete]),("Sequence",[.play,.newComp,.sequenceSettings,.snapping]),("Track",[.addTrack,.removeTrack,.trackUp,.trackDown,.toggleTrack,.lockTrack]),("Picture",[.fit,.fill,.flipH,.flipV,.resetTransform]),("View",[.zoomIn,.zoomOut,.zoomFit,.resetWorkspace])] {
            let item = NSMenuItem(title: title, action: nil, keyEquivalent: ""); let menu = NSMenu(title: title); item.submenu = menu; bar.addItem(item)
            for command in commands { let child = NSMenuItem(title: command.title, action: #selector(EditorController.invoke(_:)), keyEquivalent: command.shortcut.lowercased()); child.target = editor; child.representedObject = command.rawValue; child.keyEquivalentModifierMask = command.shortcutModifiers; menu.addItem(child) }
            if title == "Edit" {
                menu.addItem(.separator())
                // Nil targets deliberately use AppKit's first-responder chain for text editing.
                for (name, action, key) in [("Cut", "cut:", "x"), ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] {
                    menu.addItem(withTitle: name, action: Selector(action), keyEquivalent: key)
                }
            }
        }
        let motionItem = NSMenuItem(title: "Motion", action: nil, keyEquivalent: "")
        let motionMenu = NSMenu(title: "Motion"); motionItem.submenu = motionMenu
        for command in [Command.addMotionKey,.removeMotionKey,.previousMotionKey,.nextMotionKey,.clearMotion,.motionLinear,.motionSmooth,.motionEaseIn,.motionEaseOut,.motionHold] {
            let item = NSMenuItem(title: command.title, action: #selector(EditorController.invoke(_:)), keyEquivalent: command.shortcut)
            item.target = editor; item.representedObject = command.rawValue; item.keyEquivalentModifierMask = command.shortcutModifiers; motionMenu.addItem(item)
        }
        bar.insertItem(motionItem, at: bar.items.count - 1)
        let compositingItem = NSMenuItem(title: "Compositing", action: nil, keyEquivalent: "")
        compositingItem.submenu = editor.contextMenu([[.maskRectangle,.maskEllipse,.maskBezier,.editMaskPath,.maskInvert,.maskRemove], [.addMaskKey,.removeMaskKey,.previousMaskKey,.nextMaskKey,.bakeMask,.maskLinear,.maskSmooth,.maskHold], [.matteAlpha,.matteLuma,.matteInvert,.matteRemove]])
        for item in compositingItem.submenu!.items {
            if let raw = item.representedObject as? String, let command = Command(rawValue:raw) { item.keyEquivalent = command.shortcut; item.keyEquivalentModifierMask = command.shortcutModifiers }
        }
        for command in [Command.isolateObject, .cancelIsolation] {
            let item = NSMenuItem(title: command.title, action: #selector(EditorController.invoke(_:)), keyEquivalent: "")
            item.target = editor; item.representedObject = command.rawValue; compositingItem.submenu?.addItem(item)
        }
        bar.insertItem(compositingItem, at: bar.items.count - 1)
        if let sequenceMenu = bar.items.first(where: { $0.title == "Sequence" })?.submenu {
            let retry = NSMenuItem(title: Command.retryPreview.title, action: #selector(EditorController.invoke(_:)), keyEquivalent: "")
            retry.target = editor; retry.representedObject = Command.retryPreview.rawValue; sequenceMenu.addItem(retry)
        }
        let sourceItem = NSMenuItem(title: "Source", action: nil, keyEquivalent: "")
        sourceItem.submenu = editor.contextMenu([[.openSource,.sourceIn,.sourceOut,.sourceClear],[.sourceInsert,.sourceOverwrite]])
        for item in sourceItem.submenu!.items {
            if let raw = item.representedObject as? String, let command = Command(rawValue: raw) { item.keyEquivalent = command.shortcut; item.keyEquivalentModifierMask = command.shortcutModifiers }
        }
        bar.insertItem(sourceItem, at: 3)
        if let file = bar.items.first(where: { $0.title == "File" })?.submenu {
            let collect = NSMenuItem(title: Command.collectProject.title, action: #selector(EditorController.invoke(_:)), keyEquivalent: "")
            collect.target = editor; collect.representedObject = Command.collectProject.rawValue; file.addItem(collect)
            let cancel = NSMenuItem(title: Command.cancelCollection.title, action: #selector(EditorController.invoke(_:)), keyEquivalent: "")
            cancel.target = editor; cancel.representedObject = Command.cancelCollection.rawValue; file.addItem(cancel)
        }
        NSApp.mainMenu = bar
        editor.showWindow(nil); editor.window?.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply { editor?.closeApproved == true || editor?.mayReplace() != false ? .terminateNow : .terminateCancel }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

@main struct ScenePilotNativeApplication {
    @MainActor static func main() {
        let application = NSApplication.shared
        application.appearance = NSAppearance(named: .darkAqua)
        application.setActivationPolicy(.regular)
        let delegate = ApplicationDelegate(); application.delegate = delegate
        withExtendedLifetime(delegate) { application.run() }
    }
}
