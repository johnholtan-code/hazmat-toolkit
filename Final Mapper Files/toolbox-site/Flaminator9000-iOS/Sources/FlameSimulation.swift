import CoreGraphics
import ImageIO
import Photos
import PhotosUI
import SpriteKit
import SwiftUI
import UniformTypeIdentifiers
import UIKit

typealias EmitterID = UUID

struct FlameControls: Codable, Equatable {
    var amount: Double = 50
    var opacity: Double = 0.85
    var size: Double = 0.20
    var rise: Double = 28
    var angle: Double = 0
    var length: Double = 1.0
    var width: Double = 1.0
    var colorTemp: Double = 50
    var smokeColor: Double = 0

    static let defaults = FlameControls()
}

struct EmitterState: Identifiable {
    let id: EmitterID
    var position: CGPoint
    var controls: FlameControls
    var spriteTunings: SpriteEmitterTunings
}

struct EmitterListItem: Identifiable, Hashable {
    let id: EmitterID
    let displayName: String
}

struct FlameParticle {
    var position: CGPoint
    var velocity: CGVector
    var life: Double
    var age: Double
    var size: Double
    var wobble: Double
    var opacity: Double
    var colorTemp: Double
    var smokeColor: Double
}

struct FlameEmitterSnapshot {
    let id: EmitterID
    let normalizedPosition: CGPoint
    let controls: FlameControls
    let spriteTunings: SpriteEmitterTunings
    let isActive: Bool
    let isEnabled: Bool
}

struct FlameRenderSnapshot {
    let backgroundImage: UIImage?
    let emitters: [FlameEmitterSnapshot]
}

struct SpriteEmitterTuning: Codable, Equatable {
    var birthRate: Double
    var lifetime: Double
    var lifetimeRange: Double
    var speed: Double
    var speedRange: Double
    var xAcceleration: Double
    var yAcceleration: Double
    var emissionAngleDegrees: Double
    var emissionAngleRangeDegrees: Double
    var positionRangeX: Double
    var positionRangeY: Double
    var scale: Double
    var scaleRange: Double
    var scaleSpeed: Double
    var alpha: Double
    var alphaRange: Double
    var alphaSpeed: Double
    var colorBlendFactor: Double
}

struct SpriteEmitterTunings: Codable, Equatable {
    var flame: SpriteEmitterTuning
    var smoke: SpriteEmitterTuning

    static let defaults = SpriteEmitterTunings(
        flame: SpriteEmitterTuning(
            birthRate: 280,
            lifetime: 0.7,
            lifetimeRange: 0.35,
            speed: 140,
            speedRange: 50,
            xAcceleration: 0,
            yAcceleration: 80,
            emissionAngleDegrees: 90,
            emissionAngleRangeDegrees: 63,
            positionRangeX: 26,
            positionRangeY: 6,
            scale: 0.16,
            scaleRange: 0.12,
            scaleSpeed: -0.13,
            alpha: 0.9,
            alphaRange: 0.0,
            alphaSpeed: -1.1,
            colorBlendFactor: 1.0
        ),
        smoke: SpriteEmitterTuning(
            birthRate: 70,
            lifetime: 1.6,
            lifetimeRange: 0.7,
            speed: 55,
            speedRange: 24,
            xAcceleration: 0,
            yAcceleration: 12,
            emissionAngleDegrees: 90,
            emissionAngleRangeDegrees: 58,
            positionRangeX: 20,
            positionRangeY: 6,
            scale: 0.20,
            scaleRange: 0.12,
            scaleSpeed: 0.10,
            alpha: 0.18,
            alphaRange: 0.0,
            alphaSpeed: -0.09,
            colorBlendFactor: 1.0
        )
    )
}

struct GIFExportSettings: Codable, Equatable {
    var durationSeconds: Double = 2.5
    var fps: Double = 12
    var resolutionScale: Double = 1.0
    var transparentBackground: Bool = false

    static let defaults = GIFExportSettings()
}

@MainActor
final class FlameSimulationStore: ObservableObject {
    @Published var activeEmitterID: EmitterID
    @Published private(set) var defaultControls = FlameControls.defaults
    @Published private(set) var backgroundImage: UIImage?
    @Published private(set) var spriteTunings = SpriteEmitterTunings.defaults
    @Published private(set) var isExportingGIF = false
    @Published private(set) var gifExportSettings = GIFExportSettings.defaults

