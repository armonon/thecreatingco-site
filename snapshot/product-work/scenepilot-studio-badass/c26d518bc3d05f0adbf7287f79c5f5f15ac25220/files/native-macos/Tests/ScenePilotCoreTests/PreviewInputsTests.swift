import XCTest
@testable import ScenePilotCore

final class PreviewInputsTests: XCTestCase {
    func fixture() -> Project {
        var p = Project(); p.media = [Media(path:"/test.mp4",duration:3,hasVideo:true,hasAudio:true,id:"media")]
        let child = p.sequences[0]
        p.sequences[0].videoClips = [Clip(assetId:"media",trackId:child.tracks[0].id,start:0,duration:2)]
        var parent = Sequence(name:"Parent",id:"parent")
        parent.videoClips = [Clip(compositionId:child.id,trackId:parent.tracks[0].id,start:0,duration:2)]
        p.sequences.append(parent); p.mainSequenceId = parent.id; return p
    }
    func testEditorMetadataAndUnusedImportsDoNotRebuild() {
        let p = fixture(); var q = p
        q.name = "Renamed"; q.sequences[0].name = "Nested renamed"
        q.sequences[0].tracks[0].locked = true; q.sequences[0].tracks[0].name = "Locked"
        q.media[0].name = "A nicer name"
        q.media.append(Media(path:"/unused.mp4",duration:8,hasVideo:true,hasAudio:true))
        q.sequences.append(Sequence(name:"Unused")); q.sequences.reverse()
        XCTAssertEqual(PreviewInputs(p,sequenceId:"parent"),PreviewInputs(q,sequenceId:"parent"))
    }
    func testEveryNestedRenderEditInvalidatesPreview() {
        let p = fixture()
        let edits: [(inout Project) -> Void] = [
            { $0.sequences[0].videoClips[0].mask = ClipMask(shape:.ellipse) },
            { $0.sequences[0].videoClips[0].gain = 0.5 },
            { $0.sequences[0].videoClips[0].start = 0.1 },
            { $0.sequences[0].tracks[0].enabled = false },
            { $0.sequences[0].tracks[0].gain = 0.2 },
            { $0.sequences[0].tracks.reverse() },
            { $0.sequences[1].width = 1280 },
            { $0.media[0].path = "/replacement.mp4" },
            { $0.media[0].duration = 4 }
        ]
        for edit in edits { var q = p; edit(&q); XCTAssertNotEqual(PreviewInputs(p,sequenceId:"parent"),PreviewInputs(q,sequenceId:"parent")) }
        XCTAssertNotEqual(PreviewInputs(p,sequenceId:"parent"),PreviewInputs(p,sequenceId:p.sequences[0].id))
    }
}
