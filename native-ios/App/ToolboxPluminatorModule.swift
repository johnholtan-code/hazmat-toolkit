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
                .hazmatBackground()
            }
            .navigationTitle("Pluminator 9000")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(ThemeColors.backgroundTop.opacity(0.96), for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Back") {
                        dismiss()
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                        Label("Photo", systemImage: "photo")
                    }
                    .buttonStyle(SecondaryButtonStyle())

                    Button {
                        simulation.clearPhoto()
                    } label: {
                        Label("Clear Photo", systemImage: "xmark.circle")
                    }
                    .buttonStyle(SecondaryButtonStyle())
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
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(simulation.isExportingGIF || !simulation.isStageReadyForExport)

                    Button {
                        showingGIFSettings = true
                    } label: {
                        Label("GIF Settings", systemImage: "slider.horizontal.3")
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
            }
        }
        .preferredColorScheme(.dark)
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
            .background(Color.black)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(alignment: .topLeading) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Tap stage to move \(simulation.activeEmitterDisplayName)")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.white)
                    if !simulation.isStageReadyForExport {
                        Text("Preparing GIF exporter…")
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.72))
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    Capsule(style: .continuous)
                        .fill(ThemeColors.panel)
                )
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(ThemeColors.panelStroke, lineWidth: 1)
                )
                .padding(10)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(ThemeColors.panelStroke, lineWidth: 1)
            }
    }
}

@available(iOS 17.0, *)
private struct ControlsPanel: View {
    @EnvironmentObject private var simulation: PLUPlumeSimulationStore
    @State private var isEmittersExpanded = true
    @State private var isPhotoExpanded = true
    @State private var isPlumeControlsExpanded = true
    @State private var isAdvancedExpanded = false

