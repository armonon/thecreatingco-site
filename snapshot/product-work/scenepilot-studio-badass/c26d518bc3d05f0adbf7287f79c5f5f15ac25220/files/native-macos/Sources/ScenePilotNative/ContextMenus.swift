import AppKit

final class ContextMediaTable: NSTableView {
    var contextMenuForSelection: (() -> NSMenu)?
    override func menu(for event: NSEvent) -> NSMenu? {
        let clicked = row(at: convert(event.locationInWindow, from: nil))
        if clicked >= 0 { selectRowIndexes(IndexSet(integer: clicked), byExtendingSelection: false) }
        else { deselectAll(nil) }
        return contextMenuForSelection?()
    }
}

extension EditorController {
    func contextMenu(_ groups: [[Command]]) -> NSMenu {
        let menu = NSMenu()
        for (index, group) in groups.enumerated() {
            if index > 0 { menu.addItem(.separator()) }
            for command in group {
                let item = NSMenuItem(title: command.title, action: #selector(invoke(_:)), keyEquivalent: "")
                item.representedObject = command.rawValue
                item.target = self
                item.isEnabled = enabled(command)
                item.state = checked(command) ? .on : .off
                menu.addItem(item)
            }
        }
        return menu
    }
}
