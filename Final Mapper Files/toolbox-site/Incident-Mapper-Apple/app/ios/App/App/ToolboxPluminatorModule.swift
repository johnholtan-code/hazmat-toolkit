// Generated integration source for HazmatToolkitiOS
import Foundation
import PhotosUI
import SwiftUI
import UIKit
import HazMatDesignSystem

@available(iOS 17.0, *)
struct ToolboxPluminatorModuleView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var simulation: PLUPlumeSimulationStore
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var exportAlertMessage: String?
    @State private var shareExportItem: PLUShareExportItem?
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
            .navigationTitle("Pluminator 9000")
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
                    .disabled(simulation.isExportingGIF || !simulation.isStageReadyForExport)

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
            PLUActivityView(items: [item.url])
        }
        .sheet(isPresented: $showingGIFSettings) {
            PLUGIFExportSettingsSheet()
                .environmentObject(simulation)
        }
        .task(id: selectedPhotoItem) {
            guard let selectedPhotoItem else { return }
            await simulation.loadPhoto(from: selectedPhotoItem)
        }
        .task {
            simulation.refreshStageReadyFlag()
        }
    }

    private func exportGIF() async {
        do {
            let url = try await simulation.exportCurrentStageGIFToPhotos()
            shareExportItem = PLUShareExportItem(url: url)
        } catch {
            exportAlertMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    private var stageView: some View {
        PLUPlumeStageView()
            .frame(maxWidth: .infinity)
            .aspectRatio(4.0 / 3.0, contentMode: .fit)
            .background(ThemeColors.panel)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(alignment: .topLeading) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Tap stage to move \(simulation.activeEmitterDisplayName)")
                        .font(.caption.weight(.medium))
                    if !simulation.isStageReadyForExport {
                        Text("Preparing GIF exporter…")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(.ultraThinMaterial, in: Capsule())
                .padding(10)
            }
    }
}

@available(iOS 17.0, *)
private struct ControlsPanel: View {
    @EnvironmentObject private var simulation: PLUPlumeSimulationStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                emitterSection
                plumeControlsSection
                spriteEmitterEditorSection
                actionsSection
            }
            .padding(14)
            .hazmatPanel()
        }
    }

    private var spriteEmitterEditorSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Advanced Emitter Tuning")
                    .font(.headline)
                Spacer()
                Button("Reset") {
                    simulation.resetSpriteEmitterTuning()
                }
                .buttonStyle(.bordered)
            }

            Text("These controls tune the SpriteKit plume particle engine for the active emitter.")
                .font(.footnote)
                .foregroundStyle(.secondary)

            PLUPlumeSpriteEmitterTuningSection(
                title: "Plume Particle Engine",
                birthRate: simulation.bindingForPlumeTuning(\.birthRate),
                lifetime: simulation.bindingForPlumeTuning(\.lifetime),
                lifetimeRange: simulation.bindingForPlumeTuning(\.lifetimeRange),
                speed: simulation.bindingForPlumeTuning(\.speed),
                speedRange: simulation.bindingForPlumeTuning(\.speedRange),
                xAcceleration: simulation.bindingForPlumeTuning(\.xAcceleration),
                yAcceleration: simulation.bindingForPlumeTuning(\.yAcceleration),
                emissionAngleDegrees: simulation.bindingForPlumeTuning(\.emissionAngleDegrees),
                emissionAngleRangeDegrees: simulation.bindingForPlumeTuning(\.emissionAngleRangeDegrees),
                positionRangeX: simulation.bindingForPlumeTuning(\.positionRangeX),
                positionRangeY: simulation.bindingForPlumeTuning(\.positionRangeY),
                scale: simulation.bindingForPlumeTuning(\.scale),
                scaleRange: simulation.bindingForPlumeTuning(\.scaleRange),
                scaleSpeed: simulation.bindingForPlumeTuning(\.scaleSpeed),
                alpha: simulation.bindingForPlumeTuning(\.alpha),
                alphaRange: simulation.bindingForPlumeTuning(\.alphaRange),
                alphaSpeed: simulation.bindingForPlumeTuning(\.alphaSpeed),
                colorBlendFactor: simulation.bindingForPlumeTuning(\.colorBlendFactor)
            )
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
                .disabled(!simulation.canAddEmitter)

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

            Text("\(simulation.emitterChoices.count) / 10 emitters")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var plumeControlsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Plume Controls")
                    .font(.headline)
                Spacer()
                Text(simulation.activeEmitterDisplayName)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Color")
                    .font(.caption)
                HStack(spacing: 10) {
                    ColorPicker("Plume Color", selection: simulation.bindingForActiveColor(), supportsOpacity: false)
                        .labelsHidden()
                        .frame(width: 44, height: 32)
                    Text(simulation.activeEmitterColorHex)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                    Spacer()
                }
            }

            SliderField("Intensity", value: simulation.bindingForActive(\.amount), range: 0...100, step: 1, format: "%.0f")
            SliderField("Opacity", value: simulation.bindingForActive(\.opacity), range: 0...1, step: 0.01, format: "%.2f")
            SliderField("Size", value: simulation.bindingForActive(\.size), range: 0.05...3.0, step: 0.01, format: "%.2f")
            SliderField("Angle", value: simulation.bindingForActive(\.angle), range: 0...360, step: 1, format: "%.0f°")
            SliderField("Tilt", value: simulation.bindingForActive(\.tilt), range: 45...135, step: 1, format: "%.0f°")
            SliderField("Length", value: simulation.bindingForActive(\.length), range: 0.2...3.0, step: 0.1, format: "%.1fx")
            SliderField("Width", value: simulation.bindingForActive(\.width), range: 0.3...3.0, step: 0.1, format: "%.1fx")
            SliderField("Rise Speed", value: simulation.bindingForActive(\.rise), range: 5...80, step: 1, format: "%.0f")
        }
        .padding(12)
        .hazmatPanel()
    }

    private var actionsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Controls")
                .font(.headline)

            HStack {
                Button("Reset Plume Controls") {
                    simulation.resetControls()
                }
                .buttonStyle(.bordered)

                Button("Full Reset") {
                    simulation.resetAll()
                }
                .buttonStyle(.bordered)
            }

            Text("Layout and interaction match the Flaminator shell, while the controls map to Pluminator 9000 behavior.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
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
private struct PLUPlumeSpriteEmitterTuningSection: View {
    let title: String
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
                .foregroundStyle(.orange)

            SliderField("Plume Output (particles)", value: $birthRate, range: 0...800, step: 1, format: "%.0f")
            SliderField("Hang Time (seconds)", value: $lifetime, range: 0.05...6.0, step: 0.01, format: "%.2f")
            SliderField("Hang Variability", value: $lifetimeRange, range: 0...3.0, step: 0.01, format: "%.2f")
            SliderField("Travel Speed", value: $speed, range: 0...300, step: 1, format: "%.0f")
            SliderField("Turbulence Spread", value: $speedRange, range: 0...300, step: 1, format: "%.0f")
            SliderField("Crosswind Push", value: $xAcceleration, range: -300...300, step: 1, format: "%.0f")
            SliderField("Vertical Lift / Drop", value: $yAcceleration, range: -300...300, step: 1, format: "%.0f")
            SliderField("Aim Offset", value: $emissionAngleDegrees, range: -180...180, step: 1, format: "%.0f°")
            SliderField("Spray Cone Width", value: $emissionAngleRangeDegrees, range: 0...180, step: 1, format: "%.0f°")
            SliderField("Source Width", value: $positionRangeX, range: 0...120, step: 1, format: "%.0f")
            SliderField("Source Depth", value: $positionRangeY, range: 0...120, step: 1, format: "%.0f")
            SliderField("Particle Start Size", value: $scale, range: 0.01...1.5, step: 0.01, format: "%.2f")
            SliderField("Size Variation", value: $scaleRange, range: 0...1.5, step: 0.01, format: "%.2f")
            SliderField("Expansion Rate", value: $scaleSpeed, range: -3...3, step: 0.01, format: "%.2f")
            SliderField("Plume Density", value: $alpha, range: 0...1, step: 0.01, format: "%.2f")
            SliderField("Density Variation", value: $alphaRange, range: 0...1, step: 0.01, format: "%.2f")
            SliderField("Fade Rate", value: $alphaSpeed, range: -3...3, step: 0.01, format: "%.2f")
            SliderField("Color/Tint Strength", value: $colorBlendFactor, range: 0...1, step: 0.01, format: "%.2f")
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(uiColor: .tertiarySystemGroupedBackground))
        )
    }
}

