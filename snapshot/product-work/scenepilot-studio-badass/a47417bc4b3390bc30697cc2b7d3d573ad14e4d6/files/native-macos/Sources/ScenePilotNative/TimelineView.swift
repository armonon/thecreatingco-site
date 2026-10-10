import AppKit
import ScenePilotCore

final class TimelineAccessibilityItem: NSAccessibilityElement {
    var press: (() -> Void)?
    override func accessibilityPerformPress() -> Bool { press?(); return press != nil }
}

final class TimelineView: NSView {
    static let libraryType = NSPasteboard.PasteboardType("studio.scenepilot.native.library-item")
    // AppKit accessibility proxies must stay alive after the children getter returns.
    private var accessibilityItems: [TimelineAccessibilityItem] = []
    var sequence = Sequence(name: "Main") { didSet { needsDisplay = true } }
    var clipName: (Clip) -> String = { _ in "Clip" }
    var selectedClip: String? { didSet { needsDisplay = true } }
    var selectedTrack: String? { didSet { needsDisplay = true } }
    var playhead = 0.0 {
        didSet {
            guard oldValue != playhead else { return }
            for time in [oldValue,playhead] {
                setNeedsDisplay(NSRect(x:labelWidth+time*pixelsPerSecond-2,y:0,width:6,height:bounds.height))
            }
        }
    }
    private var scrubbing = false
    var onSelect: ((String?, String) -> Void)?
    var onSeek: ((Double) -> Void)?
    var onMove: ((String, String, Double) -> Void)?
    var onTrim: ((String, TrimEdge, Double) -> Void)?
    var onMoveMotionKey: ((String, Double, Double) -> Void)?
    private var dragMotion: (clipId: String, keyTime: Double, originalTime: Double, targetTime: Double)?
    var onDrop: ((String, String, Double) -> Bool)?
    var canDrop: ((String) -> Bool)?
    private var dropPreview: (String, Double)?
    var snapping = true
    var interactionsEnabled = true
    var dragEdge: TrimEdge?
    var onDelete: (() -> Void)?
    var onPlay: (() -> Void)?
    var contextMenuForSelection: ((Bool) -> NSMenu)?
    var dragClip: Clip?
    var dragOrigin = NSPoint.zero
    var dragTime = 0.0
    var dragTrack: String?
    let labelWidth = 150.0, rowHeight = 54.0, rulerHeight = 30.0
    var pixelsPerSecond = 70.0
    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }
    override init(frame: NSRect) {
        super.init(frame: frame)
        registerForDraggedTypes([Self.libraryType])
        setAccessibilityElement(true); setAccessibilityRole(.group)
        setAccessibilityLabel("Sequence timeline. Left and right arrows seek one frame. Up and down arrows select tracks. Track order is top-first.")
    }
    required init?(coder: NSCoder) { fatalError() }
    override func accessibilityChildren() -> [Any]? {
        var items: [TimelineAccessibilityItem] = []
        func item(_ label: String, rect: NSRect, press: @escaping () -> Void) -> TimelineAccessibilityItem {
            let node = TimelineAccessibilityItem()
            node.setAccessibilityElement(true)
            node.setAccessibilityEnabled(interactionsEnabled)
            node.setAccessibilityRole(.button); node.setAccessibilityLabel(label); node.setAccessibilityParent(self)
            if let window { node.setAccessibilityFrame(window.convertToScreen(convert(rect, to: nil))) }
            node.press = press; return node
        }
        for (row, track) in sequence.tracks.enumerated() {
            items.append(item("\(track.name), \(track.enabled ? "enabled" : "disabled"), \(track.locked ? "locked" : "unlocked")", rect: NSRect(x: 0, y: rulerHeight + Double(row) * rowHeight, width: labelWidth, height: rowHeight)) { [weak self] in guard let self else { return }; self.window?.makeFirstResponder(self); self.onSelect?(nil, track.id) })
            for clip in sequence.videoClips where clip.trackId == track.id {
                items.append(item("\(clipName(clip)), \(track.name), start \(clip.start) seconds, duration \(clip.duration) seconds", rect: clipRect(clip, row: row)) { [weak self] in guard let self else { return }; self.window?.makeFirstResponder(self); self.onSelect?(clip.id, track.id); self.onSeek?(clip.start) })
                if clip.id == selectedClip, let motion = clip.motion {
                    for key in motion.keyframes where key.time >= motion.offset && key.time < motion.offset + clip.duration {
                        let time = clip.start + key.time - motion.offset, point = motionPoint(clip, key: key, row: row)
                        items.append(item("Motion key at \(String(format: "%.3f", time)) seconds. Use inspector Key Time to move.", rect: NSRect(x: point.x - 6, y: point.y - 6, width: 12, height: 12)) { [weak self] in guard let self else { return }; self.window?.makeFirstResponder(self); self.onSelect?(clip.id, track.id); self.onSeek?(time) })
                    }
                }
            }
        }
        accessibilityItems = items
        return items
    }
    func updateSize(width: CGFloat) {
        setFrameSize(NSSize(width: max(width, labelWidth + max(10, sequence.duration + 2) * pixelsPerSecond), height: max(180, rulerHeight + Double(sequence.tracks.count) * rowHeight)))
    }
    func clipRect(_ clip: Clip, row: Int) -> NSRect { NSRect(x: labelWidth + clip.start * pixelsPerSecond, y: rulerHeight + Double(row) * rowHeight + 6, width: max(6, clip.duration * pixelsPerSecond), height: rowHeight - 12) }
    func motionPoint(_ clip: Clip, key: MotionKeyframe, row: Int) -> NSPoint {
        let rect = clipRect(clip, row: row), time = key.time - (clip.motion?.offset ?? 0)
        return NSPoint(x: max(rect.minX + 4, min(rect.maxX - 4, rect.minX + time * pixelsPerSecond)), y: rect.maxY - 6)
    }
    override func draw(_ dirtyRect: NSRect) {
        NSColor(calibratedWhite: 0.085, alpha: 1).setFill(); bounds.fill()
        let text: [NSAttributedString.Key: Any] = [.font: NSFont.monospacedSystemFont(ofSize: 11, weight: .regular), .foregroundColor: NSColor.secondaryLabelColor]
        let interval = max(1, Int(ceil(70 / pixelsPerSecond)))
        let firstTick = max(0,Int(floor((dirtyRect.minX-labelWidth-50)/pixelsPerSecond/Double(interval)))*interval)
        let lastTick = min(Int(max(10,sequence.duration+2)),Int(ceil((dirtyRect.maxX-labelWidth+50)/pixelsPerSecond/Double(interval)))*interval)
        for second in stride(from: firstTick, through: lastTick, by: interval) {
            let x = labelWidth + Double(second) * pixelsPerSecond
            guard x >= dirtyRect.minX - 50 && x <= dirtyRect.maxX + 50 else { continue }
            ("\(second)s" as NSString).draw(at: NSPoint(x: x + 3, y: 7), withAttributes: text)
            NSColor.separatorColor.setFill(); NSRect(x: x, y: rulerHeight, width: 0.5, height: bounds.height).fill()
        }
        for (row, track) in sequence.tracks.enumerated() {
            let y = rulerHeight + Double(row) * rowHeight
            guard NSRect(x:0,y:y,width:bounds.width,height:rowHeight).intersects(dirtyRect) else { continue }
            (track.id == selectedTrack ? NSColor(calibratedRed: 0.19, green: 0.18, blue: 0.31, alpha: 1) : NSColor(calibratedWhite: 0.13, alpha: 1)).setFill()
            NSRect(x: 0, y: y, width: labelWidth - 1, height: rowHeight - 1).fill()
            let label = "\(track.locked ? "🔒 " : "")\(track.name)\(track.enabled ? "" : " · OFF")"
            (label as NSString).draw(in: NSRect(x: 12, y: y + 17, width: labelWidth - 18, height: 25), withAttributes: [.font: NSFont.systemFont(ofSize: 11, weight: .medium), .foregroundColor: NSColor.labelColor])
            for clip in sequence.videoClips where clip.trackId == track.id {
                let rect = clipRect(clip, row: row)
                guard rect.insetBy(dx:-4,dy:-4).intersects(dirtyRect) else { continue }
                (clip.compositionId == nil ? NSColor(calibratedRed: 0.18, green: 0.43, blue: 0.52, alpha: track.enabled ? 1 : 0.4) : NSColor(calibratedRed: 0.43, green: 0.32, blue: 0.65, alpha: track.enabled ? 1 : 0.4)).setFill()
                let shape = NSBezierPath(roundedRect: rect, xRadius: 4, yRadius: 4); shape.fill()
                if clip.id == selectedClip { NSColor.controlAccentColor.setStroke(); shape.lineWidth = 2; shape.stroke() }
                if clip.id == selectedClip && !track.locked {
                    NSColor.white.withAlphaComponent(0.7).setFill()
                    NSRect(x: rect.minX + 2, y: rect.midY - 7, width: 2, height: 14).fill()
                    NSRect(x: rect.maxX - 4, y: rect.midY - 7, width: 2, height: 14).fill()
                }
                (clipName(clip) as NSString).draw(in: rect.insetBy(dx: 7, dy: 10), withAttributes: [.font: NSFont.systemFont(ofSize: 11, weight: .medium), .foregroundColor: NSColor.white])
                if clip.id == selectedClip, let motion = clip.motion {
                    NSColor.systemYellow.setFill()
                    for key in motion.keyframes {
                        let local = key.time - motion.offset
                        guard local >= 0, local < clip.duration else { continue }
                        let point = motionPoint(clip, key: key, row: row), x = point.x, y = point.y
                        guard dirtyRect.insetBy(dx: -4, dy: -4).contains(NSPoint(x: x, y: y)) else { continue }
                        let diamond = NSBezierPath(); diamond.move(to: NSPoint(x: x, y: y - 3)); diamond.line(to: NSPoint(x: x + 3, y: y)); diamond.line(to: NSPoint(x: x, y: y + 3)); diamond.line(to: NSPoint(x: x - 3, y: y)); diamond.close(); diamond.fill()
                    }
                }
            }
        }
        if var ghost = dragClip, let track = dragTrack, let row = sequence.tracks.firstIndex(where: { $0.id == track }) {
            if dragEdge == .head { ghost.duration += ghost.start - dragTime; ghost.start = dragTime }
            else if dragEdge == .tail { ghost.duration = max(0, dragTime - ghost.start) }
            else { ghost.start = dragTime }
            NSColor.white.withAlphaComponent(0.2).setFill(); clipRect(ghost, row: row).fill()
        }
        if let key = dragMotion, let clip = sequence.videoClips.first(where: { $0.id == key.clipId }), let row = sequence.tracks.firstIndex(where: { $0.id == clip.trackId }) {
            NSColor.systemYellow.setFill()
            let rect = clipRect(clip, row: row)
            NSRect(x: labelWidth + key.targetTime * pixelsPerSecond - 1, y: rect.minY, width: 2, height: rect.height).fill()
        }
        if let (track, time) = dropPreview, let row = sequence.tracks.firstIndex(where: { $0.id == track }) {
            NSColor.controlAccentColor.withAlphaComponent(0.35).setFill()
            NSRect(x: labelWidth + time * pixelsPerSecond, y: rulerHeight + Double(row) * rowHeight, width: 80, height: rowHeight).fill()
        }
        NSColor.systemPink.setFill(); NSRect(x: labelWidth + playhead * pixelsPerSecond, y: 0, width: 2, height: bounds.height).fill()
    }
    override func menu(for event: NSEvent) -> NSMenu? {
        guard interactionsEnabled else { return nil }
        let point = convert(event.locationInWindow, from: nil)
        let row = Int((point.y - rulerHeight) / rowHeight)
        guard point.y >= rulerHeight, sequence.tracks.indices.contains(row) else { return nil }
        let track = sequence.tracks[row]
        let clip = sequence.videoClips.last { $0.trackId == track.id && clipRect($0, row: row).contains(point) }
        window?.makeFirstResponder(self)
        onSelect?(clip?.id, track.id)
        return contextMenuForSelection?(clip != nil)
    }
    override func mouseDown(with event: NSEvent) {
        guard interactionsEnabled else { return }
        scrubbing = false
        window?.makeFirstResponder(self)
        let p = convert(event.locationInWindow, from: nil)
        if p.y < rulerHeight { scrubbing = true; onSeek?(max(0, min(sequence.duration, (p.x - labelWidth) / pixelsPerSecond))); return }
        let row = Int((p.y - rulerHeight) / rowHeight)
        guard sequence.tracks.indices.contains(row) else { return }
        let track = sequence.tracks[row]
        let selected = sequence.videoClips.last { $0.trackId == track.id && clipRect($0, row: row).contains(p) }
        onSelect?(selected?.id, track.id)
        guard p.x >= labelWidth, !track.locked, let selected else { return }
        let rect = clipRect(selected, row: row)
        if let motion = selected.motion, let key = motion.keyframes.filter({ $0.time >= motion.offset && $0.time < motion.offset + selected.duration }).min(by: { abs(motionPoint(selected, key: $0, row: row).x - p.x) < abs(motionPoint(selected, key: $1, row: row).x - p.x) }) {
            let point = motionPoint(selected, key: key, row: row)
            if abs(p.x - point.x) <= 6 && abs(p.y - point.y) <= 6 {
                let time = selected.start + key.time - motion.offset
                dragMotion = (selected.id, key.time, time, time); dragOrigin = p
                onSeek?(time); return
            }
        }
        dragEdge = rect.width >= 20 ? (p.x - rect.minX < 7 ? .head : rect.maxX - p.x < 7 ? .tail : nil) : nil
        dragClip = selected; dragOrigin = p; dragTime = dragEdge == .tail ? selected.start + selected.duration : selected.start; dragTrack = track.id
    }
    override func mouseDragged(with event: NSEvent) {
        guard interactionsEnabled else { return }
        let p = convert(event.locationInWindow, from: nil)
        if scrubbing { onSeek?(max(0,min(sequence.duration,(p.x-labelWidth)/pixelsPerSecond))); return }
        if let key = dragMotion {
            dragMotion?.targetTime = ((key.originalTime + (p.x - dragOrigin.x) / pixelsPerSecond) * Double(sequence.frameRate)).rounded() / Double(sequence.frameRate)
            needsDisplay = true; return
        }
        guard let clip = dragClip else { return }
        if let edge = dragEdge {
            let origin = edge == .head ? clip.start : clip.start + clip.duration
            let proposed = max(0, origin + (p.x - dragOrigin.x) / pixelsPerSecond)
            let anchors: [Double] = sequence.videoClips.filter { $0.id != clip.id }.flatMap { [$0.start, $0.start + $0.duration] } + [0.0,playhead]
            dragTime = TimelineSnap.start(proposed, duration: 0, anchors: snapping && !event.modifierFlags.contains(.option) ? anchors : [], tolerance: 8 / pixelsPerSecond, frameRate: sequence.frameRate)
            needsDisplay = true; return
        }
        let row = max(0, min(sequence.tracks.count - 1, Int((p.y - rulerHeight) / rowHeight)))
        guard !sequence.tracks[row].locked else { dragTrack = nil; needsDisplay = true; return }
        dragTrack = sequence.tracks[row].id
        let proposed = max(0, clip.start + (p.x - dragOrigin.x) / pixelsPerSecond)
        let anchors: [Double] = sequence.videoClips.filter { $0.id != clip.id }.flatMap { [$0.start, $0.start + $0.duration] } + [0.0,playhead]
        dragTime = TimelineSnap.start(proposed, duration: clip.duration, anchors: snapping && !event.modifierFlags.contains(.option) ? anchors : [], tolerance: 8 / pixelsPerSecond, frameRate: sequence.frameRate); needsDisplay = true
    }
    override func mouseUp(with event: NSEvent) {
        if scrubbing {
            scrubbing = false
            if interactionsEnabled { let p = convert(event.locationInWindow,from:nil); onSeek?(max(0,min(sequence.duration,(p.x-labelWidth)/pixelsPerSecond))) }
            return
        }
        if let key = dragMotion {
            dragMotion = nil
            if abs(key.targetTime - key.originalTime) > 0.00001 { onMoveMotionKey?(key.clipId, key.keyTime, key.targetTime) }
            needsDisplay = true; return
        }
        if let clip = dragClip, let edge = dragEdge {
            if dragTime != (edge == .head ? clip.start : clip.start + clip.duration) { onTrim?(clip.id, edge, dragTime) }
        } else if let clip = dragClip, let track = dragTrack, clip.start != dragTime || clip.trackId != track { onMove?(clip.id, track, dragTime) }
        dragClip = nil; dragEdge = nil; needsDisplay = true
    }
    override func keyDown(with event: NSEvent) {
        guard interactionsEnabled else { return }
        if event.keyCode == 53 { scrubbing = false; dragClip = nil; dragEdge = nil; dragMotion = nil; needsDisplay = true }
        else if event.keyCode == 51 { onDelete?() }
        else if event.keyCode == 123 || event.keyCode == 124 { onSeek?(playhead + (event.keyCode == 123 ? -1 : 1) / Double(sequence.frameRate)) }
        else if event.keyCode == 125 || event.keyCode == 126 {
            let row = sequence.tracks.firstIndex { $0.id == selectedTrack } ?? 0
            let next = max(0, min(sequence.tracks.count - 1, row + (event.keyCode == 126 ? -1 : 1)))
            onSelect?(nil, sequence.tracks[next].id)
        }
        else if event.characters == " " { onPlay?() }
        else { super.keyDown(with: event) }
    }
    private func dropTarget(_ sender: NSDraggingInfo) -> (String, String, Double)? {
        guard interactionsEnabled, let id = sender.draggingPasteboard.string(forType: Self.libraryType), canDrop?(id) == true else { return nil }
        let point = convert(sender.draggingLocation, from: nil), row = Int(floor((point.y - rulerHeight) / rowHeight))
        guard point.x >= labelWidth, sequence.tracks.indices.contains(row), !sequence.tracks[row].locked else { return nil }
        let time = TimelineSnap.start((point.x - labelWidth) / pixelsPerSecond, duration: 0, anchors: snapping ? sequence.videoClips.flatMap { [$0.start, $0.start + $0.duration] } + [playhead] : [], tolerance: 8 / pixelsPerSecond, frameRate: sequence.frameRate)
        return (id, sequence.tracks[row].id, time)
    }
    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation { draggingUpdated(sender) }
    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
        if let (_, track, time) = dropTarget(sender) { dropPreview = (track, time); needsDisplay = true; return .copy }
        dropPreview = nil; needsDisplay = true; return []
    }
    override func draggingExited(_ sender: NSDraggingInfo?) { dropPreview = nil; needsDisplay = true }
    override func prepareForDragOperation(_ sender: NSDraggingInfo) -> Bool { dropTarget(sender) != nil }
    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        defer { dropPreview = nil; needsDisplay = true }
        guard let (id, track, time) = dropTarget(sender) else { return false }
        return onDrop?(id, track, time) ?? false
    }
}