    var body: some View {
        GeometryReader { proxy in
            let compact = proxy.size.width < 390

            ScrollView {
                VStack(alignment: .leading, spacing: compact ? 12 : 14) {
                    if simulation.hasPhoto {
                        photoSection(compact: compact)
                    }
                    emitterSection(compact: compact)
                    plumeControlsSection(compact: compact)
                    spriteEmitterEditorSection(compact: compact)
                    actionsSection(compact: compact)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .hazmatPanel()
            }
        }
    }

    private func photoSection(compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: compact ? 8 : 10) {
            disclosureHeader(title: "Photo", compact: compact, isExpanded: $isPhotoExpanded)

            if isPhotoExpanded {
                Text("Rotate the placed background image.")
                    .font(compact ? .caption : .footnote)
                    .foregroundStyle(.white.opacity(0.72))

                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 8) {
                        secondaryActionButton("Rotate Left") {
                            simulation.rotatePhoto(by: -90)
                        }
                        secondaryActionButton("Reset") {
                            simulation.resetPhotoRotation()
                        }
                        secondaryActionButton("Rotate Right") {
                            simulation.rotatePhoto(by: 90)
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        secondaryActionButton("Rotate Left") {
                            simulation.rotatePhoto(by: -90)
                        }
                        secondaryActionButton("Reset") {
                            simulation.resetPhotoRotation()
                        }
                        secondaryActionButton("Rotate Right") {
                            simulation.rotatePhoto(by: 90)
                        }
                    }
                }
            }
        }
    }

    private func emitterSection(compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: compact ? 8 : 10) {
            disclosureHeader(title: "Emitters", compact: compact, isExpanded: $isEmittersExpanded)

            if isEmittersExpanded {
                ViewThatFits(in: .horizontal) {
                    HStack {
                        Text("Active")
                            .font(compact ? .footnote.weight(.medium) : .subheadline.weight(.medium))
                            .foregroundStyle(.white)
                        Spacer()
                        emitterPicker
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Active")
                            .font(compact ? .footnote.weight(.medium) : .subheadline.weight(.medium))
                            .foregroundStyle(.white)
                        emitterPicker
                    }
                }

                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 8) {
                        primaryActionButton("Add Emitter") {
                            simulation.addEmitter()
                        }
                        .disabled(!simulation.canAddEmitter)

                        secondaryActionButton("Remove Active") {
                            simulation.removeActiveEmitter()
                        }
                        .disabled(!simulation.canRemoveEmitter)

                        secondaryActionButton("Reset Positions") {
                            simulation.resetEmitterPositions()
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        primaryActionButton("Add Emitter") {
                            simulation.addEmitter()
                        }
                        .disabled(!simulation.canAddEmitter)

                        secondaryActionButton("Remove Active") {
                            simulation.removeActiveEmitter()
                        }
                        .disabled(!simulation.canRemoveEmitter)

                        secondaryActionButton("Reset Positions") {
                            simulation.resetEmitterPositions()
                        }
                    }
                }

                Text("\(simulation.emitterChoices.count) / 10 emitters")
                    .font(compact ? .caption2 : .caption)
                    .foregroundStyle(.white.opacity(0.72))
            }
        }
    }

    private func plumeControlsSection(compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: compact ? 8 : 10) {
            disclosureHeader(
                title: "Plume Controls",
                compact: compact,
                isExpanded: $isPlumeControlsExpanded
            )

            if isPlumeControlsExpanded {
                HStack {
                    Text(simulation.activeEmitterDisplayName)
                        .font(compact ? .caption : .subheadline.weight(.medium))
                        .foregroundStyle(.white.opacity(0.72))
                    Spacer()
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Color")
                        .font(compact ? .caption2 : .caption)
                        .foregroundStyle(.white)
                    HStack(spacing: 10) {
                        ColorPicker("Plume Color", selection: simulation.bindingForActiveColor(), supportsOpacity: false)
                            .labelsHidden()
                            .frame(width: 44, height: 32)
                        Text(simulation.activeEmitterColorHex)
                            .font((compact ? Font.caption2 : Font.caption).monospacedDigit())
                            .foregroundStyle(.white.opacity(0.72))
                        Spacer()
                    }
                }
                .hazmatPanel()

                SliderField("Intensity", value: simulation.bindingForActive(\.amount), range: 0...100, step: 1, format: "%.0f", compact: compact)
                SliderField("Opacity", value: simulation.bindingForActive(\.opacity), range: 0...1, step: 0.01, format: "%.2f", compact: compact)
                SliderField("Size", value: simulation.bindingForActive(\.size), range: 0.05...3.0, step: 0.01, format: "%.2f", compact: compact)
                SliderField("Angle", value: simulation.bindingForActive(\.angle), range: 0...360, step: 1, format: "%.0f°", compact: compact)
                SliderField("Tilt", value: simulation.bindingForActive(\.tilt), range: 45...135, step: 1, format: "%.0f°", compact: compact)
                SliderField("Length", value: simulation.bindingForActive(\.length), range: 0.2...3.0, step: 0.1, format: "%.1fx", compact: compact)
                SliderField("Width", value: simulation.bindingForActive(\.width), range: 0.3...3.0, step: 0.1, format: "%.1fx", compact: compact)
                SliderField("Rise Speed", value: simulation.bindingForActive(\.rise), range: 5...80, step: 1, format: "%.0f", compact: compact)
            }
        }
    }

    private func spriteEmitterEditorSection(compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: compact ? 8 : 10) {
            disclosureHeader(
                title: "Advanced Emitter Tuning",
                compact: compact,
                isExpanded: $isAdvancedExpanded
            )

            if isAdvancedExpanded {
                HStack {
                    Spacer()
                    secondaryActionButton("Reset") {
                        simulation.resetSpriteEmitterTuning()
                    }
                }

                Text("These controls tune the SpriteKit plume particle engine for the active emitter.")
                    .font(compact ? .caption : .footnote)
                    .foregroundStyle(.white.opacity(0.72))

                PLUPlumeSpriteEmitterTuningSection(
                    title: "Plume Particle Engine",
                    compact: compact,
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
    }

    private func actionsSection(compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: compact ? 8 : 10) {
            Text("Controls")
                .font(compact ? .subheadline.weight(.semibold) : .headline)
                .foregroundStyle(.white)

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) {
                    secondaryActionButton("Reset Plume Controls") {
                        simulation.resetControls()
                    }
                    secondaryActionButton("Full Reset") {
                        simulation.resetAll()
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    secondaryActionButton("Reset Plume Controls") {
                        simulation.resetControls()
                    }
                    secondaryActionButton("Full Reset") {
                        simulation.resetAll()
                    }
                }
            }

            Text("Layout and interaction now match the updated Flaminator shell for phone-friendly editing.")
                .font(compact ? .caption : .footnote)
                .foregroundStyle(.white.opacity(0.72))
        }
    }

    private var emitterPicker: some View {
        Picker("Active Emitter", selection: $simulation.activeEmitterID) {
            ForEach(simulation.emitterChoices) { emitter in
                Text(emitter.displayName).tag(emitter.id)
            }
        }
        .pickerStyle(.menu)
    }

    private func primaryActionButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(PrimaryButtonStyle())
    }

    private func secondaryActionButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(SecondaryButtonStyle())
    }

    private func disclosureHeader(
        title: String,
        compact: Bool,
        tint: Color = .white,
        isExpanded: Binding<Bool>
    ) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.18)) {
                isExpanded.wrappedValue.toggle()
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: isExpanded.wrappedValue ? "chevron.down" : "chevron.right")
                    .font(compact ? .caption.weight(.bold) : .footnote.weight(.bold))
                    .foregroundStyle(.white.opacity(0.72))
                Text(title)
                    .font(compact ? .subheadline.weight(.semibold) : .headline)
                    .foregroundStyle(tint)
                Spacer()
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

