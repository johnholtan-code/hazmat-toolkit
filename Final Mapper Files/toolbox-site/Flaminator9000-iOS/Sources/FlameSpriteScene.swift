import SpriteKit
import UIKit

@MainActor
final class FlameSpriteScene: SKScene {
    struct ExportCaptureState {
        let backgroundNodeHidden: Bool
        let sceneBackgroundColor: UIColor
    }

    private weak var store: FlameSimulationStore?

    private let backgroundNode = SKSpriteNode(color: .black, size: .zero)
    private let overlayNode = SKNode()
    private var emitterGroups: [EmitterID: EmitterNodeGroup] = [:]

    private var lastBackgroundIdentity: ObjectIdentifier?

    override convenience init() {
        self.init(size: CGSize(width: 1, height: 1))
    }

    override init(size: CGSize) {
        super.init(size: size)
        commonInit()
    }

    required init?(coder aDecoder: NSCoder) {
        super.init(coder: aDecoder)
        commonInit()
    }

    private func commonInit() {
        scaleMode = .resizeFill
        backgroundColor = .black
        anchorPoint = CGPoint(x: 0.5, y: 0.5)

        backgroundNode.anchorPoint = CGPoint(x: 0.5, y: 0.5)
        backgroundNode.position = .zero
        backgroundNode.zPosition = -100
        addChild(backgroundNode)

        overlayNode.zPosition = 100
        addChild(overlayNode)
    }

    func bind(store: FlameSimulationStore) {
        self.store = store
        syncFromStore()
    }

    func beginExportCapture(transparentBackground: Bool) -> ExportCaptureState {
        let state = ExportCaptureState(
            backgroundNodeHidden: backgroundNode.isHidden,
            sceneBackgroundColor: backgroundColor
        )
        if transparentBackground {
            backgroundNode.isHidden = true
            backgroundColor = .clear
        }
        return state
    }

    func endExportCapture(_ state: ExportCaptureState) {
        backgroundNode.isHidden = state.backgroundNodeHidden
        backgroundColor = state.sceneBackgroundColor
    }

    override func didChangeSize(_ oldSize: CGSize) {
        super.didChangeSize(oldSize)
        updateBackgroundLayout()
    }

    override func update(_ currentTime: TimeInterval) {
        super.update(currentTime)
        syncFromStore()
    }

    private func syncFromStore() {
        guard let store else { return }
        let snapshot = store.renderSnapshot()

        updateBackground(snapshot.backgroundImage)
        apply(snapshot: snapshot)
    }

    private func updateBackground(_ image: UIImage?) {
        if let image {
            let identity = ObjectIdentifier(image)
            if identity != lastBackgroundIdentity {
                backgroundNode.texture = SKTexture(image: image)
                backgroundNode.color = .clear
                backgroundNode.size = image.size
                lastBackgroundIdentity = identity
            }
        } else if lastBackgroundIdentity != nil || backgroundNode.texture != nil {
            backgroundNode.texture = nil
            backgroundNode.color = .black
            backgroundNode.size = size
            lastBackgroundIdentity = nil
        }

        updateBackgroundLayout()
    }

    private func updateBackgroundLayout() {
        guard size.width > 0, size.height > 0 else { return }

        if let texture = backgroundNode.texture {
            let imageSize = texture.size()
            guard imageSize.width > 0, imageSize.height > 0 else { return }
            let scale = min(size.width / imageSize.width, size.height / imageSize.height)
            backgroundNode.size = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
        } else {
            backgroundNode.size = size
        }
        backgroundNode.position = .zero
    }

    private func apply(snapshot: FlameRenderSnapshot) {
        let snapshotIDs = Set(snapshot.emitters.map(\.id))
        let existingIDs = Set(emitterGroups.keys)

        for id in existingIDs.subtracting(snapshotIDs) {
            guard let group = emitterGroups.removeValue(forKey: id) else { continue }
            group.root.removeFromParent()
            group.marker.removeFromParent()
        }

        for emitter in snapshot.emitters {
            let group = emitterGroup(for: emitter.id)
            let scenePoint = convertToScenePoint(emitter.normalizedPosition)

            group.root.position = scenePoint
            group.marker.position = scenePoint
            group.marker.isHidden = true

            if emitter.isEnabled {
                group.apply(flameTuning: emitter.spriteTunings.flame, smokeTuning: emitter.spriteTunings.smoke)
                applyDirectionalTweaks(toFlame: group.flame, smoke: group.smoke, controls: emitter.controls)
                group.restoreBirthRates()
            } else {
                group.setBirthRates(flame: 0, smoke: 0)
            }
        }
    }

    private func emitterGroup(for id: EmitterID) -> EmitterNodeGroup {
        if let group = emitterGroups[id] {
            return group
        }
        let group = EmitterNodeGroup()
        group.marker.name = "marker-\(id.uuidString)"
        addChild(group.root)
        overlayNode.addChild(group.marker)
        emitterGroups[id] = group
        return group
    }

