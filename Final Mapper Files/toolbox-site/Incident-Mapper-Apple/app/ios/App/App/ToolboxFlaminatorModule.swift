// Generated integration source for HazmatToolkitiOS
import Foundation
import PhotosUI
import SwiftUI
import UIKit
import HazMatDesignSystem

@available(iOS 17.0, *)
struct ToolboxFlaminatorModuleView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var simulation: FLAFlameSimulationStore
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var exportAlertMessage: String?
    @State private var shareExportItem: FLAShareExportItem?
    @State private var showingGIFSettings = false

    var body: some View {
        NavigationStack {
            GeometryReader { proxy in
                let isLandscape = proxy.size.width > proxy.size.height
                let isWideLayout = isLandscape && proxy.size.width >= 900
                let inspectorWidth = min(440.0, max(320.0, proxy.size.width * 0.34))

                Group {
                    if isWideLayout {
                        HStack(alignment: .top, spacing: 12) {
                            stageView
                                .frame(maxWidth: .infinity)

                            ControlsPanel()
                                .frame(width: inspectorWidth)
                        }
                    } else {
                        VStack(spacing: 12) {
                            stageView
                            ControlsPanel()
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .padding()
                .background(ThemeColors.panel)
            }
            .navigationTitle("Flaminator 9000")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Back") {
                        dismiss()
                    }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                        Label("Photo", systemImage: "photo")
                    }
                    Button {
                        simulation.clearPhoto()
                    } label: {
                        Label("Clear Photo", systemImage: "xmark.circle")
                    }
                    .disabled(!simulation.hasPhoto)

                    Button {
                        Task { await exportGIF() }
                    } label: {
                        if simulation.isExportingGIF {
                            Label("Exporting…", systemImage: "hourglass")
                        } else {
                            Label("Export GIF", systemImage: "square.and.arrow.down")
                        }
                    }
                    .disabled(simulation.isExportingGIF)

                    Button {
                        showingGIFSettings = true
                    } label: {
                        Label("GIF Settings", systemImage: "slider.horizontal.3")
                    }
                }

            }
        }
        .hazmatBackground()
        .alert("GIF Export", isPresented: Binding(
            get: { exportAlertMessage != nil },
            set: { if !$0 { exportAlertMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(exportAlertMessage ?? "")
        }
        .sheet(item: $shareExportItem) { item in
            FLAActivityView(items: [item.url])
        }
        .sheet(isPresented: $showingGIFSettings) {
            FLAGIFExportSettingsSheet()
                .environmentObject(simulation)
        }
        .task(id: selectedPhotoItem) {
            guard let selectedPhotoItem else { return }
            await simulation.loadPhoto(from: selectedPhotoItem)
        }
    }

    private func exportGIF() async {
        do {
            let url = try await simulation.exportCurrentStageGIFToPhotos()
            shareExportItem = FLAShareExportItem(url: url)
        } catch {
            exportAlertMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    private var stageView: some View {
                FLAFlameStageView()
            .frame(maxWidth: .infinity)
            .aspectRatio(4.0 / 3.0, contentMode: .fit)
            .background(ThemeColors.panel)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(alignment: .topLeading) {
                Text("Tap stage to move \(simulation.activeEmitterDisplayName)")
                    .font(.caption.weight(.medium))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(10)
            }
    }
}

@available(iOS 17.0, *)
private struct ControlsPanel: View {
    @EnvironmentObject private var simulation: FLAFlameSimulationStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                emitterSection
                particleEditorSection
            }
            .padding(14)
            .hazmatPanel()
        }
    }

    private var emitterSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Emitters")
                .font(.headline)

            HStack {
                Text("Active")
                    .font(.subheadline.weight(.medium))
                Spacer()
                Picker("Active Emitter", selection: $simulation.activeEmitterID) {
                    ForEach(simulation.emitterChoices) { emitter in
                        Text(emitter.displayName).tag(emitter.id)
                    }
                }
                .pickerStyle(.menu)
            }

            HStack {
                Button("Add Emitter") {
                    simulation.addEmitter()
                }
                .buttonStyle(.borderedProminent)

                Button("Remove Active") {
                    simulation.removeActiveEmitter()
                }
                .buttonStyle(.bordered)
                .disabled(!simulation.canRemoveEmitter)

                Button("Reset Positions") {
                    simulation.resetEmitterPositions()
                }
                .buttonStyle(.bordered)
            }

            Text("\(simulation.emitterChoices.count) emitters")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var particleEditorSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Particle Tuning")
                    .font(.headline)

                Spacer()

                Button("Reset") {
                    simulation.resetSpriteTunings()
                }
                .buttonStyle(.bordered)
            }

            Text("These sliders tune the currently selected emitter's flame and smoke behavior.")
                .font(.footnote)
                .foregroundStyle(.secondary)

            SpriteEmitterTuningSection(
                title: "Flame",
                tint: .orange,
                labels: .flame,
                birthRate: simulation.bindingForFlameTuning(\.birthRate),
                lifetime: simulation.bindingForFlameTuning(\.lifetime),
                lifetimeRange: simulation.bindingForFlameTuning(\.lifetimeRange),
                speed: simulation.bindingForFlameTuning(\.speed),
                speedRange: simulation.bindingForFlameTuning(\.speedRange),
                xAcceleration: simulation.bindingForFlameTuning(\.xAcceleration),
                yAcceleration: simulation.bindingForFlameTuning(\.yAcceleration),
                emissionAngleDegrees: simulation.bindingForFlameTuning(\.emissionAngleDegrees),
                emissionAngleRangeDegrees: simulation.bindingForFlameTuning(\.emissionAngleRangeDegrees),
                positionRangeX: simulation.bindingForFlameTuning(\.positionRangeX),
                positionRangeY: simulation.bindingForFlameTuning(\.positionRangeY),
                scale: simulation.bindingForFlameTuning(\.scale),
                scaleRange: simulation.bindingForFlameTuning(\.scaleRange),
                scaleSpeed: simulation.bindingForFlameTuning(\.scaleSpeed),
                alpha: simulation.bindingForFlameTuning(\.alpha),
                alphaRange: simulation.bindingForFlameTuning(\.alphaRange),
                alphaSpeed: simulation.bindingForFlameTuning(\.alphaSpeed),
                colorBlendFactor: simulation.bindingForFlameTuning(\.colorBlendFactor)
            )

            SpriteEmitterTuningSection(
                title: "Smoke",
                tint: .gray,
                labels: .smoke,
                birthRate: simulation.bindingForSmokeTuning(\.birthRate),
                lifetime: simulation.bindingForSmokeTuning(\.lifetime),
                lifetimeRange: simulation.bindingForSmokeTuning(\.lifetimeRange),
                speed: simulation.bindingForSmokeTuning(\.speed),
                speedRange: simulation.bindingForSmokeTuning(\.speedRange),
                xAcceleration: simulation.bindingForSmokeTuning(\.xAcceleration),
                yAcceleration: simulation.bindingForSmokeTuning(\.yAcceleration),
                emissionAngleDegrees: simulation.bindingForSmokeTuning(\.emissionAngleDegrees),
                emissionAngleRangeDegrees: simulation.bindingForSmokeTuning(\.emissionAngleRangeDegrees),
                positionRangeX: simulation.bindingForSmokeTuning(\.positionRangeX),
                positionRangeY: simulation.bindingForSmokeTuning(\.positionRangeY),
                scale: simulation.bindingForSmokeTuning(\.scale),
                scaleRange: simulation.bindingForSmokeTuning(\.scaleRange),
                scaleSpeed: simulation.bindingForSmokeTuning(\.scaleSpeed),
                alpha: simulation.bindingForSmokeTuning(\.alpha),
                alphaRange: simulation.bindingForSmokeTuning(\.alphaRange),
                alphaSpeed: simulation.bindingForSmokeTuning(\.alphaSpeed),
                colorBlendFactor: simulation.bindingForSmokeTuning(\.colorBlendFactor)
            )
        }
    }

}

