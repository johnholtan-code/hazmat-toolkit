import SwiftUI
import Combine
import AVFoundation
import AudioToolbox
import UIKit
import HazMatDesignSystem

struct GasSimulatorView: View {
    @EnvironmentObject private var model: AppModel
    @State private var tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    @State private var alarmFeedbackTick = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()
    @State private var alarmFeedbackPhase = false
    @State private var lastAlarmFeedbackState: AirMonitorAlarmState = .normal

    var body: some View {
        ScreenShell(title: model.currentAirMonitorDisplayName, subtitle: model.selectedMonitor?.rawValue ?? "Gas Monitor") {
            GeometryReader { proxy in
                let availableWidth = max(proxy.size.width, 320)
                let twoColumnWidth = max(150, (availableWidth - 10) / 2)
                let columns = [GridItem(.adaptive(minimum: twoColumnWidth, maximum: 280), spacing: 10, alignment: .top)]

                ZStack {
                    ScrollView {
                        VStack(spacing: 14) {
                            if let scenario = model.selectedScenario {
                                Text(scenario.name)
                                    .font(.headline)
                                    .foregroundStyle(.white)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            LazyVGrid(columns: columns, alignment: .leading, spacing: 10) {
                                ForEach(model.airMonitorSensors) { sensor in
                                    MetricTile(
                                        title: model.airMonitorTileTitle(for: sensor),
                                        value: model.airMonitorValueText(for: sensor),
                                        unit: model.airMonitorUnit(for: sensor),
                                        alarmState: model.airMonitorAlarmState(for: sensor)
                                    )
                                }
                            }
                        }
                    }

                    if let calibrationStep = model.airMonitorCalibrationStep {
                        calibrationOverlay(for: calibrationStep)
                    }
                }
            }
        }
        .onAppear {
            model.setToolRunActive(true)
            model.beginAirMonitorCalibrationIfNeeded()
        }
        .onReceive(tick) { _ in
            model.simulateGasDrift()
        }
        .onReceive(alarmFeedbackTick) { _ in
            handleAlarmFeedbackTick()
        }
        .onDisappear {
            model.setToolRunActive(false)
            lastAlarmFeedbackState = .normal
            alarmFeedbackPhase = false
        }
    }

    private func handleAlarmFeedbackTick() {
        guard model.airMonitorCalibrationStep == nil else {
            lastAlarmFeedbackState = .normal
            alarmFeedbackPhase = false
            return
        }

        let state = model.highestAirMonitorAlarmState
        if state != lastAlarmFeedbackState {
            lastAlarmFeedbackState = state
            alarmFeedbackPhase = false
            if state != .normal {
                playAlarmFeedback(for: state)
            }
            return
        }

        guard state != .normal else { return }
        alarmFeedbackPhase.toggle()

        switch state {
        case .high:
            playAlarmFeedback(for: .high)
        case .low:
            if alarmFeedbackPhase {
                playAlarmFeedback(for: .low)
            }
        case .normal:
            break
        }
    }

    private func playAlarmFeedback(for state: AirMonitorAlarmState) {
        let haptics = UINotificationFeedbackGenerator()
        haptics.prepare()

        switch state {
        case .high:
            haptics.notificationOccurred(.error)
            TraineeAlarmSoundPlayer.playHighAlarm()
            AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        case .low:
            haptics.notificationOccurred(.warning)
            TraineeAlarmSoundPlayer.playLowAlarm()
            AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        case .normal:
            break
        }
    }

    @ViewBuilder
    private func calibrationOverlay(for step: AirMonitorCalibrationStep) -> some View {
        ZStack {
            Color.black.opacity(0.55)
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 14) {
                Text("Calibrate Air Monitor")
                    .font(.title3.bold())
                    .foregroundStyle(.white)

                Text(calibrationInstruction(for: step))
                    .foregroundStyle(.white.opacity(0.82))

                if let message = model.airMonitorCalibrationStatusMessage, !message.isEmpty {
                    Text(message)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(ThemeColors.accent)
                }

                Button(step == .low ? "Finish Calibration" : "Capture Position") {
                    if model.captureAirMonitorCalibrationStep() {
                        AirMonitorCalibrationFeedbackPlayer.playDing()
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
            }
            .padding(18)
            .hazmatPanel()
            .padding(.horizontal, 16)
        }
    }

    private func calibrationInstruction(for step: AirMonitorCalibrationStep) -> String {
        switch step {
        case .normal:
            return "Hold the monitor at your normal working height, keep it steady, and capture that position."
        case .high:
            return "Raise the monitor high above your normal position, keep it steady, and capture that position."
        case .low:
            return "Lower the monitor below your normal position, keep it steady, and capture that position."
        }
    }
}

private enum TraineeAlarmSoundPlayer {
    private static var lowAlarmSoundID: SystemSoundID?
    private static var highAlarmSoundID: SystemSoundID?
    private static var attemptedLoadLow = false
    private static var attemptedLoadHigh = false

    static func playLowAlarm() {
        play(resource: "low_alarm", cachedID: &lowAlarmSoundID, attempted: &attemptedLoadLow, fallback: SystemSoundID(1005))
    }

    static func playHighAlarm() {
        play(resource: "high_alarm", cachedID: &highAlarmSoundID, attempted: &attemptedLoadHigh, fallback: SystemSoundID(1016))
    }

    private static func play(resource: String, cachedID: inout SystemSoundID?, attempted: inout Bool, fallback: SystemSoundID) {
        if !attempted {
            attempted = true
            cachedID = loadSystemSoundID(resource: resource, ext: "wav")
        }

        if let cachedID {
            AudioServicesPlaySystemSound(cachedID)
        } else {
            AudioServicesPlaySystemSound(fallback)
        }
    }

    private static func loadSystemSoundID(resource: String, ext: String) -> SystemSoundID? {
        guard let url = Bundle.main.url(forResource: resource, withExtension: ext) else { return nil }
        var soundID: SystemSoundID = 0
        let status = AudioServicesCreateSystemSoundID(url as CFURL, &soundID)
        guard status == kAudioServicesNoError else { return nil }
        return soundID
    }
}

private enum AirMonitorCalibrationFeedbackPlayer {
    static func playDing() {
        AudioServicesPlaySystemSound(SystemSoundID(1013))
    }
}

struct AirMonitorBuilderView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let compactLayout = width < 760

            ScrollView(.vertical, showsIndicators: true) {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Build Air Monitor")
                            .font(.system(size: compactLayout ? 24 : 28, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        Text("Pick up to 6 sensors and arrange the order")
                            .font(compactLayout ? .subheadline : .headline)
                            .foregroundStyle(.white.opacity(0.72))
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Device Name", text: $model.airMonitorDeviceName)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(ThemeColors.panel)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(ThemeColors.panelStroke, lineWidth: 1)
                            )
                        if let monitor = model.selectedMonitor {
                            Text(monitor.rawValue)
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.72))
                        }
                    }
                    .hazmatPanel()