@available(iOS 17.0, *)
private struct SliderField: View {
    let title: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double
    let format: String
    let compact: Bool

    init(
        _ title: String,
        value: Binding<Double>,
        range: ClosedRange<Double>,
        step: Double,
        format: String,
        compact: Bool = false
    ) {
        self.title = title
        self._value = value
        self.range = range
        self.step = step
        self.format = format
        self.compact = compact
    }

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 2 : 4) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(title)
                    .font(compact ? .caption2 : .caption)
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
                Spacer(minLength: 8)
                Text(String(format: format, value))
                    .font((compact ? Font.caption2 : Font.caption).monospacedDigit())
                    .foregroundStyle(.white.opacity(0.72))
            }
            ThumbOnlySlider(value: $value, range: range, step: step)
                .scaleEffect(y: compact ? 0.88 : 1.0)
                .frame(height: compact ? 22 : 28)
        }
    }
}

@available(iOS 17.0, *)
private struct ThumbOnlySlider: UIViewRepresentable {
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double

    func makeCoordinator() -> Coordinator {
        Coordinator(value: $value, range: range, step: step)
    }

    func makeUIView(context: Context) -> ThumbTrackingSlider {
        let slider = ThumbTrackingSlider(frame: .zero)
        slider.minimumValue = Float(range.lowerBound)
        slider.maximumValue = Float(range.upperBound)
        slider.value = Float(value)
        slider.isContinuous = true
        slider.addTarget(context.coordinator, action: #selector(Coordinator.valueChanged(_:)), for: .valueChanged)
        return slider
    }

    func updateUIView(_ uiView: ThumbTrackingSlider, context: Context) {
        uiView.minimumValue = Float(range.lowerBound)
        uiView.maximumValue = Float(range.upperBound)
        context.coordinator.value = $value
        context.coordinator.range = range
        context.coordinator.step = step

        let targetValue = Float(value)
        if abs(uiView.value - targetValue) > 0.0001 {
            uiView.value = targetValue
        }
    }

    @MainActor
    final class Coordinator: NSObject {
        var value: Binding<Double>
        var range: ClosedRange<Double>
        var step: Double

        init(value: Binding<Double>, range: ClosedRange<Double>, step: Double) {
            self.value = value
            self.range = range
            self.step = step
        }

        @objc func valueChanged(_ sender: UISlider) {
            let stepped = round((Double(sender.value) - range.lowerBound) / step) * step + range.lowerBound
            let clamped = min(max(range.lowerBound, stepped), range.upperBound)
            if abs(Double(sender.value) - clamped) > 0.0001 {
                sender.setValue(Float(clamped), animated: false)
            }
            value.wrappedValue = clamped
        }
    }
}

@available(iOS 17.0, *)
private final class ThumbTrackingSlider: UISlider {
    override func beginTracking(_ touch: UITouch, with event: UIEvent?) -> Bool {
        let track = trackRect(forBounds: bounds)
        let thumb = thumbRect(forBounds: bounds, trackRect: track, value: value)
        let hitTarget = thumb.insetBy(dx: -14, dy: -14)
        guard hitTarget.contains(touch.location(in: self)) else {
            return false
        }
        return super.beginTracking(touch, with: event)
    }
}

@available(iOS 17.0, *)
private struct PLUPlumeSpriteEmitterTuningSection: View {
    let title: String
    let compact: Bool
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
        VStack(alignment: .leading, spacing: compact ? 6 : 8) {
            SliderField("Plume Output (particles)", value: $birthRate, range: 0...800, step: 1, format: "%.0f", compact: compact)
            SliderField("Hang Time (seconds)", value: $lifetime, range: 0.05...6.0, step: 0.01, format: "%.2f", compact: compact)
            SliderField("Hang Variability", value: $lifetimeRange, range: 0...3.0, step: 0.01, format: "%.2f", compact: compact)
            SliderField("Travel Speed", value: $speed, range: 0...300, step: 1, format: "%.0f", compact: compact)
            SliderField("Turbulence Spread", value: $speedRange, range: 0...300, step: 1, format: "%.0f", compact: compact)
            SliderField("Crosswind Push", value: $xAcceleration, range: -300...300, step: 1, format: "%.0f", compact: compact)
            SliderField("Vertical Lift / Drop", value: $yAcceleration, range: -300...300, step: 1, format: "%.0f", compact: compact)
            SliderField("Aim Offset", value: $emissionAngleDegrees, range: -180...180, step: 1, format: "%.0f°", compact: compact)
            SliderField("Spray Cone Width", value: $emissionAngleRangeDegrees, range: 0...180, step: 1, format: "%.0f°", compact: compact)
            SliderField("Source Width", value: $positionRangeX, range: 0...120, step: 1, format: "%.0f", compact: compact)
            SliderField("Source Depth", value: $positionRangeY, range: 0...120, step: 1, format: "%.0f", compact: compact)
            SliderField("Particle Start Size", value: $scale, range: 0.01...1.5, step: 0.01, format: "%.2f", compact: compact)
            SliderField("Size Variation", value: $scaleRange, range: 0...1.5, step: 0.01, format: "%.2f", compact: compact)
            SliderField("Expansion Rate", value: $scaleSpeed, range: -3...3, step: 0.01, format: "%.2f", compact: compact)
            SliderField("Plume Density", value: $alpha, range: 0...1, step: 0.01, format: "%.2f", compact: compact)
            SliderField("Density Variation", value: $alphaRange, range: 0...1, step: 0.01, format: "%.2f", compact: compact)
            SliderField("Fade Rate", value: $alphaSpeed, range: -3...3, step: 0.01, format: "%.2f", compact: compact)
            SliderField("Color/Tint Strength", value: $colorBlendFactor, range: 0...1, step: 0.01, format: "%.2f", compact: compact)
        }
        .hazmatPanel()
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
                        .foregroundStyle(.white.opacity(0.72))

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
                        .foregroundStyle(.white)
                        .padding(.top, 2)

