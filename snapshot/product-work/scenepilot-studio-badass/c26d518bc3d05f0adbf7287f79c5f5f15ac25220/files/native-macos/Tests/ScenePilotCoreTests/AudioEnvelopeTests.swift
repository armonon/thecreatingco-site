import XCTest
import ScenePilotCore

final class AudioEnvelopeTests: XCTestCase {
    func testNestedProductMatchesDenseSamplesWithinBound() throws {
        let envelopes = [AudioFadeEnvelope(start:0,duration:3,fadeIn:1.5,fadeOut:1.5),AudioFadeEnvelope(start:-0.3,duration:4,fadeIn:2,fadeOut:2),AudioFadeEnvelope(start:0,duration:3,fadeIn:0.4,fadeOut:0.8)]
        let ramps = try AudioEnvelope.ramps(envelopes,gain:0.7,from:0,to:3)
        var index = 0
        for i in 0..<30_000 {
            let t = Double(i)/10_000
            while index+1 < ramps.count && ramps[index].end < t { index += 1 }
            let r = ramps[index], actual = r.from+(r.to-r.from)*(t-r.start)/(r.end-r.start)
            let expected = envelopes.reduce(0.7) { $0*$1.value(at:t) }
            XCTAssertEqual(actual,expected,accuracy:0.00001001)
        }
    }
    func testNonlinearPeakIsNotFlattenedAndSingleFadeRemainsExact() throws {
        let e = AudioFadeEnvelope(start:0,duration:2,fadeIn:1,fadeOut:1)
        let single = try AudioEnvelope.ramps([e],gain:1,from:0,to:2)
        XCTAssertEqual(single.count,2); XCTAssertEqual(single[0].from,0); XCTAssertEqual(single[0].to,1)
        let rising = AudioFadeEnvelope(start:0,duration:4,fadeIn:2,fadeOut:0)
        let falling = AudioFadeEnvelope(start:-2,duration:4,fadeIn:0,fadeOut:2)
        let product = try AudioEnvelope.ramps([rising,falling],gain:1,from:0,to:2)
        XCTAssertGreaterThan(product.count,20)
        XCTAssertGreaterThan(product.map(\.to).max()!,0.249)
    }
    func testInvalidAndPathologicalAudioRefuse() {
        XCTAssertThrowsError(try AudioEnvelope.ramps([],gain:.infinity,from:0,to:2))
        XCTAssertThrowsError(try AudioEnvelope.ramps([],gain:1,from:2,to:0))
        let e = AudioFadeEnvelope(start:0,duration:2,fadeIn:1,fadeOut:1)
        XCTAssertThrowsError(try AudioEnvelope.ramps([e,e],gain:1e30,from:0,to:2))
        XCTAssertThrowsError(try AudioEnvelope.ramps(Array(repeating:e,count:33),gain:1,from:0,to:2))
    }
}