                    VStack(alignment: .leading, spacing: 10) {
                        HStack(alignment: .center, spacing: 8) {
                            Text("Sensors (\(model.airMonitorSensors.count)/6)")
                                .font(.headline)
                                .foregroundStyle(.white)
                            Spacer(minLength: 8)
                            Button("Add Sensor") {
                                model.addAirMonitorSensorSlot()
                            }
                            .buttonStyle(SecondaryButtonStyle())
                            .disabled(model.airMonitorSensors.count >= 6)
                        }

                        ForEach(Array(model.airMonitorSensors.enumerated()), id: \.element.id) { index, slot in
                            if compactLayout {
                                compactSensorRow(index: index, slot: slot)
                            } else {
                                regularSensorRow(index: index, slot: slot)
                            }
                        }
                    }
                    .hazmatPanel()

                    VStack(spacing: 10) {
                        Button {
                            model.saveCurrentAirMonitorProfile(runAfterSave: false)
                            dismiss()
                        } label: {
                            Text("Save Tool")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(SecondaryButtonStyle())

                        Button {
                            model.saveCurrentAirMonitorProfile(runAfterSave: true)
                            dismiss()
                        } label: {
                            Text("Save & Run")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(PrimaryButtonStyle())
                    }
                }
                .padding(.horizontal, compactLayout ? 12 : 16)
                .padding(.top, compactLayout ? 18 : 16)
                .padding(.bottom, 20)
                .frame(maxWidth: 980, alignment: .leading)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .hazmatBackground()
        }
    }

    private func regularSensorRow(index: Int, slot: TraineeAirMonitorSensorSlot) -> some View {
        HStack(spacing: 12) {
            Text("\(index + 1).")
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
                .frame(width: 28, alignment: .leading)

            sensorPicker(for: slot)
                .frame(width: 460, alignment: .leading)

            unitPicker(for: slot)
                .frame(width: 140, alignment: .leading)

            orderButtons(for: slot)

            deleteButton(for: slot)
        }
    }

    private func compactSensorRow(index: Int, slot: TraineeAirMonitorSensorSlot) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Sensor \(index + 1)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.72))
                Spacer()
            }

            sensorPicker(for: slot)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(alignment: .center, spacing: 10) {
                unitPicker(for: slot)
                    .frame(maxWidth: 150, alignment: .leading)

                Spacer(minLength: 0)

                orderButtons(for: slot)
                deleteButton(for: slot)
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.white.opacity(0.04))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(ThemeColors.panelStroke, lineWidth: 1)
        )
    }

    private func sensorPicker(for slot: TraineeAirMonitorSensorSlot) -> some View {
        Picker("Sensor", selection: Binding(
            get: {
                model.airMonitorSensors.first(where: { $0.id == slot.id })?.catalogAbbr ?? slot.catalogAbbr
            },
            set: { newAbbr in
                guard let currentIndex = model.airMonitorSensors.firstIndex(where: { $0.id == slot.id }) else { return }
                model.airMonitorSensors[currentIndex].catalogAbbr = newAbbr
                if let item = model.airMonitorCatalogItem(for: newAbbr),
                   !item.units.contains(model.airMonitorSensors[currentIndex].unit) {
                    model.airMonitorSensors[currentIndex].unit = item.units.first ?? ""
                }
            }
        )) {
            ForEach(TraineeChemicalCatalog.all) { sensor in
                Text("\(sensor.name) (\(sensor.abbr))").tag(sensor.abbr)
            }
        }
        .pickerStyle(.menu)
        .lineLimit(1)
        .minimumScaleFactor(0.85)
    }

    private func unitPicker(for slot: TraineeAirMonitorSensorSlot) -> some View {
        Picker("Unit", selection: Binding(
            get: {
                model.airMonitorSensors.first(where: { $0.id == slot.id })?.unit ?? slot.unit
            },
            set: { newUnit in
                guard let currentIndex = model.airMonitorSensors.firstIndex(where: { $0.id == slot.id }) else { return }
                model.airMonitorSensors[currentIndex].unit = newUnit
            }
        )) {
            ForEach(
                model.airMonitorCatalogItem(for: model.airMonitorSensors.first(where: { $0.id == slot.id })?.catalogAbbr ?? slot.catalogAbbr)?.units
                ?? [model.airMonitorSensors.first(where: { $0.id == slot.id })?.unit ?? slot.unit],
                id: \.self
            ) { unit in
                Text(unit).tag(unit)
            }
        }
        .pickerStyle(.menu)
    }

    private func orderButtons(for slot: TraineeAirMonitorSensorSlot) -> some View {
        HStack(spacing: 8) {
            Button {
                guard let currentIndex = model.airMonitorSensors.firstIndex(where: { $0.id == slot.id }) else { return }
                model.moveAirMonitorSensorUp(at: currentIndex)
            } label: {
                Image(systemName: "arrow.up")
            }
            .buttonStyle(SecondaryButtonStyle())
            .disabled(model.airMonitorSensors.firstIndex(where: { $0.id == slot.id }) == 0)

            Button {
                guard let currentIndex = model.airMonitorSensors.firstIndex(where: { $0.id == slot.id }) else { return }
                model.moveAirMonitorSensorDown(at: currentIndex)
            } label: {
                Image(systemName: "arrow.down")
            }
            .buttonStyle(SecondaryButtonStyle())
            .disabled(model.airMonitorSensors.firstIndex(where: { $0.id == slot.id }) == model.airMonitorSensors.count - 1)
        }
    }

    private func deleteButton(for slot: TraineeAirMonitorSensorSlot) -> some View {
        Button(role: .destructive) {
            guard let currentIndex = model.airMonitorSensors.firstIndex(where: { $0.id == slot.id }) else { return }
            model.removeAirMonitorSensor(at: currentIndex)
        } label: {
            Image(systemName: "trash")
        }
        .buttonStyle(SecondaryButtonStyle())
        .disabled(model.airMonitorSensors.count <= 1)
    }
}
