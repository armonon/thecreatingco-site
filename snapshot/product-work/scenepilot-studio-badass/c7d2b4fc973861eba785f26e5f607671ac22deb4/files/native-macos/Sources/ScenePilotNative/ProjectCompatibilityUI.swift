import AppKit
import ScenePilotCore
import ScenePilotMedia

@MainActor extension EditorController {
    func collectProject() {
        let panel = NSSavePanel(); panel.nameFieldStringValue = project.name + " — Collected"
        panel.message = "Create a NEW folder with the native document and every media file, including AI alpha sidecars. This copies media; allow enough disk space. Existing folders are never replaced."
        guard panel.runModal() == .OK, let destination = panel.url else { return }
        let snapshot = project; busy = true; reload(rebuild: false); status.stringValue = "Collecting project and media… File → Cancel Project Collection to stop"
        let worker = Task.detached { try ProjectCollection.collect(snapshot, to: destination) }
        collectionTask = worker; updateCommands()
        Task { [weak self] in
            guard let self else { return }; defer { self.collectionTask = nil; self.busy = false; self.reload(rebuild: false) }
            do {
                let url = try await worker.value
                self.status.stringValue = "Collected portable project: \(url.path) · current working project unchanged"
                NSWorkspace.shared.activateFileViewerSelecting([url])
            } catch { self.fail(error) }
        }
    }
    func reviewLegacy() {
        let panel = NSOpenPanel(); panel.canChooseDirectories = false; panel.allowsMultipleSelection = false
        panel.message = "Inspect an existing ScenePilot .scenepilot.json document without changing it."
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? Int.max
            guard size <= 32 * 1024 * 1024 else { throw ProjectError.invalid("Compatibility documents must be 32 MB or smaller.") }
            let data = try Data(contentsOf: url), report = try LegacyCompatibility.inspect(data)
            busy = true; reload(rebuild: false); status.stringValue = "Linking sources and checking for an exact translation… the source document is not changed"
            Task { [weak self] in
                guard let self else { return }
                // Link each source once; every outcome below reuses the same inspection.
                var linked: [String: Media] = [:], skipped: [String] = []
                for reference in report.media {
                    guard let path = reference.path, reference.kind != "image" else { skipped.append(reference.name); continue }
                    do {
                        let media = try await NativeMedia.inspect(URL(fileURLWithPath: path))
                        guard linked[reference.id] == nil else { throw ProjectError.invalid("Duplicate legacy asset ID.") }
                        linked[reference.id] = media
                    } catch { skipped.append(reference.name) }
                }
                self.busy = false; self.reload(rebuild: false)
                do {
                    let translation = try LegacySceneTranslation.translate(data, filename: url.lastPathComponent, linked: linked)
                    self.presentLegacyReview(url: url, data: data, report: report, translation: translation, linked: linked, skipped: skipped)
                } catch { self.fail(error) }
            }
        } catch { fail(error) }
    }
    private func presentLegacyReview(url: URL, data: Data, report: LegacyCompatibilityReport, translation: SceneTranslationResult, linked: [String: Media], skipped: [String]) {
        let alert = NSAlert()
        alert.messageText = translation.isExact ? "Exact translation available — \(report.name)" : "Existing Pro project — \(report.name)"
        alert.informativeText = translation.isExact
            ? "Every rendered feature has a native equivalent. The original document is archived unchanged inside the new project."
            : "\(translation.blockers.count) item\(translation.blockers.count == 1 ? "" : "s") have no exact native equivalent yet, so this edit can't be translated without changing how it looks or sounds. Nothing has been imported."
        let media = report.media.map { "\($0.name) [\($0.kind)] — \($0.path ?? "No local source path; relink in the existing Pro app")" }
        let scroll = NSScrollView(frame: NSRect(x: 0, y: 0, width: 640, height: 360)); scroll.hasVerticalScroller = true
        let text = NSTextView(frame: scroll.bounds); text.isEditable = false; text.string = translation.report + "\n\nMEDIA\n" + media.joined(separator: "\n"); text.font = .systemFont(ofSize: 12)
        text.autoresizingMask = [.width]; text.textContainer?.widthTracksTextView = true; scroll.documentView = text
        alert.accessoryView = scroll
        if translation.isExact, let translated = translation.project {
            alert.addButton(withTitle: "Open Exact Translation"); alert.addButton(withTitle: "Close Review")
            guard alert.runModal() == .alertFirstButtonReturn, mayReplace() else { return }
            adoptImported(translated)
            status.stringValue = "Exact translation (\(LegacySceneTranslation.translator) v\(LegacySceneTranslation.version)) · original archived byte-for-byte · Save As a new native project"
            return
        }
        alert.addButton(withTitle: "Close Review"); alert.addButton(withTitle: "Import Linked Media Only")
        alert.addButton(withTitle: "Rebuild Editorial Cuts…")
        let response = alert.runModal()
        guard response == .alertSecondButtonReturn || response == .alertThirdButtonReturn else { return }
        let rebuildCuts = response == .alertThirdButtonReturn
        if rebuildCuts {
            let confirmation = NSAlert(); confirmation.messageText = "Editorial rebuild — not visual compatibility"
            confirmation.informativeText = LegacyEditorialRebuild.warning
            confirmation.addButton(withTitle: "Cancel"); confirmation.addButton(withTitle: "Rebuild Without Unsupported Features")
            guard confirmation.runModal() == .alertSecondButtonReturn else { return }
        }
        guard mayReplace() else { return }
        do {
            var next: Project
            if rebuildCuts { next = try LegacyEditorialRebuild.rebuild(data, filename: url.lastPathComponent, linked: linked) }
            else {
                // A NEW media-only document. Never replace a prior archived source.
                next = Project(name: report.name + " — Native rebuild"); next.legacyArchive = try LegacyArchive(filename: url.lastPathComponent, data: data)
                for reference in report.media { if let item = linked[reference.id], !next.media.contains(where: { $0.path == item.path }) { next.media.append(item) } }
            }
            _ = try next.validated()
            adoptImported(next)
            status.stringValue = rebuildCuts
                ? "Editorial cuts rebuilt · NOT effect/render parity · exact original archived · Save As a new native project"
                : "Imported \(next.media.count) linked sources only; \(skipped.count) unavailable/unsupported. Original document archived. No timeline or effects converted."
            if !skipped.isEmpty {
                let notice = NSAlert(); notice.messageText = "Some sources were not imported"
                notice.informativeText = "Missing paths, unsupported images or unreadable media:\n" + skipped.prefix(30).joined(separator: "\n") + "\nThe exact original document is retained. Relink in the existing Pro app or import supported video/audio here."
                notice.runModal()
            }
        } catch { fail(error) }
    }
    /// Open an imported project as a new, unsaved document with fresh undo history.
    private func adoptImported(_ next: Project) {
        do {
            history = DocumentHistory(Project()); try history.apply(next)
            documentURL = nil; activeSequenceId = next.mainSequenceId; selectedClipId = nil; playhead = 0; sequenceViews = [:]; mediaSearch.stringValue = ""
            reload(); journal()
        } catch { fail(error) }
    }
    func restoreLegacy() {
        guard let archive = project.legacyArchive else { return }
        let panel = NSSavePanel(); panel.nameFieldStringValue = archive.filename
        panel.message = "Save the exact original Pro document to a NEW file. This contains the original edit, not changes made in the native rebuild."
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            // .withoutOverwriting rejects existing files, including after the save dialog.
            try archive.data.write(to: url, options: .withoutOverwriting)
            status.stringValue = "Recovered original document byte-for-byte: \(url.lastPathComponent)"
        } catch { fail(error) }
    }
    func editSequenceSettings() {
        let alert = NSAlert(); alert.messageText = "Sequence settings"
        alert.informativeText = "Nested compositions require matching dimensions. An incompatible change is rejected without changing your project."
        let name = NSTextField(string: sequence.name), width = NSTextField(string: String(sequence.width)), height = NSTextField(string: String(sequence.height)), rate = NSPopUpButton()
        rate.addItems(withTitles: ["24","25","30","50","60"]); rate.selectItem(withTitle: String(sequence.frameRate))
        name.setAccessibilityLabel("Sequence name"); width.setAccessibilityLabel("Sequence width"); height.setAccessibilityLabel("Sequence height"); rate.setAccessibilityLabel("Sequence frame rate")
        let stack = vertical([label("Name"),name,label("Width / height (even pixels)"),NSStackView(views: [width,height]),label("Frames per second"),rate])
        stack.frame = NSRect(x: 0, y: 0, width: 360, height: 210)
        alert.accessoryView = stack; alert.addButton(withTitle: "Apply"); alert.addButton(withTitle: "Cancel")
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        guard let w = Int(width.stringValue), let h = Int(height.stringValue), let fps = Int(rate.titleOfSelectedItem ?? ""), !name.stringValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { fail(ProjectError.invalid("Enter a name and valid integer dimensions.")); return }
        do { apply(try Edit.transact(project, sequenceId: activeSequenceId) { $0.name = name.stringValue; $0.width = w; $0.height = h; $0.frameRate = fps }) } catch { fail(error) }
    }
}