@available(iOS 17.0, *)
private struct SpriteEmitterTuningSection: View {
    struct Labels {
        let birthRate: String
        let lifetime: String
        let lifetimeRange: String
        let speed: String
        let speedRange: String
        let xAcceleration: String
        let yAcceleration: String
        let emissionAngleDegrees: String
        let emissionAngleRangeDegrees: String
        let positionRangeX: String
        let positionRangeY: String
        let scale: String
        let scaleRange: String
        let scaleSpeed: String
        let alpha: String
        let alphaRange: String
        let alphaSpeed: String
        let colorBlendFactor: String

        static let flame = Labels(
            birthRate: "Flame Volume",
            lifetime: "Burn Time",
            lifetimeRange: "Burn Variability",
            speed: "Flame Rise Speed",
            speedRange: "Flame Turbulence",
            xAcceleration: "Side Drift",
            yAcceleration: "Updraft",
            emissionAngleDegrees: "Flame Direction",
            emissionAngleRangeDegrees: "Flame Spread",
            positionRangeX: "Base Width",
            positionRangeY: "Base Depth",
            scale: "Flame Size",
            scaleRange: "Size Variation",
            scaleSpeed: "Flame Stretch",
            alpha: "Brightness",
            alphaRange: "Brightness Variation",
            alphaSpeed: "Fade Rate",
            colorBlendFactor: "Color Strength"
        )

