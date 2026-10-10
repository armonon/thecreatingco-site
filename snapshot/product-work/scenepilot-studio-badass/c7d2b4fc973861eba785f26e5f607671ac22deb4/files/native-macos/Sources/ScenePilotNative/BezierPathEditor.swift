import AppKit
import ScenePilotCore
import ScenePilotMedia

/// A local draft: pointer changes never mutate the document until Apply.
@MainActor final class BezierCanvas: NSView {
    var mask = ClipMask(shape:.rectangle).convertedToBezier() { didSet { needsDisplay = true } }
    var selected = 0
    var changed: (() -> Void)?
    private var dragPart = 0 // 0 anchor, 1 incoming, 2 outgoing
    private var dragging = false
    override var acceptsFirstResponder: Bool { true }
    var canvas: CGRect { bounds.insetBy(dx:24,dy:24) }
    func screen(_ p: MaskPoint) -> CGPoint { CGPoint(x:canvas.minX+p.x*canvas.width,y:canvas.maxY-p.y*canvas.height) }
    override func draw(_ dirtyRect: NSRect) {
        NSColor.windowBackgroundColor.setFill(); bounds.fill()
        NSColor.black.setFill(); canvas.fill()
        guard let points = mask.points else { return }
        let context = NSGraphicsContext.current!.cgContext
        context.saveGState(); context.translateBy(x:canvas.minX,y:canvas.minY)
        var local = mask; local.x = 0.5; local.y = 0.5; local.width = 1; local.height = 1
        context.addPath(NativeMaskPath.path(local,size:canvas.size)); context.setFillColor(NSColor.systemTeal.withAlphaComponent(0.3).cgColor)
        context.setStrokeColor(NSColor.systemTeal.cgColor); context.setLineWidth(2); context.drawPath(using:.eoFillStroke); context.restoreGState()
        for (index,point) in points.enumerated() {
            let anchor = screen(point.anchor)
            if index == selected {
                let path = NSBezierPath(); path.move(to:screen(point.incoming)); path.line(to:anchor); path.line(to:screen(point.outgoing))
                NSColor.systemOrange.setStroke(); path.stroke()
                for p in [point.incoming,point.outgoing] { let q = screen(p); NSColor.systemOrange.setFill(); NSBezierPath(ovalIn:NSRect(x:q.x-4,y:q.y-4,width:8,height:8)).fill() }
            }
            (index == selected ? NSColor.white : NSColor.systemTeal).setFill()
            NSBezierPath(rect:NSRect(x:anchor.x-4,y:anchor.y-4,width:8,height:8)).fill()
        }
    }
    override func mouseDown(with event: NSEvent) {
        dragging = false
        window?.makeFirstResponder(self)
        guard let points = mask.points else { return }
        let location = convert(event.locationInWindow,from:nil)
        var hits: [(Double,Int,Int)] = []
        for (i,p) in points.enumerated() {
            for (part,q) in [p.anchor,p.incoming,p.outgoing].enumerated() where part == 0 || i == selected {
                let s = screen(q); hits.append((hypot(location.x-s.x,location.y-s.y),i,part))
            }
        }
        guard let hit = hits.sorted(by: { $0.0 == $1.0 ? $0.2 < $1.2 : $0.0 < $1.0 }).first, hit.0 <= 14 else { return }
        selected = hit.1; dragPart = event.modifierFlags.contains(.option) ? (event.modifierFlags.contains(.shift) ? 1 : 2) : hit.2
        dragging = true
        needsDisplay = true; changed?()
    }
    override func mouseDragged(with event: NSEvent) {
        guard dragging else { return }
        let p = convert(event.locationInWindow,from:nil)
        move(to:MaskPoint(min(8,max(-8,(p.x-canvas.minX)/canvas.width)),min(8,max(-8,(canvas.maxY-p.y)/canvas.height))))
    }
    override func mouseUp(with event:NSEvent) { dragging = false }
    func move(to point: MaskPoint) {
        guard var vertices = mask.points, vertices.indices.contains(selected) else { return }
        if dragPart == 0 {
            let delta = MaskPoint(point.x-vertices[selected].anchor.x,point.y-vertices[selected].anchor.y)
            vertices[selected].anchor = point
            vertices[selected].incoming.x += delta.x; vertices[selected].incoming.y += delta.y
            vertices[selected].outgoing.x += delta.x; vertices[selected].outgoing.y += delta.y
        } else if dragPart == 1 { vertices[selected].incoming = point } else { vertices[selected].outgoing = point }
        mask.points = vertices; changed?()
    }
    override func keyDown(with event: NSEvent) {
        guard let p = mask.points?[selected] else { return }
        var value = dragPart == 1 ? p.incoming : dragPart == 2 ? p.outgoing : p.anchor
        let delta = event.modifierFlags.contains(.shift) ? 0.01 : 0.001
        switch event.keyCode { case 123: value.x -= delta; case 124: value.x += delta; case 125: value.y += delta; case 126: value.y -= delta; default: super.keyDown(with:event); return }
        move(to:value)
    }
}

