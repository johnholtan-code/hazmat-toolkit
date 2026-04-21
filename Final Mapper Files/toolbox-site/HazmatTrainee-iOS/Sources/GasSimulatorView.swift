import SwiftUI

struct GasSimulatorView: View {
    @EnvironmentObject private var model: AppModel
    @State private var tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var isFourGasOnly: Bool { model.selectedMonitor == .fourGas }

    var body: some View {
        ScreenShell(title: "Simulator", subtitle: model.selectedMonitor?.rawValue ?? "Gas Monitor") {
            VStack(spacing: 14) {
                if let scenario = model.selectedScenario {
                    Text(scenario.name)
                        .font(.headline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let zones = model.selectedScenario?.zones {
                    ZonePickerCard(zones: zones, selected: $model.selectedZoneName) { zone in
                        model.applyZoneToSimulators(zoneName: zone)
                    }
                }

                let alarms = model.gasAlarms
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    MetricTile(title: "OXYGEN", value: String(format: "%.1f", model.gasReadings.oxygen), unit: "%", isAlarm: alarms["O2"] ?? false)
                    MetricTile(title: "LEL", value: String(format: "%.1f", model.gasReadings.lel), unit: "%", isAlarm: alarms["LEL"] ?? false)
                    MetricTile(title: "CO", value: String(format: "%.0f", model.gasReadings.co), unit: "ppm", isAlarm: alarms["CO"] ?? false)
                    MetricTile(title: "H2S", value: String(format: "%.1f", model.gasReadings.h2s), unit: "ppm", isAlarm: alarms["H2S"] ?? false)
                    if !isFourGasOnly {
                        MetricTile(title: "VOC", value: String(format: "%.1f", model.gasReadings.pid), unit: "ppm", isAlarm: alarms["VOC"] ?? false)
                    }
                }

                Text("Zone: \(model.selectedZoneName)")
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .font(.subheadline.weight(.semibold))
            }
        }
        .onReceive(tick) { _ in
            model.simulateGasDrift()
        }
    }
}