@available(iOS 17.0, *)
private struct PLUShareExportItem: Identifiable {
    let id = UUID()
    let url: URL
}

@available(iOS 17.0, *)
private struct PLUActivityView: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

@available(iOS 17.0, *)
private struct PLUGIFExportSettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var simulation: PLUPlumeSimulationStore

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
                        "Use this when you want only the plume in the GIF for overlaying on other media. Turn it off to include the scene/photo background.",
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
import SpriteKit
import SwiftUI
import UIKit

@available(iOS 17.0, *)
struct PLUPlumeStageView: View {
    @EnvironmentObject private var simulation: PLUPlumeSimulationStore

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
        let scene = PLUPlumeSpriteScene()
    }

    let simulation: PLUPlumeSimulationStore
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

typealias PLUEmitterID = UUID

@available(iOS 17.0, *)
struct PLUPlumeControls: Codable, Equatable {
    var colorHex: String = "#ffffff"
    var amount: Double = 50
    var opacity: Double = 0.65
    var size: Double = 1.2
    var rise: Double = 28
    var angle: Double = 0
    var tilt: Double = 90
    var length: Double = 1.0
    var width: Double = 1.0

    static let defaults = PLUPlumeControls()
}

@available(iOS 17.0, *)
struct PLUPlumeSpriteEmitterTuning: Codable, Equatable {
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

