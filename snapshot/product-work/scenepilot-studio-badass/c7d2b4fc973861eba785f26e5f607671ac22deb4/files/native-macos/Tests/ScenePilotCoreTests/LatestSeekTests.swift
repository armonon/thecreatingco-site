import XCTest
@testable import ScenePilotCore

final class LatestSeekTests: XCTestCase {
    func testBurstKeepsOnlyLatestDestination() throws {
        var queue = LatestSeek()
        let first = try XCTUnwrap(queue.submit(0))
        for i in 1...10_000 { XCTAssertNil(queue.submit(Double(i)/30)) }
        let last = try XCTUnwrap(queue.complete(first))
        XCTAssertEqual(last.seconds, 10_000.0/30)
        XCTAssertNil(queue.complete(last)); XCTAssertFalse(queue.isSeeking)
        XCTAssertNil(queue.pending)
    }
    func testResetRejectsOldCompletionsAndDuplicateTargets() throws {
        var queue = LatestSeek()
        let old = try XCTUnwrap(queue.submit(1)); _ = queue.submit(2)
        queue.reset()
        let current = try XCTUnwrap(queue.submit(1)); _ = queue.submit(3)
        XCTAssertNil(queue.complete(old)); XCTAssertEqual(queue.active, current)
        _ = queue.submit(1) // Returning to the in-flight target clears obsolete work.
        XCTAssertNil(queue.pending); XCTAssertNil(queue.complete(current))
        XCTAssertFalse(queue.isSeeking)
    }
    func testFailedOrRepeatedCompletionCannotLoseNewerRequest() throws {
        var queue = LatestSeek()
        XCTAssertNil(queue.submit(.nan)); XCTAssertNil(queue.submit(-1))
        let first = try XCTUnwrap(queue.submit(1)); _ = queue.submit(2)
        let second = try XCTUnwrap(queue.complete(first)); _ = queue.submit(3)
        XCTAssertNil(queue.complete(first))
        let third = try XCTUnwrap(queue.complete(second)); XCTAssertEqual(third.seconds, 3)
        XCTAssertNil(queue.complete(third))
    }
}