                    Label(
                        "Use this when you want only the plume in the GIF for overlaying on other media. Turn it off to include the scene/photo background.",
                        systemImage: "questionmark.circle"
                    )
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.72))
                    .padding(.top, 2)
                }
                .hazmatPanel()
                .padding()
            }
            .hazmatBackground()
            .navigationTitle("GIF Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(ThemeColors.backgroundTop.opacity(0.96), for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Reset") {
                        simulation.resetGIFExportSettings()
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .buttonStyle(PrimaryButtonStyle())
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
    let backgroundRotationDegrees: Double
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
    @Published private(set) var backgroundRotationDegrees: Double = 0
    @Published private(set) var emitters: [PLUPlumeEmitterState]
    @Published private(set) var isExportingGIF = false
    @Published private(set) var gifExportSettings = PLUGIFExportSettings.defaults
    @Published private(set) var isStageReadyForExport = false

    private var stageView: SKView?
    private var stageScene: PLUPlumeSpriteScene?

    private let gifExportSettingsKey = "Pluminator9000.gifExportSettings"
    private let backgroundRotationKey = "Pluminator9000.backgroundRotationDegrees"
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
        loadBackgroundRotation()
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
        backgroundRotationDegrees = 0
        persistBackgroundRotation()
    }

    func rotatePhoto(by deltaDegrees: Double) {
        setBackgroundRotation(backgroundRotationDegrees + deltaDegrees)
    }

    func resetPhotoRotation() {
        setBackgroundRotation(0)
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
        backgroundRotationDegrees = 0
        persistBackgroundRotation()
    }

    func renderSnapshot() -> PLUPlumeRenderSnapshot {
        PLUPlumeRenderSnapshot(
            backgroundImage: backgroundImage,
            backgroundRotationDegrees: backgroundRotationDegrees,
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

    private func loadBackgroundRotation() {
        backgroundRotationDegrees = UserDefaults.standard.object(forKey: backgroundRotationKey) as? Double ?? 0
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

    private func persistBackgroundRotation() {
        UserDefaults.standard.set(backgroundRotationDegrees, forKey: backgroundRotationKey)
    }

    private func setBackgroundRotation(_ value: Double) {
        var normalized = value.truncatingRemainder(dividingBy: 360)
        if normalized > 180 {
            normalized -= 360
        } else if normalized <= -180 {
            normalized += 360
        }
        backgroundRotationDegrees = normalized
        persistBackgroundRotation()
        objectWillChange.send()
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
        updateBackground(snapshot.backgroundImage, rotationDegrees: snapshot.backgroundRotationDegrees)
        apply(snapshot: snapshot)
    }

    private func updateBackground(_ image: UIImage?, rotationDegrees: Double) {
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

        backgroundNode.zRotation = CGFloat(rotationDegrees * .pi / 180.0)

        updateBackgroundLayout()
    }

    private func updateBackgroundLayout() {
        guard size.width > 0, size.height > 0 else { return }

        if let texture = backgroundNode.texture {
            let imageSize = texture.size()
            guard imageSize.width > 0, imageSize.height > 0 else { return }
            let scale = max(size.width / imageSize.width, size.height / imageSize.height)
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
