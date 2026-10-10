import XCTest
@testable import ScenePilotCore

final class MaskAnimationTests: XCTestCase {
    func fixture() -> Project {
        var p = Project(); p.media = [Media(path:"/tmp/mask.mov",duration:10,hasVideo:true,hasAudio:true)]
        var c = Clip(assetId:p.media[0].id,trackId:p.sequences[0].tracks[0].id,start:0,duration:3,id:"clip")
        c.mask = ClipMask(shape:.ellipse).convertedToBezier()
        var b = c.mask!; b.x = 0.8; b.width = 0.3; b.feather = 20; b.points?[0].outgoing.x = 0.9
        c.maskAnimation = MaskAnimation(keyframes:[MaskKeyframe(time:0,value:c.mask!),MaskKeyframe(time:2,value:b)])
        p.sequences[0].videoClips = [c]; return p
    }
    func testBezierConversionAndSubdivisionPreserveCubic() throws {
        var mask = ClipMask(shape:.ellipse).convertedToBezier(); let before = mask.points!
        func cubic(_ a:BezierVertex,_ b:BezierVertex,_ t:Double) -> MaskPoint {
            let q0 = a.anchor.mixed(a.outgoing,t), q1 = a.outgoing.mixed(b.incoming,t), q2 = b.incoming.mixed(b.anchor,t)
            return q0.mixed(q1,t).mixed(q1.mixed(q2,t),t)
        }
        try mask.insertVertex(after:0); XCTAssertEqual(mask.points?.count,5)
        for i in 0...100 {
            let t = Double(i)/100, expected = cubic(before[0],before[1],t)
            let actual = t <= 0.5 ? cubic(mask.points![0],mask.points![1],t*2) : cubic(mask.points![1],mask.points![2],(t-0.5)*2)
            XCTAssertEqual(expected.x,actual.x,accuracy:1e-12); XCTAssertEqual(expected.y,actual.y,accuracy:1e-12)
        }
        XCTAssertNoThrow(try mask.validate())
    }
    func testAnimationInterpolatesGeometryHandlesFeatherAndHoldsEndpoints() throws {
        let p = fixture(), c = p.sequences[0].videoClips[0], a = c.maskAnimation!
        let half = a.value(atLocalTime:1)!
        XCTAssertEqual(half.x,0.65,accuracy:1e-12); XCTAssertEqual(half.width,0.525,accuracy:1e-12); XCTAssertEqual(half.feather,10)
        XCTAssertEqual(a.value(atLocalTime:-1),a.keyframes[0].value); XCTAssertEqual(a.value(atLocalTime:9),a.keyframes[1].value)
        for easing in MotionEasing.allCases {
            var curve = a; curve.keyframes[0].easing = easing
            XCTAssertEqual(curve.value(atLocalTime:0.5)!.x,0.5+0.3*easing.progress(0.25),accuracy:1e-12)
            XCTAssertEqual(curve.value(atLocalTime:2),curve.keyframes[1].value)
        }
    }
    func testSplitTrimAndSaveKeepMaskClock() throws {
        for fps in [24,25,30,50,60] {
            var p = fixture(); p.sequences[0].frameRate = fps
            let split = try Edit.split(p,sequenceId:p.mainSequenceId,clipId:"clip",at:1)
            let right = split.sequences[0].videoClips[1]
            XCTAssertEqual(right.maskValue(atLocalTime:0.5),p.sequences[0].videoClips[0].maskValue(atLocalTime:1.5))
            let trim = try Edit.trim(p,sequenceId:p.mainSequenceId,clipId:"clip",edge:.head,to:1)
            XCTAssertEqual(trim.sequences[0].videoClips[0].maskValue(atLocalTime:0.5),right.maskValue(atLocalTime:0.5))
            XCTAssertEqual(try Project.decode(split.encoded()),split)
        }
    }
    func testMaskAutoKeysUndoAndBake() throws {
        let p = fixture(); var pose = p.sequences[0].videoClips[0].maskValue(atLocalTime:1)!; pose.feather = 30
        let keyed = try Edit.mask(p,sequenceId:p.mainSequenceId,clipId:"clip",value:pose,at:1)
        XCTAssertEqual(keyed.sequences[0].videoClips[0].maskAnimation?.keyframes.count,3)
        var history = DocumentHistory(p); try history.apply(keyed); history.undo(); XCTAssertEqual(history.project,p); history.redo(); XCTAssertEqual(history.project,keyed)
        let baked = try Edit.bakeMask(keyed,sequenceId:p.mainSequenceId,clipId:"clip",at:1)
        XCTAssertNil(baked.sequences[0].videoClips[0].maskAnimation); XCTAssertEqual(baked.sequences[0].videoClips[0].mask,pose)
        let removed = try Edit.mask(keyed,sequenceId:p.mainSequenceId,clipId:"clip",value:nil)
        XCTAssertNil(removed.sequences[0].videoClips[0].maskAnimation); XCTAssertNil(removed.sequences[0].videoClips[0].mask)
    }
    func testInvalidTopologyTimesAndLockedKeysRefuse() throws {
        var p = fixture(); var value = p.sequences[0].videoClips[0].mask!
        try value.insertVertex(after:0)
        XCTAssertThrowsError(try Edit.mask(p,sequenceId:p.mainSequenceId,clipId:"clip",value:value,at:1))
        XCTAssertThrowsError(try Edit.maskKey(p,sequenceId:p.mainSequenceId,clipId:"clip",at:3))
        p.sequences[0].tracks[0].locked = true
        XCTAssertThrowsError(try Edit.maskKey(p,sequenceId:p.mainSequenceId,clipId:"clip",at:1))
        XCTAssertThrowsError(try Edit.bakeMask(p,sequenceId:p.mainSequenceId,clipId:"clip",at:1))
        value.points?[0].anchor.x = .nan; XCTAssertThrowsError(try value.validate())
    }
}