        static let smoke = Labels(
            birthRate: "Smoke Output",
            lifetime: "Hang Time",
            lifetimeRange: "Hang Variability",
            speed: "Smoke Lift",
            speedRange: "Smoke Turbulence",
            xAcceleration: "Cross Drift",
            yAcceleration: "Updraft",
            emissionAngleDegrees: "Drift Direction",
            emissionAngleRangeDegrees: "Spread",
            positionRangeX: "Source Width",
            positionRangeY: "Source Depth",
            scale: "Puff Size",
            scaleRange: "Puff Variation",
            scaleSpeed: "Expansion",
            alpha: "Density",
            alphaRange: "Density Variation",
            alphaSpeed: "Dissipation",
            colorBlendFactor: "Color Strength"
        )
    }

    let title: String
    let tint: Color
    let labels: Labels
    @Binding var birthRate: Double
    @Binding var lifetime: Double
    @Binding var lifetimeRange: Double
    @Binding var speed: Double
    @Binding var speedRange: Double
    @Binding var xAcceleration: Double
    @Binding var yAcceleration: Double
    @Binding var emissionAngleDegrees: Double
    @Binding var emissionAngleRangeDegrees: Double
    @Binding var positionRangeX: Double
    @Binding var positionRangeY: Double
    @Binding var scale: Double
    @Binding var scaleRange: Double
    @Binding var scaleSpeed: Double
    @Binding var alpha: Double
    @Binding var alphaRange: Double
    @Binding var alphaSpeed: Double
    @Binding var colorBlendFactor: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .foregroundStyle(tint)

            SliderField(labels.birthRate, value: $birthRate, range: 0...800, step: 1, format: "%.0f")
            SliderField(labels.lifetime, value: $lifetime, range: 0.05...5.0, step: 0.01, format: "%.2f")
            SliderField(labels.lifetimeRange, value: $lifetimeRange, range: 0...3.0, step: 0.01, format: "%.2f")
            SliderField(labels.speed, value: $speed, range: 0...300, step: 1, format: "%.0f")
            SliderField(labels.speedRange, value: $speedRange, range: 0...300, step: 1, format: "%.0f")
            SliderField(labels.xAcceleration, value: $xAcceleration, range: -300...300, step: 1, format: "%.0f")
            SliderField(labels.yAcceleration, value: $yAcceleration, range: -300...300, step: 1, format: "%.0f")
            SliderField(labels.emissionAngleDegrees, value: $emissionAngleDegrees, range: -180...180, step: 1, format: "%.0f")
            SliderField(labels.emissionAngleRangeDegrees, value: $emissionAngleRangeDegrees, range: 0...180, step: 1, format: "%.0f")
            SliderField(labels.positionRangeX, value: $positionRangeX, range: 0...120, step: 1, format: "%.0f")
            SliderField(labels.positionRangeY, value: $positionRangeY, range: 0...120, step: 1, format: "%.0f")
            SliderField(labels.scale, value: $scale, range: 0.01...1.5, step: 0.01, format: "%.2f")
            SliderField(labels.scaleRange, value: $scaleRange, range: 0...1.5, step: 0.01, format: "%.2f")
            SliderField(labels.scaleSpeed, value: $scaleSpeed, range: -3...3, step: 0.01, format: "%.2f")
            SliderField(labels.alpha, value: $alpha, range: 0...1, step: 0.01, format: "%.2f")
            SliderField(labels.alphaRange, value: $alphaRange, range: 0...1, step: 0.01, format: "%.2f")
            SliderField(labels.alphaSpeed, value: $alphaSpeed, range: -3...3, step: 0.01, format: "%.2f")
            SliderField(labels.colorBlendFactor, value: $colorBlendFactor, range: 0...1, step: 0.01, format: "%.2f")
        }
        .padding(12)
        .hazmatPanel()
    }
}

