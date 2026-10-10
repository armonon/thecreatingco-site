// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ScenePilotNative",
    platforms: [.macOS(.v13)],
    products: [.executable(name: "ScenePilotNative", targets: ["ScenePilotNative"])],
    targets: [
        .target(name: "ScenePilotCore"),
        .target(name: "ScenePilotMedia", dependencies: ["ScenePilotCore"]),
        .executableTarget(name: "ScenePilotNative", dependencies: ["ScenePilotCore", "ScenePilotMedia"]),
        .testTarget(name: "ScenePilotCoreTests", dependencies: ["ScenePilotCore"]),
        .testTarget(name: "ScenePilotMediaTests", dependencies: ["ScenePilotCore", "ScenePilotMedia"]),
    ]
)