    private func convertToScenePoint(_ normalized: CGPoint) -> CGPoint {
        let x = (normalized.x - 0.5) * size.width
        let y = ((1.0 - normalized.y) - 0.5) * size.height
        return CGPoint(x: x, y: y)
    }

    private func applyDirectionalTweaks(toFlame flame: SKEmitterNode, smoke: SKEmitterNode, controls: FlameControls) {
        let angle = CGFloat(controls.angle) * (.pi / 180)
        let directionalAngle = (.pi / 2) - angle
        flame.emissionAngle = directionalAngle
        smoke.emissionAngle = directionalAngle

        let riseBoost = CGFloat(max(0, controls.rise - 28))
        flame.yAcceleration += riseBoost * 0.5
        smoke.yAcceleration += riseBoost * 0.15
    }
}

@MainActor
private final class EmitterNodeGroup {
    let root = SKNode()
    let flame = SKEmitterNode()
    let smoke = SKEmitterNode()
    let marker = SKShapeNode(circleOfRadius: 9)
    private var defaultFlameBirthRate: CGFloat = 0
    private var defaultSmokeBirthRate: CGFloat = 0

    init() {
        root.zPosition = 10

        configureBaseFlame(flame)
        configureBaseSmoke(smoke)
        defaultFlameBirthRate = flame.particleBirthRate
        defaultSmokeBirthRate = smoke.particleBirthRate

        root.addChild(smoke)
        root.addChild(flame)

        marker.zPosition = 200
    }

    private func configureBaseFlame(_ emitter: SKEmitterNode) {
        let loaded = SKEmitterNode(fileNamed: "Flame.sks") ?? SKEmitterNode(fileNamed: "Resources/Flame.sks")
        if let loaded {
            copyEmitterProperties(from: loaded, to: emitter)
        } else {
            emitter.particleBirthRate = 280
            emitter.particleLifetime = 0.7
            emitter.particleLifetimeRange = 0.35
            emitter.emissionAngle = .pi / 2
            emitter.emissionAngleRange = .pi * 0.35
            emitter.particleSpeed = 140
            emitter.particleSpeedRange = 50
            emitter.yAcceleration = 80
            emitter.particlePositionRange = CGVector(dx: 26, dy: 6)
            emitter.particleScale = 0.16
            emitter.particleScaleRange = 0.12
            emitter.particleScaleSpeed = -0.13
            emitter.particleAlpha = 0.9
            emitter.particleAlphaSpeed = -1.1
            emitter.particleBlendMode = .add
            emitter.particleTexture = ParticleTextureFactory.flameTexture
            emitter.particleColor = .orange
            emitter.particleColorBlendFactor = 1
        }
        emitter.name = "flame"
        emitter.targetNode = nil
        emitter.zPosition = 10
    }

    private func configureBaseSmoke(_ emitter: SKEmitterNode) {
        let loaded = SKEmitterNode(fileNamed: "Smoke.sks") ?? SKEmitterNode(fileNamed: "Resources/Smoke.sks")
        if let loaded {
            copyEmitterProperties(from: loaded, to: emitter)
        } else {
            emitter.particleBirthRate = 70
            emitter.particleLifetime = 1.6
            emitter.particleLifetimeRange = 0.7
            emitter.emissionAngle = .pi / 2
            emitter.emissionAngleRange = .pi * 0.32
            emitter.particleSpeed = 55
            emitter.particleSpeedRange = 24
            emitter.yAcceleration = 12
            emitter.particlePositionRange = CGVector(dx: 20, dy: 6)
            emitter.particleScale = 0.20
            emitter.particleScaleRange = 0.12
            emitter.particleScaleSpeed = 0.10
            emitter.particleAlpha = 0.18
            emitter.particleAlphaSpeed = -0.09
            emitter.particleBlendMode = .alpha
            emitter.particleTexture = ParticleTextureFactory.smokeTexture
            emitter.particleColor = .gray
            emitter.particleColorBlendFactor = 1
        }
        emitter.name = "smoke"
        emitter.targetNode = nil
        emitter.zPosition = 9
    }

    func setBirthRates(flame: CGFloat, smoke: CGFloat) {
        self.flame.particleBirthRate = flame
        self.smoke.particleBirthRate = smoke
    }

    func restoreBirthRates() {
        flame.particleBirthRate = defaultFlameBirthRate
        smoke.particleBirthRate = defaultSmokeBirthRate
    }

    func apply(flameTuning: SpriteEmitterTuning, smokeTuning: SpriteEmitterTuning) {
        apply(tuning: flameTuning, to: flame)
        apply(tuning: smokeTuning, to: smoke)
        defaultFlameBirthRate = flame.particleBirthRate
        defaultSmokeBirthRate = smoke.particleBirthRate
    }