@MainActor final class BezierPathEditor: NSWindowController, NSWindowDelegate {
    let canvas = BezierCanvas(frame:NSRect(x:0,y:0,width:500,height:390))
    let summary = NSTextField(labelWithString:"")
    var result: ClipMask?
    let topologyLocked: Bool
    let add = NSButton(), remove = NSButton()
    init(mask: ClipMask, animated: Bool) {
        topologyLocked = animated
        let window = NSWindow(contentRect:NSRect(x:0,y:0,width:550,height:525),styleMask:[.titled,.closable],backing:.buffered,defer:false)
        super.init(window:window); window.title = "Bezier Mask · Mask-local Space"; window.delegate = self
        canvas.mask = mask.convertedToBezier(); canvas.setAccessibilityLabel("Bezier mask canvas. Drag anchors and handles. Arrow keys nudge the selected control.")
        let help = NSTextField(wrappingLabelWithString:"Drag anchors and orange handles. Option-drag an anchor pulls its outgoing handle; Shift–Option pulls incoming. Arrows nudge 0.1%; Shift nudges 1%. This is mask-local space, not the video viewer.")
        help.font = .systemFont(ofSize:11)
        let apply = NSButton(title:"Apply Path",target:self,action:#selector(accept)); apply.keyEquivalent = "\r"
        let cancel = NSButton(title:"Cancel",target:self,action:#selector(cancel)); cancel.keyEquivalent = "\u{1b}"
        add.title = "Split Segment"; add.target = self; add.action = #selector(insert)
        remove.title = "Delete Vertex"; remove.target = self; remove.action = #selector(deleteVertex)
        let buttons = NSStackView(views:[add,remove,cancel,apply]); buttons.spacing = 8
        let stack = NSStackView(views:[canvas,summary,help,buttons]); stack.orientation = .vertical; stack.spacing = 10
        stack.edgeInsets = NSEdgeInsets(top:12,left:12,bottom:12,right:12); window.contentView = stack
        canvas.widthAnchor.constraint(equalToConstant:500).isActive = true; canvas.heightAnchor.constraint(equalToConstant:390).isActive = true
        help.widthAnchor.constraint(equalToConstant:500).isActive = true
        canvas.changed = { [weak self] in self?.refresh() }; refresh()
    }
    required init?(coder:NSCoder) { fatalError() }
    func refresh() {
        let count = canvas.mask.points?.count ?? 0
        summary.stringValue = "Vertex \(canvas.selected+1) / \(count)" + (topologyLocked ? " · Bake mask before changing vertex count" : " · Closed cubic path")
        add.isEnabled = !topologyLocked && count < 128; remove.isEnabled = !topologyLocked && count > 3
    }
    @objc func insert() { do { try canvas.mask.insertVertex(after:canvas.selected); canvas.selected += 1; refresh() } catch { NSSound.beep() } }
    @objc func deleteVertex() { guard !topologyLocked, (canvas.mask.points?.count ?? 0) > 3 else { return }; canvas.mask.points?.remove(at:canvas.selected); canvas.selected = max(0,canvas.selected-1); refresh() }
    @objc func accept() { do { try canvas.mask.validate(); result = canvas.mask; NSApp.stopModal(); window?.orderOut(nil) } catch { summary.stringValue = error.localizedDescription } }
    @objc func cancel() { NSApp.stopModal(); window?.orderOut(nil) }
    func windowShouldClose(_ sender:NSWindow) -> Bool { cancel(); return true }
    func edit() -> ClipMask? { window?.center(); window?.makeKeyAndOrderFront(nil); window?.makeFirstResponder(canvas); NSApp.runModal(for:window!); return result }
}