@available(iOS 17.0, *)
private struct SliderField: View {
    let title: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double
    let format: String

    init(
        _ title: String,
        value: Binding<Double>,
        range: ClosedRange<Double>,
        step: Double,
        format: String
    ) {
        self.title = title
        self._value = value
        self.range = range
        self.step = step
        self.format = format
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                    .font(.caption)
                Spacer()
                Text(String(format: format, value))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            ZStack {
                Slider(value: $value, in: range, step: step)
                    .allowsHitTesting(false)

                GeometryReader { proxy in
                    Color.clear
                        .contentShape(Rectangle())
                        .gesture(
                            DragGesture(minimumDistance: 0)
                                .onChanged { gesture in
                                    updateValue(fromX: gesture.location.x, width: proxy.size.width)
                                }
                        )
                }
            }
            .frame(height: 28)
        }
    }

    private func updateValue(fromX x: CGFloat, width: CGFloat) {
        guard width > 0 else { return }
        let clampedX = min(max(0, x), width)
        let t = clampedX / width
        let raw = range.lowerBound + (range.upperBound - range.lowerBound) * Double(t)
        let stepped = ((raw - range.lowerBound) / step).rounded() * step + range.lowerBound
        value = min(max(range.lowerBound, stepped), range.upperBound)
    }
}

@available(iOS 17.0, *)
private struct FLAShareExportItem: Identifiable {
    let id = UUID()
    let url: URL
}

@available(iOS 17.0, *)
private struct FLAGIFExportSettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var simulation: FLAFlameSimulationStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("These settings affect GIF exports only and are saved for future exports.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)

                    SliderField(
                        "Duration (s)",
                        value: simulation.bindingForGIFExport(\.durationSeconds),
                        range: 0.5...8.0,
                        step: 0.1,
                        format: "%.1f"
                    )
                    SliderField(
                        "FPS",
                        value: simulation.bindingForGIFExport(\.fps),
                        range: 4...24,
                        step: 1,
                        format: "%.0f"
                    )
                    SliderField(
                        "Resolution Scale",
                        value: simulation.bindingForGIFExport(\.resolutionScale),
                        range: 0.5...2.0,
                        step: 0.1,
                        format: "%.1fx"
                    )

                    Toggle("Transparent Background (export)", isOn: simulation.bindingForGIFExport(\.transparentBackground))
                        .font(.subheadline)
                        .padding(.top, 2)

                    Label(
                        "Use this when you want only the fire/smoke in the GIF for overlaying on other media. Turn it off to include the scene/photo background.",
                        systemImage: "questionmark.circle"
                    )
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.top, 2)
                }
                .padding()
            }
            .navigationTitle("GIF Settings")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Reset") {
                        simulation.resetGIFExportSettings()
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.large])
    }
}

@available(iOS 17.0, *)
private struct FLAActivityView: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
import SpriteKit
import SwiftUI
import UIKit

@available(iOS 17.0, *)
struct FLAFlameStageView: View {
    @EnvironmentObject private var simulation: FLAFlameSimulationStore

    var body: some View {
        GeometryReader { proxy in
            SpriteKitStageRepresentable(simulation: simulation, size: proxy.size)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onEnded { value in
                            let size = proxy.size
                            guard size.width > 0, size.height > 0 else { return }
                            let x = min(max(0, value.location.x / size.width), 1)
                            let y = min(max(0, value.location.y / size.height), 1)
                            simulation.setActiveEmitterPosition(x: x, y: y)
                        }
                )
        }
    }
}

@available(iOS 17.0, *)
private struct SpriteKitStageRepresentable: UIViewRepresentable {
    @MainActor final class Coordinator {
        let scene = FLAFlameSpriteScene()
        weak var view: SKView?
    }

    let simulation: FLAFlameSimulationStore
    let size: CGSize

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> SKView {
        let view = SKView(frame: .zero)
        view.ignoresSiblingOrder = true
        view.allowsTransparency = false
        view.backgroundColor = .black

        let scene = context.coordinator.scene
        scene.bind(store: simulation)
        if size.width > 0, size.height > 0 {
            scene.size = size
        }
        view.presentScene(scene)

        context.coordinator.view = view
        simulation.registerStageRenderer(view: view, scene: scene)
        return view
    }