    @Published private(set) var emitters: [EmitterState]
    private var particles: [FlameParticle] = []
    private var lastTickDate: Date?
    private var canvasSize: CGSize = .zero
    private var noiseSeed = Double.random(in: 0...10_000)
    private weak var stageView: SKView?
    private weak var stageScene: FlameSpriteScene?

    private let defaultsKey = "Flaminator9000.defaultControls"
    private let spriteTuningsKey = "Flaminator9000.spriteEmitterTunings"
    private let gifExportSettingsKey = "Flaminator9000.gifExportSettings"

    init() {
        let firstID = UUID()
        _activeEmitterID = Published(initialValue: firstID)
        _emitters = Published(initialValue: [
            EmitterState(
                id: firstID,
                position: CGPoint(x: 0.50, y: 0.90),
                controls: .defaults,
                spriteTunings: .defaults
            )
        ])
        loadDefaults()
        loadSpriteTunings()
        loadGIFExportSettings()
    }

    var hasPhoto: Bool {
        backgroundImage != nil
    }

    var emitterChoices: [EmitterListItem] {
        emitters.enumerated().map { index, emitter in
            EmitterListItem(id: emitter.id, displayName: "Emitter \(index + 1)")
        }
    }

    var activeEmitterDisplayName: String {
        guard let index = emitters.firstIndex(where: { $0.id == activeEmitterID }) else {
            return "Emitter"
        }
        return "Emitter \(index + 1)"
    }

    var canRemoveEmitter: Bool {
        emitters.count > 1
    }

    func addEmitter() {
        let id = UUID()
        let position = nextEmitterDefaultPosition(forIndex: emitters.count)
        let sourceControls = activeEmitterIndex.map { emitters[$0].controls } ?? defaultControls
        let sourceTunings = activeEmitterIndex.map { emitters[$0].spriteTunings } ?? spriteTunings
        emitters.append(
            EmitterState(
                id: id,
                position: position,
                controls: sourceControls,
                spriteTunings: sourceTunings
            )
        )
        activeEmitterID = id
        objectWillChange.send()
    }

    func removeActiveEmitter() {
        guard emitters.count > 1 else { return }
        guard let index = emitters.firstIndex(where: { $0.id == activeEmitterID }) else { return }
        emitters.remove(at: index)
        let newIndex = min(index, emitters.count - 1)
        activeEmitterID = emitters[newIndex].id
        objectWillChange.send()
    }

    func resetEmitterPositions() {
        for index in emitters.indices {
            emitters[index].position = nextEmitterDefaultPosition(forIndex: index)
        }
        objectWillChange.send()
    }

    func setActiveEmitterPosition(x: CGFloat, y: CGFloat) {
        guard let index = activeEmitterIndex else { return }
        emitters[index].position = CGPoint(x: x, y: y)
        objectWillChange.send()
    }

    func bindingForActive(_ keyPath: WritableKeyPath<FlameControls, Double>) -> Binding<Double> {
        Binding(
            get: { [weak self] in
                guard let self else { return 0 }
                return self.controlsForActive[keyPath: keyPath]
            },
            set: { [weak self] newValue in
                self?.setActiveControl(keyPath, value: newValue)
            }
        )
    }

    func bindingForFlameTuning(_ keyPath: WritableKeyPath<SpriteEmitterTuning, Double>) -> Binding<Double> {
        Binding(
            get: { [weak self] in
                guard let self, let index = self.activeEmitterIndex else { return 0 }
                return self.emitters[index].spriteTunings.flame[keyPath: keyPath]
            },
            set: { [weak self] newValue in
                self?.setFlameTuning(keyPath, value: newValue)
            }
        )
    }

    func bindingForSmokeTuning(_ keyPath: WritableKeyPath<SpriteEmitterTuning, Double>) -> Binding<Double> {
        Binding(
            get: { [weak self] in
                guard let self, let index = self.activeEmitterIndex else { return 0 }
                return self.emitters[index].spriteTunings.smoke[keyPath: keyPath]
            },
            set: { [weak self] newValue in
                self?.setSmokeTuning(keyPath, value: newValue)
            }
        )
    }

