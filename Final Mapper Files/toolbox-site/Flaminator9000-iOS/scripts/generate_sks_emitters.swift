import Foundation
import SpriteKit

func writeEmitter(_ emitter: SKEmitterNode, to path: String) throws {
    let url = URL(fileURLWithPath: path)
    try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    let data = try NSKeyedArchiver.archivedData(withRootObject: emitter, requiringSecureCoding: false)
    try data.write(to: url)
    print("Wrote \(url.path)")
}

func makeFlameEmitter() -> SKEmitterNode {
    let e = SKEmitterNode()
    e.particleBirthRate = 280
    e.particleLifetime = 0.7
    e.particleLifetimeRange = 0.35
    e.emissionAngle = .pi / 2
    e.emissionAngleRange = .pi * 0.35
    e.particleSpeed = 140
    e.particleSpeedRange = 50
    e.xAcceleration = 0
    e.yAcceleration = 80
    e.particlePositionRange = CGVector(dx: 26, dy: 6)
    e.particleScale = 0.16
    e.particleScaleRange = 0.12
    e.particleScaleSpeed = -0.13
    e.particleAlpha = 0.9
    e.particleAlphaRange = 0.18
    e.particleAlphaSpeed = -1.1
    e.particleRotationRange = .pi * 2
    e.particleRotationSpeed = 2.5
    e.particleBlendMode = .add
    e.particleColor = .orange
    e.particleColorBlendFactor = 1
    e.particleColorRedRange = 0.12
    e.particleColorGreenRange = 0.10
    e.particleColorBlueRange = 0.05
    return e
}

func makeSmokeEmitter() -> SKEmitterNode {
    let e = SKEmitterNode()
    e.particleBirthRate = 70
    e.particleLifetime = 1.6
    e.particleLifetimeRange = 0.7
    e.emissionAngle = .pi / 2
    e.emissionAngleRange = .pi * 0.32
    e.particleSpeed = 55
    e.particleSpeedRange = 24
    e.xAcceleration = 0
    e.yAcceleration = 12
    e.particlePositionRange = CGVector(dx: 20, dy: 6)
    e.particleScale = 0.20
    e.particleScaleRange = 0.12
    e.particleScaleSpeed = 0.10
    e.particleAlpha = 0.18
    e.particleAlphaRange = 0.07
    e.particleAlphaSpeed = -0.09
    e.particleRotationRange = .pi * 2
    e.particleRotationSpeed = 0.7
    e.particleBlendMode = .alpha
    e.particleColor = .gray
    e.particleColorBlendFactor = 1
    return e
}

let cwd = FileManager.default.currentDirectoryPath
let resourcesDir = "\(cwd)/Resources"

do {
    try writeEmitter(makeFlameEmitter(), to: "\(resourcesDir)/Flame.sks")
    try writeEmitter(makeSmokeEmitter(), to: "\(resourcesDir)/Smoke.sks")
} catch {
    fputs("Failed: \(error)\n", stderr)
    exit(1)
}

