// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "HazMatDesignSystem",
    platforms: [
        .iOS(.v15)
    ],
    products: [
        .library(
            name: "HazMatDesignSystem",
            targets: ["HazMatDesignSystem"]
        )
    ],
    targets: [
        .target(
            name: "HazMatDesignSystem"
        )
    ]
)