    func bindingForGIFExport(_ keyPath: WritableKeyPath<GIFExportSettings, Double>) -> Binding<Double> {
        Binding(
            get: { [weak self] in
                self?.gifExportSettings[keyPath: keyPath] ?? 0
            },
            set: { [weak self] newValue in
                self?.setGIFExportSetting(keyPath, value: newValue)
            }
        )
    }

    func bindingForGIFExport(_ keyPath: WritableKeyPath<GIFExportSettings, Bool>) -> Binding<Bool> {
        Binding(
            get: { [weak self] in
                self?.gifExportSettings[keyPath: keyPath] ?? false
            },
            set: { [weak self] newValue in
                self?.setGIFExportSetting(keyPath, value: newValue)
            }
        )
    }

    private var activeEmitterIndex: Int? {
        emitters.firstIndex(where: { $0.id == activeEmitterID })
    }

    private var controlsForActive: FlameControls {
        guard let index = activeEmitterIndex else { return defaultControls }
        return emitters[index].controls
    }

    private func setActiveControl(_ keyPath: WritableKeyPath<FlameControls, Double>, value: Double) {
        guard let index = activeEmitterIndex else { return }
        emitters[index].controls[keyPath: keyPath] = value
        objectWillChange.send()
    }

    private func nextEmitterDefaultPosition(forIndex index: Int) -> CGPoint {
        let columns = 4
        let slot = max(0, index)
        let row = slot / columns
        let col = slot % columns
        let startX: CGFloat = 0.35
        let spacingX: CGFloat = 0.10
        let baseY: CGFloat = 0.90
        let spacingY: CGFloat = 0.06
        let x = min(0.95, startX + CGFloat(col) * spacingX)
        let y = max(0.55, baseY - CGFloat(row) * spacingY)
        return CGPoint(x: x, y: y)
    }

    private func setFlameTuning(_ keyPath: WritableKeyPath<SpriteEmitterTuning, Double>, value: Double) {
        guard let index = activeEmitterIndex else { return }
        emitters[index].spriteTunings.flame[keyPath: keyPath] = value
        objectWillChange.send()
    }

    private func setSmokeTuning(_ keyPath: WritableKeyPath<SpriteEmitterTuning, Double>, value: Double) {
        guard let index = activeEmitterIndex else { return }
        emitters[index].spriteTunings.smoke[keyPath: keyPath] = value
        objectWillChange.send()
    }

    func resetSpriteTunings() {
        guard let index = activeEmitterIndex else { return }
        emitters[index].spriteTunings = spriteTunings
        objectWillChange.send()
    }

    func resetGIFExportSettings() {
        gifExportSettings = .defaults
        persistGIFExportSettings()
        objectWillChange.send()
    }

    private func setGIFExportSetting(_ keyPath: WritableKeyPath<GIFExportSettings, Double>, value: Double) {
        gifExportSettings[keyPath: keyPath] = value
        persistGIFExportSettings()
        objectWillChange.send()
    }

    private func setGIFExportSetting(_ keyPath: WritableKeyPath<GIFExportSettings, Bool>, value: Bool) {
        gifExportSettings[keyPath: keyPath] = value
        persistGIFExportSettings()
        objectWillChange.send()
    }

    func applyDefaults(_ controls: FlameControls) {
        defaultControls = controls
        for index in emitters.indices {
            emitters[index].controls.amount = controls.amount
            emitters[index].controls.opacity = controls.opacity
            emitters[index].controls.size = controls.size
            emitters[index].controls.rise = controls.rise
            emitters[index].controls.colorTemp = controls.colorTemp
            emitters[index].controls.smokeColor = controls.smokeColor
        }
        persistDefaults()
        objectWillChange.send()
    }

    private func loadDefaults() {
        guard
            let data = UserDefaults.standard.data(forKey: defaultsKey),
            let controls = try? JSONDecoder().decode(FlameControls.self, from: data)
        else {
            defaultControls = .defaults
            return
        }
        defaultControls = controls
        applyDefaults(controls)
    }

    private func persistDefaults() {
        guard let data = try? JSONEncoder().encode(defaultControls) else { return }
        UserDefaults.standard.set(data, forKey: defaultsKey)
    }

    private func loadSpriteTunings() {
        guard
            let data = UserDefaults.standard.data(forKey: spriteTuningsKey),
            let tunings = try? JSONDecoder().decode(SpriteEmitterTunings.self, from: data)
        else {
            spriteTunings = .defaults
            for index in emitters.indices {
                emitters[index].spriteTunings = .defaults
            }
            return
        }
        spriteTunings = tunings
        for index in emitters.indices {
            emitters[index].spriteTunings = tunings
        }
    }