    func updateUIView(_ uiView: SKView, context: Context) {
        let scene = context.coordinator.scene
        scene.bind(store: simulation)
        if size.width > 0, size.height > 0, scene.size != size {
            scene.size = size
        }
        if uiView.scene !== scene {
            uiView.presentScene(scene)
        }
        simulation.registerStageRenderer(view: uiView, scene: scene)
    }
}
import CoreGraphics
import ImageIO
import Photos
import PhotosUI
import SpriteKit
import SwiftUI
import UniformTypeIdentifiers
import UIKit

typealias FLAEmitterID = UUID

@available(iOS 17.0, *)
struct FLAFlameControls: Codable, Equatable {
    var amount: Double = 50
    var opacity: Double = 0.85
    var size: Double = 0.20
    var rise: Double = 28
    var angle: Double = 0
    var length: Double = 1.0
    var width: Double = 1.0
    var colorTemp: Double = 50
    var smokeColor: Double = 0

    static let defaults = FLAFlameControls()
}

@available(iOS 17.0, *)
struct FLAEmitterState: Identifiable {
    let id: FLAEmitterID
    var position: CGPoint
    var controls: FLAFlameControls
    var spriteTunings: FLASpriteEmitterTunings
}

@available(iOS 17.0, *)
struct FLAEmitterListItem: Identifiable, Hashable {
    let id: FLAEmitterID
    let displayName: String
}

@available(iOS 17.0, *)
struct FLAFlameParticle {
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

@available(iOS 17.0, *)
struct FLAFlameEmitterSnapshot {
    let id: FLAEmitterID
    let normalizedPosition: CGPoint
    let controls: FLAFlameControls
    let spriteTunings: FLASpriteEmitterTunings
    let isActive: Bool
    let isEnabled: Bool
}

@available(iOS 17.0, *)
struct FLAFlameRenderSnapshot {
    let backgroundImage: UIImage?
    let emitters: [FLAFlameEmitterSnapshot]
}

@available(iOS 17.0, *)
struct FLASpriteEmitterTuning: Codable, Equatable {
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

@available(iOS 17.0, *)
struct FLASpriteEmitterTunings: Codable, Equatable {
    var flame: FLASpriteEmitterTuning
    var smoke: FLASpriteEmitterTuning

