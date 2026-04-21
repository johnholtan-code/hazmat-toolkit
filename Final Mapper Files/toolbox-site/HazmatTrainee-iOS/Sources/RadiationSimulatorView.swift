import SwiftUI

struct RadiationSimulatorView: View {
    @EnvironmentObject private var model: AppModel
    @State private var distanceMeters: Double = 5
    @State private var guideMode: String = "Strongest"
    @State private var timer = Timer.publish(every: 0.6, on: .main, in: .common).autoconnect()

    var body: some View {
        ScreenShell(title: "Radiation Monitor", subtitle: model.selectedScenario?.name ?? "Radiation Simulator") {
            VStack(spacing: 14) {
                if let zones = model.selectedScenario?.zones {
                    ZonePickerCard(zones: zones, selected: $model.selectedZoneName) { zone in
                        model.applyZoneToSimulators(zoneName: zone)
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("Guide Mode")
                        .font(.headline)
                    Picker("Guide Mode", selection: $guideMode) {
                        Text("Strongest").tag("Strongest")
                        Text("Nearest").tag("Nearest")
                        Text("Net").tag("Net")
                    }
                    .pickerStyle(.segmented)
                }
                .padding(14)
                .background(.white, in: RoundedRectangle(cornerRadius: 16))

                VStack(alignment: .leading, spacing: 10) {
                    Text("Distance to Source (simulated)")
                        .font(.headline)
                    Slider(value: $distanceMeters, in: 0.5...30, step: 0.1)
                    Text("\(distanceMeters, specifier: "%.1f") m")
                        .foregroundStyle(.secondary)
                }
                .padding(14)
                .background(.white, in: RoundedRectangle(cornerRadius: 16))

                VStack(alignment: .leading, spacing: 8) {
                    Text("Dose Rate")
                        .font(.headline)
                    Text("\(model.doseRateRph, specifier: "%.6f") R/hr")
                        .font(.system(size: 30, weight: .bold, design: .rounded))
                    HStack {
                        Text("Background: \(model.backgroundRph, specifier: "%.6f")")
                        Spacer()
                        Text("@1m: \(model.doseAt1mRph, specifier: "%.3f")")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.white, in: RoundedRectangle(cornerRadius: 16))

                VStack(alignment: .leading, spacing: 10) {
                    Text("Source / Shielding")
                        .font(.headline)
                    HStack {
                        Text("Shielding")
                        Slider(value: $model.shielding, in: 0.2...2.0)
                        Text("\(model.shielding, specifier: "%.2f")x")
                            .monospacedDigit()
                    }
                    HStack {
                        Text("Dose @1m")
                        Slider(value: $model.doseAt1mRph, in: 0.001...0.1)
                        Text("\(model.doseAt1mRph, specifier: "%.3f")")
                            .monospacedDigit()
                    }
                }
                .padding(14)
                .background(.white, in: RoundedRectangle(cornerRadius: 16))
            }
        }
        .onReceive(timer) { _ in
            let bias: Double = (guideMode == "Net") ? 0.8 : 1.0
            model.updateRadiation(distanceMeters: distanceMeters, guideBias: bias)
        }
    }
}