    private func persistSpriteTunings() {
        guard let data = try? JSONEncoder().encode(spriteTunings) else { return }
        UserDefaults.standard.set(data, forKey: spriteTuningsKey)
    }

    private func loadGIFExportSettings() {
        guard
            let data = UserDefaults.standard.data(forKey: gifExportSettingsKey),
            let settings = try? JSONDecoder().decode(GIFExportSettings.self, from: data)
        else {
            gifExportSettings = .defaults
            return
        }
        gifExportSettings = settings
    }

    private func persistGIFExportSettings() {
        guard let data = try? JSONEncoder().encode(gifExportSettings) else { return }
        UserDefaults.standard.set(data, forKey: gifExportSettingsKey)
    }

    func clearPhoto() {
        backgroundImage = nil
    }

    func registerStageRenderer(view: SKView, scene: FlameSpriteScene) {
        stageView = view
        stageScene = scene
    }

    enum GIFExportError: LocalizedError {
        case stageUnavailable
        case frameCaptureFailed
        case encoderCreationFailed
        case encoderFinalizeFailed
        case photoPermissionDenied
        case photoSaveFailed

        var errorDescription: String? {
            switch self {
            case .stageUnavailable:
                return "The flame stage is not ready yet."
            case .frameCaptureFailed:
                return "Could not capture animation frames."
            case .encoderCreationFailed:
                return "Could not create GIF encoder."
            case .encoderFinalizeFailed:
                return "Could not finalize GIF file."
            case .photoPermissionDenied:
                return "Photo Library access is required to save the GIF."
            case .photoSaveFailed:
                return "Could not save the GIF to Photos."
            }
        }
    }

    func exportCurrentStageGIFToPhotos() async throws -> URL {
        guard !isExportingGIF else { throw GIFExportError.stageUnavailable }
        guard let stageView, let stageScene else { throw GIFExportError.stageUnavailable }
        guard stageView.bounds.width > 1, stageView.bounds.height > 1 else {
            throw GIFExportError.stageUnavailable
        }

        isExportingGIF = true
        defer { isExportingGIF = false }

        let settings = gifExportSettings
        let exportDuration = max(0.5, settings.durationSeconds)
        let exportFPS = max(1, Int(settings.fps.rounded()))
        let resolutionScale = max(0.25, settings.resolutionScale)
        let transparentBackground = settings.transparentBackground

        let frameCount = max(2, Int((exportDuration * Double(exportFPS)).rounded()))
        let delay = 1.0 / Double(exportFPS)
        let frameDelayNs = UInt64(delay * 1_000_000_000)

        var frames: [CGImage] = []
        frames.reserveCapacity(frameCount)

        let originalViewTransparency = stageView.allowsTransparency
        let originalViewOpaque = stageView.isOpaque
        stageView.allowsTransparency = transparentBackground || originalViewTransparency
        stageView.isOpaque = !stageView.allowsTransparency
        let exportState = stageScene.beginExportCapture(transparentBackground: transparentBackground)
        defer {
            stageScene.endExportCapture(exportState)
            stageView.allowsTransparency = originalViewTransparency
            stageView.isOpaque = originalViewOpaque
        }

        for index in 0..<frameCount {
            if index > 0 {
                try await Task.sleep(nanoseconds: frameDelayNs)
            }
            guard let image = captureStageFrame(
                from: stageView,
                scene: stageScene,
                scale: resolutionScale,
                transparentBackground: transparentBackground
            ) else {
                throw GIFExportError.frameCaptureFailed
            }
            frames.append(image)
        }

        let fileURL = try writeGIF(frames: frames, frameDelay: delay)
        try await saveGIFToPhotos(fileURL: fileURL)
        return fileURL
    }