    private func apply(tuning: SpriteEmitterTuning, to emitter: SKEmitterNode) {
        emitter.particleBirthRate = CGFloat(tuning.birthRate)
        emitter.particleLifetime = CGFloat(tuning.lifetime)
        emitter.particleLifetimeRange = CGFloat(tuning.lifetimeRange)
        emitter.particleSpeed = CGFloat(tuning.speed)
        emitter.particleSpeedRange = CGFloat(tuning.speedRange)
        emitter.xAcceleration = CGFloat(tuning.xAcceleration)
        emitter.yAcceleration = CGFloat(tuning.yAcceleration)
        emitter.emissionAngle = CGFloat(tuning.emissionAngleDegrees) * (.pi / 180)
        emitter.emissionAngleRange = CGFloat(tuning.emissionAngleRangeDegrees) * (.pi / 180)
        emitter.particlePositionRange = CGVector(
            dx: CGFloat(tuning.positionRangeX),
            dy: CGFloat(tuning.positionRangeY)
        )
        emitter.particleScale = CGFloat(tuning.scale)
        emitter.particleScaleRange = CGFloat(tuning.scaleRange)
        emitter.particleScaleSpeed = CGFloat(tuning.scaleSpeed)
        emitter.particleAlpha = CGFloat(tuning.alpha)
        emitter.particleAlphaRange = CGFloat(tuning.alphaRange)
        emitter.particleAlphaSpeed = CGFloat(tuning.alphaSpeed)
        emitter.particleColorBlendFactor = CGFloat(tuning.colorBlendFactor)
    }

    private func copyEmitterProperties(from source: SKEmitterNode, to target: SKEmitterNode) {
        let sourceName = source.name
        let sourcePosition = source.position
        let sourceZ = source.zPosition
        source.removeFromParent()

        let keys: [String] = [
            "particleTexture",
            "particleZPosition",
            "particleBirthRate",
            "numParticlesToEmit",
            "particleLifetime",
            "particleLifetimeRange",
            "emissionAngle",
            "emissionAngleRange",
            "particleSpeed",
            "particleSpeedRange",
            "xAcceleration",
            "yAcceleration",
            "particlePosition",
            "particlePositionRange",
            "particleRotation",
            "particleRotationRange",
            "particleRotationSpeed",
            "particleScale",
            "particleScaleRange",
            "particleScaleSpeed",
            "particleAlpha",
            "particleAlphaRange",
            "particleAlphaSpeed",
            "particleColor",
            "particleColorRedRange",
            "particleColorGreenRange",
            "particleColorBlueRange",
            "particleColorAlphaRange",
            "particleColorRedSpeed",
            "particleColorGreenSpeed",
            "particleColorBlueSpeed",
            "particleColorAlphaSpeed",
            "particleColorBlendFactor",
            "particleColorBlendFactorRange",
            "particleColorBlendFactorSpeed",
            "particleBlendMode",
            "shader",
            "fieldBitMask",
            "targetNode"
        ]

        for key in keys {
            if let value = source.value(forKey: key) {
                target.setValue(value, forKey: key)
            }
        }

        target.name = sourceName
        target.position = sourcePosition
        target.zPosition = sourceZ
    }
}

private enum ParticleTextureFactory {
    static let flameTexture: SKTexture = {
        SKTexture(image: radialTexture(size: 96) { t in
            if t < 0.28 {
                return UIColor(red: 1, green: 1, blue: 0.92, alpha: 1 - t * 1.2)
            } else if t < 0.65 {
                return UIColor(red: 1, green: 0.70, blue: 0.18, alpha: 0.95 - (t - 0.28) * 0.9)
            } else {
                return UIColor(red: 1, green: 0.32, blue: 0.05, alpha: max(0, 0.45 - (t - 0.65) * 1.3))
            }
        })
    }()

    static let smokeTexture: SKTexture = {
        SKTexture(image: radialTexture(size: 96) { t in
            let alpha = max(0, 0.4 - t * 0.45)
            return UIColor(white: 1, alpha: alpha)
        })
    }()

    private static func radialTexture(size: Int, colorAt: (CGFloat) -> UIColor) -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
        return renderer.image { ctx in
            let cg = ctx.cgContext
            let center = CGPoint(x: CGFloat(size) / 2, y: CGFloat(size) / 2)
            let maxR = CGFloat(size) / 2

            for step in stride(from: size / 2, through: 1, by: -1) {
                let r = CGFloat(step)
                let t = 1 - (r / maxR)
                cg.setFillColor(colorAt(t).cgColor)
                cg.fillEllipse(in: CGRect(x: center.x - r, y: center.y - r, width: r * 2, height: r * 2))
            }
        }
    }
}