    static let defaults = PLUPlumeSpriteEmitterTuning(
        birthRate: 140,
        lifetime: 3.0,
        lifetimeRange: 1.0,
        speed: 140,
        speedRange: 50,
        xAcceleration: 0,
        yAcceleration: 0,
        emissionAngleDegrees: 0,
        emissionAngleRangeDegrees: 50,
        positionRangeX: 8,
        positionRangeY: 4,
        scale: 0.12,
        scaleRange: 0.04,
        scaleSpeed: 0,
        alpha: 0.55,
        alphaRange: 0.10,
        alphaSpeed: 0,
        colorBlendFactor: 1.0
    )
}

@available(iOS 17.0, *)
struct PLUPlumeEmitterState: Identifiable {
    let id: PLUEmitterID
    var label: String
    var isEnabled: Bool
    var position: CGPoint
    var controls: PLUPlumeControls
    var spriteTuning: PLUPlumeSpriteEmitterTuning
}

@available(iOS 17.0, *)
struct PLUEmitterListItem: Identifiable, Hashable {
    let id: PLUEmitterID
    let displayName: String
    let isEnabled: Bool
}

@available(iOS 17.0, *)
struct PLUPlumeEmitterSnapshot {
    let id: PLUEmitterID
    let label: String
    let normalizedPosition: CGPoint
    let controls: PLUPlumeControls
    let spriteTuning: PLUPlumeSpriteEmitterTuning
    let isActive: Bool
    let isEnabled: Bool
}

@available(iOS 17.0, *)
struct PLUPlumeRenderSnapshot {
    let backgroundImage: UIImage?
    let emitters: [PLUPlumeEmitterSnapshot]
}

@available(iOS 17.0, *)
struct PLUGIFExportSettings: Codable, Equatable {
    var durationSeconds: Double = 3.0
    var fps: Double = 20
    var resolutionScale: Double = 1.0
    var transparentBackground: Bool = false

    static let defaults = PLUGIFExportSettings()
}

@MainActor
@available(iOS 17.0, *)
final class PLUPlumeSimulationStore: ObservableObject {
    @Published var activeEmitterID: PLUEmitterID
    @Published private(set) var backgroundImage: UIImage?
    @Published private(set) var emitters: [PLUPlumeEmitterState]
    @Published private(set) var isExportingGIF = false
    @Published private(set) var gifExportSettings = PLUGIFExportSettings.defaults
    @Published private(set) var isStageReadyForExport = false

    private var stageView: SKView?
    private var stageScene: PLUPlumeSpriteScene?

    private let gifExportSettingsKey = "Pluminator9000.gifExportSettings"
    private let maxEmitters = 10

    init() {
        let firstID = UUID()
        activeEmitterID = firstID
        emitters = [
            PLUPlumeEmitterState(
                id: firstID,
                label: "Emitter 1",
                isEnabled: true,
                position: PLUPlumeSimulationStore.nextEmitterDefaultPosition(forIndex: 0),
                controls: .defaults,
                spriteTuning: .defaults
            )
        ]
        loadGIFExportSettings()
    }

    var hasPhoto: Bool {
        backgroundImage != nil
    }

    var emitterChoices: [PLUEmitterListItem] {
        emitters.map { PLUEmitterListItem(id: $0.id, displayName: $0.label, isEnabled: $0.isEnabled) }
    }

    var activeEmitterDisplayName: String {
        activeEmitter?.label ?? "Emitter"
    }

    var activeEmitterColor: Color {
        let uiColor = UIColor(hexRGB: activeEmitter?.controls.colorHex ?? "#ffffff") ?? .white
        return Color(uiColor: uiColor)
    }

    var activeEmitterColorHex: String {
        activeEmitter?.controls.colorHex.uppercased() ?? "#FFFFFF"
    }