    private func captureStageFrame(
        from view: SKView,
        scene: SKScene,
        scale: Double,
        transparentBackground: Bool
    ) -> CGImage? {
        guard view.bounds.width > 1, view.bounds.height > 1 else { return nil }
        let cropRect = CGRect(origin: .zero, size: view.bounds.size)
        if let texture = view.texture(from: scene, crop: cropRect) {
            let cgImage = texture.cgImage()
            return resizedCGImage(cgImage, scale: scale, transparent: transparentBackground)
        }

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = !transparentBackground
        let renderer = UIGraphicsImageRenderer(size: view.bounds.size, format: format)
        let image = renderer.image { _ in
            if transparentBackground {
                view.layer.render(in: UIGraphicsGetCurrentContext()!)
            } else {
                view.drawHierarchy(in: view.bounds, afterScreenUpdates: true)
            }
        }
        guard let cgImage = image.cgImage else { return nil }
        return resizedCGImage(cgImage, scale: scale, transparent: transparentBackground)
    }

    private func resizedCGImage(_ image: CGImage, scale: Double, transparent: Bool) -> CGImage? {
        guard abs(scale - 1.0) > 0.001 else { return image }
        let width = max(1, Int((Double(image.width) * scale).rounded()))
        let height = max(1, Int((Double(image.height) * scale).rounded()))
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = !transparent
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height), format: format)
        let resized = renderer.image { _ in
            UIImage(cgImage: image).draw(in: CGRect(x: 0, y: 0, width: width, height: height))
        }
        return resized.cgImage
    }

    private func writeGIF(frames: [CGImage], frameDelay: Double) throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("Flaminator-\(UUID().uuidString)")
            .appendingPathExtension("gif")

        guard let destination = CGImageDestinationCreateWithURL(
            url as CFURL,
            UTType.gif.identifier as CFString,
            frames.count,
            nil
        ) else {
            throw GIFExportError.encoderCreationFailed
        }

        let loopProps: [CFString: Any] = [
            kCGImagePropertyGIFLoopCount: 0
        ]
        let fileProps: [CFString: Any] = [
            kCGImagePropertyGIFDictionary: loopProps
        ]
        CGImageDestinationSetProperties(destination, fileProps as CFDictionary)

        let frameProps: [CFString: Any] = [
            kCGImagePropertyGIFDictionary: [
                kCGImagePropertyGIFDelayTime: frameDelay
            ]
        ]

        for frame in frames {
            CGImageDestinationAddImage(destination, frame, frameProps as CFDictionary)
        }

        guard CGImageDestinationFinalize(destination) else {
            throw GIFExportError.encoderFinalizeFailed
        }
        return url
    }

    private func saveGIFToPhotos(fileURL: URL) async throws {
        let status = await requestPhotoAddPermission()
        guard status == .authorized || status == .limited else {
            throw GIFExportError.photoPermissionDenied
        }

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            PHPhotoLibrary.shared().performChanges {
                let request = PHAssetCreationRequest.forAsset()
                request.addResource(with: .photo, fileURL: fileURL, options: nil)
            } completionHandler: { success, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if success {
                    continuation.resume()
                } else {
                    continuation.resume(throwing: GIFExportError.photoSaveFailed)
                }
            }
        }
    }

    private func requestPhotoAddPermission() async -> PHAuthorizationStatus {
        await withCheckedContinuation { continuation in
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
                continuation.resume(returning: status)
            }
        }
    }

    func loadPhoto(from item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data) else { return }
        backgroundImage = image
    }

    func renderSnapshot() -> FlameRenderSnapshot {
        FlameRenderSnapshot(
            backgroundImage: backgroundImage,
            emitters: emitters.map { emitter in
                FlameEmitterSnapshot(
                    id: emitter.id,
                    normalizedPosition: emitter.position,
                    controls: emitter.controls,
                    spriteTunings: emitter.spriteTunings,
                    isActive: emitter.id == activeEmitterID,
                    isEnabled: true
                )
            }
        )
    }

    func updateFrame(at date: Date, canvasSize: CGSize) {
        guard canvasSize.width > 0, canvasSize.height > 0 else { return }
        self.canvasSize = canvasSize

        let dt: Double
        if let lastTickDate {
            dt = min(0.05, max(0.0, date.timeIntervalSince(lastTickDate)))
        } else {
            dt = 1.0 / 60.0
        }
        lastTickDate = date

        spawn(dt: dt)
        step(dt: dt)
    }

    func draw(into context: inout GraphicsContext, size: CGSize) {
        context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(.black))

        if let image = backgroundImage {
            let target = aspectFitRect(imageSize: image.size, in: CGRect(origin: .zero, size: size))
            context.draw(Image(uiImage: image), in: target)
        }

        drawEmitterMarkers(into: context, size: size)

        context.blendMode = .plusLighter
        for particle in particles {
            drawFlameParticle(particle, into: context)
        }
        context.blendMode = .normal

        for particle in particles where particle.age / particle.life > 0.6 {
            drawSmoke(particle, into: context)
        }
    }

    private func drawEmitterMarkers(into context: GraphicsContext, size: CGSize) {
        for emitter in emitters {
            let point = CGPoint(x: emitter.position.x * size.width, y: emitter.position.y * size.height)
            let markerRect = CGRect(x: point.x - 8, y: point.y - 8, width: 16, height: 16)
            let path = Path(ellipseIn: markerRect)
            let isActive = emitter.id == activeEmitterID
            context.fill(path, with: .color(isActive ? .yellow : .orange.opacity(0.7)))
            context.stroke(path, with: .color(.black.opacity(0.8)), lineWidth: 1.5)
        }
    }

    private func spawn(dt: Double) {
        for emitter in emitters {
            spawn(from: emitter, dt: dt)
        }
    }

    private func spawn(from emitter: EmitterState, dt: Double) {
        let controls = emitter.controls
        let rate = controls.amount * 0.9
        let expected = rate * dt
        var count = Int(expected.rounded(.down))
        if Double.random(in: 0...1) < (expected - floor(expected)) {
            count += 1
        }

        let origin = CGPoint(
            x: emitter.position.x * canvasSize.width,
            y: emitter.position.y * canvasSize.height
        )
        let angle = controls.angle * .pi / 180.0

        for _ in 0..<count {
            let spread = random(-1.4, 1.4) * controls.size * controls.width
            let lift = -random(1.2, 2.6) * controls.rise * 0.045 * controls.length
            let vx = cos(angle) * spread - sin(angle) * lift * 0.25
            let vy = sin(angle) * spread + cos(angle) * lift

            particles.append(
                FlameParticle(
                    position: CGPoint(
                        x: origin.x + random(-18, 18),
                        y: origin.y + random(-6, 6)
                    ),
                    velocity: CGVector(dx: vx, dy: vy),
                    life: random(1.6, 3.1) * controls.length,
                    age: 0,
                    size: (controls.size * 100.0) * random(0.6, 2.0),
                    wobble: random(0, 1000),
                    opacity: controls.opacity,
                    colorTemp: controls.colorTemp,
                    smokeColor: controls.smokeColor
                )
            )
        }
    }

    private func step(dt: Double) {
        guard !particles.isEmpty else { return }
        for i in particles.indices {
            var p = particles[i]
            let t = p.age * 0.6
            let turb = (smoothNoise(x: p.position.x * 0.015, y: p.position.y * 0.015 + t) - 0.5) * 2.0
            let swirl = (smoothNoise(x: p.position.y * 0.01 + p.wobble, y: p.position.x * 0.01) - 0.5) * 2.0

            p.velocity.dx += turb * 0.25
            p.velocity.dy += -abs(swirl) * 0.12
            p.position.x += p.velocity.dx * dt * 60.0
            p.position.y += p.velocity.dy * dt * 60.0
            p.velocity.dx *= random(0.95, 1.03)
            p.age += dt
            particles[i] = p
        }

        particles.removeAll { $0.age > $0.life }
    }

    private func drawFlameParticle(_ particle: FlameParticle, into context: GraphicsContext) {
        let t = particle.age / max(0.0001, particle.life)
        let flicker = 0.85 + 0.25 * sin((particle.age * 12.0) + particle.wobble)
        let alpha = particle.opacity * (1.0 - t) * flicker
        let radius = particle.size * (0.55 + t * 0.9)

        let coreRect = CGRect(
            x: particle.position.x - (radius * 0.7),
            y: particle.position.y - (radius * 0.7),
            width: radius * 1.4,
            height: radius * 1.4
        )
        let corePath = Path(ellipseIn: coreRect)
        context.fill(
            corePath,
            with: .radialGradient(
                Gradient(colors: [
                    Color.white.opacity(alpha * 1.15),
                    Color(red: 1.0, green: 0.86, blue: 0.47).opacity(alpha * 0.9),
                    Color(red: 1.0, green: 0.70, blue: 0.31).opacity(0)
                ]),
                center: particle.position,
                startRadius: 0,
                endRadius: radius * 0.45
            )
        )

        let base = colorTempColor(particle.colorTemp)
        let envelopeRect = CGRect(
            x: particle.position.x - radius,
            y: particle.position.y - radius,
            width: radius * 2,
            height: radius * 2
        )
        context.fill(
            Path(ellipseIn: envelopeRect),
            with: .radialGradient(
                Gradient(stops: [
                    .init(color: base.opacity(alpha * 0.9), location: 0),
                    .init(color: base.opacity(alpha * 0.6), location: 0.35),
                    .init(color: base.opacity(0), location: 1)
                ]),
                center: particle.position,
                startRadius: 0,
                endRadius: radius
            )
        )

        let emberRadius = radius * (1.1 + t * 0.6)
        let emberAlpha = alpha * (0.35 + 0.25 * sin(particle.wobble + particle.age * 6))
        let emberRect = CGRect(
            x: particle.position.x - emberRadius,
            y: particle.position.y - emberRadius,
            width: emberRadius * 2,
            height: emberRadius * 2
        )
        context.fill(
            Path(ellipseIn: emberRect),
            with: .radialGradient(
                Gradient(stops: [
                    .init(color: Color(red: 0.55, green: 0.24, blue: 0.04).opacity(emberAlpha), location: 0),
                    .init(color: Color(red: 0.70, green: 0.27, blue: 0.06).opacity(emberAlpha * 0.5), location: 0.5),
                    .init(color: Color(red: 0.47, green: 0.20, blue: 0.04).opacity(0), location: 1)
                ]),
                center: particle.position,
                startRadius: 0,
                endRadius: emberRadius
            )
        )
    }

    private func drawSmoke(_ particle: FlameParticle, into context: GraphicsContext) {
        let t = particle.age / max(0.0001, particle.life)
        let smokeAlpha = (t - 0.6) * 1.5
        guard smokeAlpha > 0 else { return }

        let radius = particle.size * (0.55 + t * 0.9) * 1.8
        let shade = min(max(particle.smokeColor / 100.0, 0.0), 1.0)
        let smoke = Color(white: shade, opacity: smokeAlpha)
        let rect = CGRect(x: particle.position.x - radius, y: particle.position.y - radius, width: radius * 2, height: radius * 2)

        context.fill(
            Path(ellipseIn: rect),
            with: .radialGradient(
                Gradient(colors: [smoke, smoke.opacity(0)]),
                center: particle.position,
                startRadius: 0,
                endRadius: radius
            )
        )
    }

    private func aspectFitRect(imageSize: CGSize, in bounds: CGRect) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0 else { return bounds }
        let scale = min(bounds.width / imageSize.width, bounds.height / imageSize.height)
        let size = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
        return CGRect(
            x: bounds.midX - size.width / 2,
            y: bounds.midY - size.height / 2,
            width: size.width,
            height: size.height
        )
    }

    private func colorTempColor(_ value: Double) -> Color {
        switch value {
        case ..<25:
            return Color(red: 1.0, green: 0.31, blue: 0.16)
        case ..<50:
            return Color(red: 1.0, green: 0.55, blue: 0.08)
        case ..<75:
            return Color(red: 1.0, green: 0.78, blue: 0.31)
        default:
            return Color(red: 1.0, green: 0.94, blue: 0.78)
        }
    }

    private func random(_ lower: Double, _ upper: Double) -> Double {
        Double.random(in: lower...upper)
    }

    private func noise2D(x: Double, y: Double) -> Double {
        let s = sin(x * 12.9898 + y * 78.233 + noiseSeed) * 43_758.5453
        return s - floor(s)
    }

    private func smoothNoise(x: Double, y: Double) -> Double {
        let x0 = floor(x)
        let y0 = floor(y)
        let xf = x - x0
        let yf = y - y0

        let n00 = noise2D(x: x0, y: y0)
        let n10 = noise2D(x: x0 + 1, y: y0)
        let n01 = noise2D(x: x0, y: y0 + 1)
        let n11 = noise2D(x: x0 + 1, y: y0 + 1)

        let u = xf * xf * (3 - 2 * xf)
        let v = yf * yf * (3 - 2 * yf)
        let nx0 = n00 * (1 - u) + n10 * u
        let nx1 = n01 * (1 - u) + n11 * u
        return nx0 * (1 - v) + nx1 * v
    }
}