    static let defaults = FLASpriteEmitterTunings(
        flame: FLASpriteEmitterTuning(
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
        smoke: FLASpriteEmitterTuning(
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

@available(iOS 17.0, *)
struct FLAGIFExportSettings: Codable, Equatable {
    var durationSeconds: Double = 2.5
    var fps: Double = 12
    var resolutionScale: Double = 1.0
    var transparentBackground: Bool = false

    static let defaults = FLAGIFExportSettings()
}

@MainActor
@available(iOS 17.0, *)
final class FLAFlameSimulationStore: ObservableObject {
    @Published var activeEmitterID: FLAEmitterID
    @Published private(set) var defaultControls = FLAFlameControls.defaults
    @Published private(set) var backgroundImage: UIImage?
    @Published private(set) var spriteTunings = FLASpriteEmitterTunings.defaults
    @Published private(set) var isExportingGIF = false
    @Published private(set) var gifExportSettings = FLAGIFExportSettings.defaults

    @Published private(set) var emitters: [FLAEmitterState]
    private var particles: [FLAFlameParticle] = []
    private var lastTickDate: Date?
    private var canvasSize: CGSize = .zero
    private var noiseSeed = Double.random(in: 0...10_000)
    private weak var stageView: SKView?
    private weak var stageScene: FLAFlameSpriteScene?

    private let defaultsKey = "Flaminator9000.defaultControls"
    private let spriteTuningsKey = "Flaminator9000.spriteEmitterTunings"
    private let gifExportSettingsKey = "Flaminator9000.gifExportSettings"

    init() {
        let firstID = UUID()
        _activeEmitterID = Published(initialValue: firstID)
        _emitters = Published(initialValue: [
            FLAEmitterState(
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

    var emitterChoices: [FLAEmitterListItem] {
        emitters.enumerated().map { index, emitter in
            FLAEmitterListItem(id: emitter.id, displayName: "Emitter \(index + 1)")
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
            FLAEmitterState(
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

    func bindingForActive(_ keyPath: WritableKeyPath<FLAFlameControls, Double>) -> Binding<Double> {
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

    func bindingForFlameTuning(_ keyPath: WritableKeyPath<FLASpriteEmitterTuning, Double>) -> Binding<Double> {
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

    func bindingForSmokeTuning(_ keyPath: WritableKeyPath<FLASpriteEmitterTuning, Double>) -> Binding<Double> {
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

    func bindingForGIFExport(_ keyPath: WritableKeyPath<FLAGIFExportSettings, Double>) -> Binding<Double> {
        Binding(
            get: { [weak self] in
                self?.gifExportSettings[keyPath: keyPath] ?? 0
            },
            set: { [weak self] newValue in
                self?.setGIFExportSetting(keyPath, value: newValue)
            }
        )
    }

    func bindingForGIFExport(_ keyPath: WritableKeyPath<FLAGIFExportSettings, Bool>) -> Binding<Bool> {
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

    private var controlsForActive: FLAFlameControls {
        guard let index = activeEmitterIndex else { return defaultControls }
        return emitters[index].controls
    }

    private func setActiveControl(_ keyPath: WritableKeyPath<FLAFlameControls, Double>, value: Double) {
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

    private func setFlameTuning(_ keyPath: WritableKeyPath<FLASpriteEmitterTuning, Double>, value: Double) {
        guard let index = activeEmitterIndex else { return }
        emitters[index].spriteTunings.flame[keyPath: keyPath] = value
        objectWillChange.send()
    }

    private func setSmokeTuning(_ keyPath: WritableKeyPath<FLASpriteEmitterTuning, Double>, value: Double) {
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

    private func setGIFExportSetting(_ keyPath: WritableKeyPath<FLAGIFExportSettings, Double>, value: Double) {
        gifExportSettings[keyPath: keyPath] = value
        persistGIFExportSettings()
        objectWillChange.send()
    }

    private func setGIFExportSetting(_ keyPath: WritableKeyPath<FLAGIFExportSettings, Bool>, value: Bool) {
        gifExportSettings[keyPath: keyPath] = value
        persistGIFExportSettings()
        objectWillChange.send()
    }

    func applyDefaults(_ controls: FLAFlameControls) {
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
            let controls = try? JSONDecoder().decode(FLAFlameControls.self, from: data)
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
            let tunings = try? JSONDecoder().decode(FLASpriteEmitterTunings.self, from: data)
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
            let settings = try? JSONDecoder().decode(FLAGIFExportSettings.self, from: data)
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

    func registerStageRenderer(view: SKView, scene: FLAFlameSpriteScene) {
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

    func renderSnapshot() -> FLAFlameRenderSnapshot {
        FLAFlameRenderSnapshot(
            backgroundImage: backgroundImage,
            emitters: emitters.map { emitter in
                FLAFlameEmitterSnapshot(
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

    private func spawn(from emitter: FLAEmitterState, dt: Double) {
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
                FLAFlameParticle(
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

    private func drawFlameParticle(_ particle: FLAFlameParticle, into context: GraphicsContext) {
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

    private func drawSmoke(_ particle: FLAFlameParticle, into context: GraphicsContext) {
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
import SpriteKit
import UIKit

@MainActor
@available(iOS 17.0, *)
final class FLAFlameSpriteScene: SKScene {
    struct ExportCaptureState {
        let backgroundNodeHidden: Bool
        let sceneBackgroundColor: UIColor
    }

    private weak var store: FLAFlameSimulationStore?

    private let backgroundNode = SKSpriteNode(color: .black, size: .zero)
    private let overlayNode = SKNode()
    private var emitterGroups: [FLAEmitterID: EmitterNodeGroup] = [:]

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

    func bind(store: FLAFlameSimulationStore) {
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

    private func apply(snapshot: FLAFlameRenderSnapshot) {
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

    private func emitterGroup(for id: FLAEmitterID) -> EmitterNodeGroup {
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

    private func applyDirectionalTweaks(toFlame flame: SKEmitterNode, smoke: SKEmitterNode, controls: FLAFlameControls) {
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
@available(iOS 17.0, *)
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

    func apply(flameTuning: FLASpriteEmitterTuning, smokeTuning: FLASpriteEmitterTuning) {
        apply(tuning: flameTuning, to: flame)
        apply(tuning: smokeTuning, to: smoke)
        defaultFlameBirthRate = flame.particleBirthRate
        defaultSmokeBirthRate = smoke.particleBirthRate
    }

    private func apply(tuning: FLASpriteEmitterTuning, to emitter: SKEmitterNode) {
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

@available(iOS 17.0, *)
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