    var canAddEmitter: Bool {
        emitters.count < maxEmitters
    }

    var canRemoveEmitter: Bool {
        emitters.count > 1
    }

    var activeEmitterIndex: Int? {
        emitters.firstIndex(where: { $0.id == activeEmitterID })
    }

    var activeEmitter: PLUPlumeEmitterState? {
        guard let index = activeEmitterIndex else { return nil }
        return emitters[index]
    }

    func setActiveEmitter(_ id: PLUEmitterID) {
        guard emitters.contains(where: { $0.id == id }) else { return }
        activeEmitterID = id
    }

    func addEmitter() {
        guard canAddEmitter else { return }
        let id = UUID()
        let index = emitters.count
        let source = activeEmitter ?? emitters[0]
        emitters.append(
            PLUPlumeEmitterState(
                id: id,
                label: "Emitter \(index + 1)",
                isEnabled: true,
                position: PLUPlumeSimulationStore.nextEmitterDefaultPosition(forIndex: index),
                controls: source.controls,
                spriteTuning: source.spriteTuning
            )
        )
        activeEmitterID = id
        objectWillChange.send()
    }

    func removeActiveEmitter() {
        guard canRemoveEmitter, let index = activeEmitterIndex else { return }
        emitters.remove(at: index)
        relabelEmitters()
        let replacementIndex = min(index, emitters.count - 1)
        activeEmitterID = emitters[replacementIndex].id
        objectWillChange.send()
    }

    func resetEmitterPositions() {
        for index in emitters.indices {
            emitters[index].position = PLUPlumeSimulationStore.nextEmitterDefaultPosition(forIndex: index)
        }
        objectWillChange.send()
    }

    func resetControls() {
        for index in emitters.indices {
            emitters[index].controls = .defaults
        }
        objectWillChange.send()
    }

    func resetAll() {
        clearPhoto()
        resetControls()
        for index in emitters.indices {
            emitters[index].spriteTuning = .defaults
        }
        while emitters.count > 1 {
            emitters.removeLast()
        }
        relabelEmitters()
        resetEmitterPositions()
        activeEmitterID = emitters[0].id
        objectWillChange.send()
    }

    func setActiveEmitterPosition(x: CGFloat, y: CGFloat) {
        guard let index = activeEmitterIndex else { return }
        emitters[index].position = CGPoint(x: x, y: y)
        objectWillChange.send()
    }

    func bindingForActive(_ keyPath: WritableKeyPath<PLUPlumeControls, Double>) -> Binding<Double> {
        Binding(
            get: { [weak self] in
                guard let self, let index = self.activeEmitterIndex else { return 0 }
                return self.emitters[index].controls[keyPath: keyPath]
            },
            set: { [weak self] newValue in
                guard let self, let index = self.activeEmitterIndex else { return }
                self.emitters[index].controls[keyPath: keyPath] = newValue
                self.objectWillChange.send()
            }
        )
    }

    func bindingForPlumeTuning(_ keyPath: WritableKeyPath<PLUPlumeSpriteEmitterTuning, Double>) -> Binding<Double> {
        Binding(
            get: { [weak self] in
                guard let self, let index = self.activeEmitterIndex else { return 0 }
                return self.emitters[index].spriteTuning[keyPath: keyPath]
            },
            set: { [weak self] newValue in
                guard let self, let index = self.activeEmitterIndex else { return }
                self.emitters[index].spriteTuning[keyPath: keyPath] = newValue
                self.objectWillChange.send()
            }
        )
    }

    func bindingForActiveColor() -> Binding<Color> {
        Binding(
            get: { [weak self] in
                self?.activeEmitterColor ?? .white
            },
            set: { [weak self] newColor in
                guard let self, let index = self.activeEmitterIndex else { return }
                let uiColor = UIColor(newColor)
                self.emitters[index].controls.colorHex = uiColor.hexRGBString
                self.objectWillChange.send()
            }
        )
    }

    func bindingForGIFExport(_ keyPath: WritableKeyPath<PLUGIFExportSettings, Double>) -> Binding<Double> {
        Binding(
            get: { [weak self] in
                self?.gifExportSettings[keyPath: keyPath] ?? 0
            },
            set: { [weak self] newValue in
                self?.setGIFExportSetting(keyPath, value: newValue)
            }
        )
    }

    func bindingForGIFExport(_ keyPath: WritableKeyPath<PLUGIFExportSettings, Bool>) -> Binding<Bool> {
        Binding(
            get: { [weak self] in
                self?.gifExportSettings[keyPath: keyPath] ?? false
            },
            set: { [weak self] newValue in
                self?.setGIFExportSetting(keyPath, value: newValue)
            }
        )
    }

