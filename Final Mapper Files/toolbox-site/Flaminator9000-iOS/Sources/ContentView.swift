import Foundation
import PhotosUI
import SwiftUI
import UIKit

struct ContentView: View {
    @EnvironmentObject private var simulation: FlameSimulationStore
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var exportAlertMessage: String?
    @State private var shareExportItem: ShareExportItem?
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
                .background(Color(uiColor: .systemGroupedBackground))
            }
            .navigationTitle("Flaminator 9000")
            .toolbar {
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
        .alert("GIF Export", isPresented: Binding(
            get: { exportAlertMessage != nil },
            set: { if !$0 { exportAlertMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(exportAlertMessage ?? "")
        }
        .sheet(item: $shareExportItem) { item in
            ActivityView(items: [item.url])
        }
        .sheet(isPresented: $showingGIFSettings) {
            GIFExportSettingsSheet()
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
            shareExportItem = ShareExportItem(url: url)
        } catch {
            exportAlertMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    private var stageView: some View {
                FlameStageView()
            .frame(maxWidth: .infinity)
            .aspectRatio(4.0 / 3.0, contentMode: .fit)
            .background(Color.black)
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

private struct ControlsPanel: View {
    @EnvironmentObject private var simulation: FlameSimulationStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                emitterSection
                particleEditorSection
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color(uiColor: .secondarySystemGroupedBackground))
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
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(uiColor: .tertiarySystemGroupedBackground))
        )
    }
}

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

private struct ShareExportItem: Identifiable {
    let id = UUID()
    let url: URL
}

private struct GIFExportSettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var simulation: FlameSimulationStore

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

private struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