    func resetGIFExportSettings() {
        gifExportSettings = .defaults
        persistGIFExportSettings()
        objectWillChange.send()
    }

    func resetSpriteEmitterTuning() {
        guard let index = activeEmitterIndex else { return }
        emitters[index].spriteTuning = .defaults
        objectWillChange.send()
    }

    func clearPhoto() {
        backgroundImage = nil
    }

    func registerStageRenderer(view: SKView, scene: PLUPlumeSpriteScene) {
        stageView = view
        stageScene = scene
        refreshStageReadyFlag()
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
                return "The plume stage is not ready yet."
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
        let (stageView, stageScene) = try await resolveReadyStageRenderer()

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

    private func resolveReadyStageRenderer() async throws -> (SKView, PLUPlumeSpriteScene) {
        for _ in 0..<60 {
            if let stageView {
                stageView.setNeedsLayout()
                stageView.layoutIfNeeded()
                stageView.superview?.layoutIfNeeded()
                stageView.window?.layoutIfNeeded()
            }

            if let view = stageView {
                let resolvedScene = stageScene ?? (view.scene as? PLUPlumeSpriteScene)
                if let resolvedScene,
                   view.bounds.width > 1,
                   view.bounds.height > 1 {
                    if stageScene == nil {
                        stageScene = resolvedScene
                    }
                    isStageReadyForExport = true
                    return (view, resolvedScene)
                }
            }

            refreshStageReadyFlag()
            await Task.yield()
            try? await Task.sleep(nanoseconds: 50_000_000)
        }

        refreshStageReadyFlag()
        throw GIFExportError.stageUnavailable
    }

    func refreshStageReadyFlag() {
        let resolvedScene = stageScene ?? (stageView?.scene as? PLUPlumeSpriteScene)
        isStageReadyForExport = {
            guard let stageView, resolvedScene != nil else { return false }
            return stageView.bounds.width > 1 && stageView.bounds.height > 1
        }()
    }

    private static func nextEmitterDefaultPosition(forIndex index: Int) -> CGPoint {
        let columns = 4
        let row = max(0, index / columns)
        let col = max(0, index % columns)
        let startX: CGFloat = 0.38
        let spacingX: CGFloat = 0.10
        let baseY: CGFloat = 0.84
        let spacingY: CGFloat = 0.06
        let x = min(0.95, startX + CGFloat(col) * spacingX)
        let y = max(0.55, baseY - CGFloat(row) * spacingY)
        return CGPoint(x: x, y: y)
    }

    private func relabelEmitters() {
        for index in emitters.indices {
            emitters[index].label = "Emitter \(index + 1)"
            emitters[index].isEnabled = true
        }
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
                guard let context = UIGraphicsGetCurrentContext() else { return }
                view.layer.render(in: context)
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
            .appendingPathComponent("Pluminator-\(UUID().uuidString)")
            .appendingPathExtension("gif")

        guard let destination = CGImageDestinationCreateWithURL(
            url as CFURL,
            UTType.gif.identifier as CFString,
            frames.count,
            nil
        ) else {
            throw GIFExportError.encoderCreationFailed
        }

        CGImageDestinationSetProperties(destination, [
            kCGImagePropertyGIFDictionary: [
                kCGImagePropertyGIFLoopCount: 0
            ]
        ] as CFDictionary)

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

    func renderSnapshot() -> PLUPlumeRenderSnapshot {
        PLUPlumeRenderSnapshot(
            backgroundImage: backgroundImage,
            emitters: emitters.map {
                PLUPlumeEmitterSnapshot(
                    id: $0.id,
                    label: $0.label,
                    normalizedPosition: $0.position,
                    controls: $0.controls,
                    spriteTuning: $0.spriteTuning,
                    isActive: $0.id == activeEmitterID,
                    isEnabled: $0.isEnabled
                )
            }
        )
    }

    private func loadGIFExportSettings() {
        guard
            let data = UserDefaults.standard.data(forKey: gifExportSettingsKey),
            let settings = try? JSONDecoder().decode(PLUGIFExportSettings.self, from: data)
        else {
            gifExportSettings = .defaults
            return
        }
        gifExportSettings = settings
    }

    private func setGIFExportSetting(_ keyPath: WritableKeyPath<PLUGIFExportSettings, Double>, value: Double) {
        gifExportSettings[keyPath: keyPath] = value
        persistGIFExportSettings()
        objectWillChange.send()
    }

    private func setGIFExportSetting(_ keyPath: WritableKeyPath<PLUGIFExportSettings, Bool>, value: Bool) {
        gifExportSettings[keyPath: keyPath] = value
        persistGIFExportSettings()
        objectWillChange.send()
    }

    private func persistGIFExportSettings() {
        guard let data = try? JSONEncoder().encode(gifExportSettings) else { return }
        UserDefaults.standard.set(data, forKey: gifExportSettingsKey)
    }
}

private extension UIColor {
    convenience init?(hexRGB: String) {
        var hex = hexRGB.trimmingCharacters(in: .whitespacesAndNewlines)
        if hex.hasPrefix("#") { hex.removeFirst() }
        guard hex.count == 6, let value = Int(hex, radix: 16) else { return nil }
        let r = CGFloat((value >> 16) & 0xFF) / 255.0
        let g = CGFloat((value >> 8) & 0xFF) / 255.0
        let b = CGFloat(value & 0xFF) / 255.0
        self.init(red: r, green: g, blue: b, alpha: 1)
    }

    var hexRGBString: String {
        let rgbColor: UIColor = {
            if let cg = cgColor.converted(to: CGColorSpace(name: CGColorSpace.sRGB)!, intent: .defaultIntent, options: nil) {
                return UIColor(cgColor: cg)
            }
            return self
        }()

        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        if !rgbColor.getRed(&r, green: &g, blue: &b, alpha: &a) {
            return "#FFFFFF"
        }
        return String(
            format: "#%02X%02X%02X",
            Int((r * 255).rounded()),
            Int((g * 255).rounded()),
            Int((b * 255).rounded())
        )
    }
}
import SpriteKit
import UIKit

@MainActor
@available(iOS 17.0, *)
final class PLUPlumeSpriteScene: SKScene {
    struct ExportCaptureState {
        let backgroundNodeHidden: Bool
        let sceneBackgroundColor: UIColor
    }

    private weak var store: PLUPlumeSimulationStore?

    private let backgroundNode = SKSpriteNode(color: .black, size: .zero)
    private var emitterGroups: [PLUEmitterID: PlumeEmitterNodeGroup] = [:]
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
    }

    func bind(store: PLUPlumeSimulationStore) {
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

    private func apply(snapshot: PLUPlumeRenderSnapshot) {
        let snapshotIDs = Set(snapshot.emitters.map(\.id))
        let existingIDs = Set(emitterGroups.keys)

        for id in existingIDs.subtracting(snapshotIDs) {
            guard let group = emitterGroups.removeValue(forKey: id) else { continue }
            group.root.removeFromParent()
            group.marker.removeFromParent()
        }

        for (index, emitter) in snapshot.emitters.enumerated() {
            let group = emitterGroup(for: emitter.id)
            let scenePoint = convertToScenePoint(emitter.normalizedPosition)

            group.root.position = scenePoint
            group.marker.position = scenePoint
            group.marker.isHidden = true

            if emitter.isEnabled {
                group.apply(
                    controls: emitter.controls,
                    tuning: emitter.spriteTuning,
                    label: emitter.label,
                    ordinal: index
                )
            } else {
                group.plume.particleBirthRate = 0
            }
        }
    }

    private func emitterGroup(for id: PLUEmitterID) -> PlumeEmitterNodeGroup {
        if let group = emitterGroups[id] {
            return group
        }
        let group = PlumeEmitterNodeGroup()
        addChild(group.root)
        addChild(group.marker)
        emitterGroups[id] = group
        return group
    }

    private func convertToScenePoint(_ normalized: CGPoint) -> CGPoint {
        let x = (normalized.x - 0.5) * size.width
        let y = ((1.0 - normalized.y) - 0.5) * size.height
        return CGPoint(x: x, y: y)
    }
}

@MainActor
@available(iOS 17.0, *)
private final class PlumeEmitterNodeGroup {
    let root = SKNode()
    let plume = SKEmitterNode()
    let marker = SKShapeNode(circleOfRadius: 8)

    init() {
        root.zPosition = 10
        configurePlumeEmitter(plume)
        root.addChild(plume)

        marker.zPosition = 200
        marker.lineWidth = 2
        marker.glowWidth = 0
        marker.fillColor = .clear
    }

    func applyMarkerStyle(label: String, isActive: Bool) {
        let baseColor: UIColor = label == "Emitter B" ? .systemBlue : .systemRed
        marker.strokeColor = isActive ? .white : baseColor.withAlphaComponent(0.85)
        marker.fillColor = baseColor.withAlphaComponent(isActive ? 0.85 : 0.55)
        marker.glowWidth = isActive ? 4 : 0
        marker.alpha = 1
    }

    func apply(controls: PLUPlumeControls, tuning: PLUPlumeSpriteEmitterTuning, label: String, ordinal: Int) {
        let angleRadians = CGFloat(controls.angle) * (.pi / 180)
        let direction = (.pi / 2) - angleRadians
        let tiltOffset = CGFloat(controls.tilt - 90) * (.pi / 180)
        let tiltFactor = max(0.18, abs(cos(tiltOffset)))
        let depthScale = max(0.6, 1 - 0.35 * sin(tiltOffset))

        let width = max(0.3, controls.width)
        let length = max(0.2, controls.length)
        let rise = max(5, controls.rise)
        let size = max(0.05, controls.size)
        let opacity = max(0, min(1, controls.opacity))

        let lifetime = CGFloat(1.7 + (length * 1.3))
        let speed = CGFloat(rise * 5.0 * length) * tiltFactor
        let spreadT = CGFloat((width - 0.3) / (3.0 - 0.3))
        let spreadAngle = CGFloat.pi * (0.08 + max(0, min(1, spreadT)) * 0.75)
        let plumeColor = UIColor(plumeHexRGB: controls.colorHex) ?? .white

        let birthRateScale = CGFloat(controls.amount / 50.0)
        let lifetimeScale = CGFloat(length)
        let speedScale = CGFloat((rise / 28.0) * length) * tiltFactor
        let widthScale = CGFloat(width)
        let opacityScale = CGFloat(opacity)
        let sizeScale = CGFloat(size) * depthScale

        plume.emissionAngle = direction + CGFloat(tuning.emissionAngleDegrees) * (.pi / 180)
        plume.emissionAngleRange = max(0, CGFloat(tuning.emissionAngleRangeDegrees) * (.pi / 180)) * max(0.35, widthScale)
        plume.particleBirthRate = max(0, CGFloat(tuning.birthRate) * max(0, birthRateScale))
        plume.particleLifetime = max(0.05, CGFloat(tuning.lifetime) * max(0.2, lifetimeScale))
        plume.particleLifetimeRange = max(0, CGFloat(tuning.lifetimeRange) * max(0.2, lifetimeScale))
        plume.particleSpeed = max(0, CGFloat(tuning.speed) * max(0.15, speedScale))
        plume.particleSpeedRange = max(0, CGFloat(tuning.speedRange) * max(0.35, widthScale))
        plume.xAcceleration = CGFloat(tuning.xAcceleration)
        plume.yAcceleration = CGFloat(tuning.yAcceleration)
        plume.particlePositionRange = CGVector(
            dx: max(0, CGFloat(tuning.positionRangeX) * max(0.4, widthScale)),
            dy: max(0, CGFloat(tuning.positionRangeY) * max(0.4, widthScale))
        )

        plume.particleScale = max(0.001, CGFloat(tuning.scale) * max(0.05, sizeScale))
        plume.particleScaleRange = max(0, CGFloat(tuning.scaleRange) * max(0.05, CGFloat(size)))
        plume.particleScaleSpeed = CGFloat(tuning.scaleSpeed) * max(0.05, CGFloat(size))
        plume.particleAlpha = min(1, max(0, CGFloat(tuning.alpha) * opacityScale))
        plume.particleAlphaRange = min(1, max(0, CGFloat(tuning.alphaRange) * opacityScale))
        plume.particleAlphaSpeed = CGFloat(tuning.alphaSpeed)
        plume.particleColor = plumeColor
        plume.particleColorBlendFactor = min(1, max(0, CGFloat(tuning.colorBlendFactor)))
        plume.particleRotationRange = .pi * 2
        plume.particleRotationSpeed = 0
        plume.particleColorRedRange = 0
        plume.particleColorGreenRange = 0
        plume.particleColorBlueRange = 0
        plume.particleColorAlphaRange = 0
        plume.particleColorRedSpeed = 0
        plume.particleColorGreenSpeed = 0
        plume.particleColorBlueSpeed = 0
        plume.particleColorAlphaSpeed = 0
        plume.particleColorBlendFactorRange = 0
        plume.particleColorBlendFactorSpeed = 0

        // Keep wide plumes feeling continuous without turning into hard dot strings.
        plume.particleBirthRate *= max(1.0, 0.8 + widthScale * 0.35)

        marker.zPosition = 200 + CGFloat(ordinal)
    }

    private func configurePlumeEmitter(_ emitter: SKEmitterNode) {
        emitter.name = "plume"
        emitter.zPosition = 10
        emitter.targetNode = nil
        emitter.particleBlendMode = .alpha
        emitter.particleTexture = PlumeParticleTextureFactory.plumeTexture
        emitter.particleColor = .white
        emitter.particleColorBlendFactor = 1
        emitter.particleRotationRange = .pi * 2
        emitter.particleAlphaSequence = SKKeyframeSequence(
            keyframeValues: [0.0, 0.45, 0.30, 0.0].map { NSNumber(value: $0) },
            times: [0.0, 0.18, 0.70, 1.0].map { NSNumber(value: $0) }
        )
        emitter.particleScaleSequence = SKKeyframeSequence(
            keyframeValues: [0.35, 1.0, 1.85].map { NSNumber(value: $0) },
            times: [0.0, 0.35, 1.0].map { NSNumber(value: $0) }
        )

        emitter.particleBirthRate = 120
        emitter.particleLifetime = 2.3
        emitter.particleLifetimeRange = 0.8
        emitter.emissionAngle = .pi / 2
        emitter.emissionAngleRange = .pi * 0.3
        emitter.particleSpeed = 120
        emitter.particleSpeedRange = 40
        emitter.particlePositionRange = CGVector(dx: 10, dy: 4)
        emitter.particleScale = 0.14
        emitter.particleScaleRange = 0.05
        emitter.particleScaleSpeed = 0
        emitter.particleAlpha = 0.45
        emitter.particleAlphaRange = 0.10
        emitter.particleAlphaSpeed = 0
    }
}

@available(iOS 17.0, *)
private enum PlumeParticleTextureFactory {
    static let plumeTexture: SKTexture = {
        SKTexture(image: smokeTexture(size: 128))
    }()

    private static func smokeTexture(size: Int) -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
        return renderer.image { ctx in
            let cg = ctx.cgContext
            let s = CGFloat(size)
            let center = CGPoint(x: s * 0.5, y: s * 0.5)

            cg.setFillColor(UIColor.clear.cgColor)
            cg.fill(CGRect(x: 0, y: 0, width: s, height: s))

            // Build a soft cloud silhouette with overlapping blobs.
            let blobs: [(CGFloat, CGFloat, CGFloat, CGFloat)] = [
                (-0.18, -0.10, 0.28, 0.20),
                (0.10, -0.16, 0.24, 0.18),
                (0.22, 0.02, 0.22, 0.16),
                (-0.05, 0.08, 0.30, 0.17),
                (-0.23, 0.10, 0.20, 0.14),
                (0.02, 0.26, 0.18, 0.12),
                (0.20, 0.20, 0.17, 0.11),
                (-0.14, 0.25, 0.16, 0.11)
            ]

            for (dx, dy, rScale, alpha) in blobs {
                let r = s * rScale
                let x = center.x + s * dx - r
                let y = center.y + s * dy - r
                cg.setFillColor(UIColor(white: 1, alpha: alpha).cgColor)
                cg.fillEllipse(in: CGRect(x: x, y: y, width: r * 2, height: r * 2))
            }

            // Add a soft center fill + edge falloff so particles merge into a plume.
            for step in stride(from: Int(s * 0.34), through: 2, by: -2) {
                let r = CGFloat(step)
                let t = 1 - (r / (s * 0.34))
                let alpha = max(0, 0.10 - t * 0.11)
                cg.setFillColor(UIColor(white: 1, alpha: alpha).cgColor)
                cg.fillEllipse(in: CGRect(x: center.x - r, y: center.y - r, width: r * 2, height: r * 2))
            }

            for step in stride(from: Int(s * 0.48), through: 2, by: -2) {
                let r = CGFloat(step)
                let t = 1 - (r / (s * 0.5))
                let alpha = max(0, 0.06 - t * 0.08)
                cg.setFillColor(UIColor(white: 1, alpha: alpha).cgColor)
                cg.fillEllipse(in: CGRect(x: center.x - r, y: center.y - r, width: r * 2, height: r * 2))
            }
        }
    }
}

private extension UIColor {
    convenience init?(plumeHexRGB: String) {
        var hex = plumeHexRGB.trimmingCharacters(in: .whitespacesAndNewlines)
        if hex.hasPrefix("#") { hex.removeFirst() }
        guard hex.count == 6, let value = Int(hex, radix: 16) else { return nil }
        let r = CGFloat((value >> 16) & 0xFF) / 255.0
        let g = CGFloat((value >> 8) & 0xFF) / 255.0
        let b = CGFloat(value & 0xFF) / 255.0
        self.init(red: r, green: g, blue: b, alpha: 1)
    }
}
