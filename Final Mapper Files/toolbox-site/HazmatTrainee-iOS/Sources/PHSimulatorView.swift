import SwiftUI

struct PHSimulatorView: View {
    @EnvironmentObject private var model: AppModel
    @State private var timer = Timer.publish(every: 0.4, on: .main, in: .common).autoconnect()

    var body: some View {
        ScreenShell(title: "pH Paper", subtitle: model.selectedScenario?.name ?? "pH Simulator") {
            VStack(spacing: 14) {
                if let zones = model.selectedScenario?.zones {
                    ZonePickerCard(zones: zones, selected: $model.selectedZoneName) { zone in
                        model.applyZoneToSimulators(zoneName: zone)
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("pH Strip")
                        .font(.headline)
                    HStack(spacing: 6) {
                        ForEach(0...14, id: \.self) { value in
                            RoundedRectangle(cornerRadius: 8)
                                .fill(phColor(for: Double(value)))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(value == Int(model.phTarget.rounded()) ? Color.white : Color.black.opacity(0.15), lineWidth: value == Int(model.phTarget.rounded()) ? 3 : 1)
                                }
                                .frame(height: 34)
                                .overlay(alignment: .center) {
                                    Text("\(value)")
                                        .font(.caption2.weight(.bold))
                                        .foregroundStyle(.white.opacity(value == 7 ? 0.9 : 0.95))
                                }
                        }
                    }
                }
                .padding(14)
                .background(.white, in: RoundedRectangle(cornerRadius: 16))

                VStack(alignment: .leading, spacing: 10) {
                    Text("Detected pH")
                        .font(.headline)
                    RoundedRectangle(cornerRadius: 16)
                        .fill(phColor(for: model.phDisplay))
                        .frame(height: 72)
                        .overlay {
                            Text("\(model.phDisplay, specifier: "%.1f")")
                                .font(.system(size: 32, weight: .bold, design: .rounded))
                                .foregroundStyle(.white)
                        }

                    Slider(value: $model.phTarget, in: 0...14, step: 1)
                    Text("pH Level Equivalent")
                        .font(.subheadline.weight(.semibold))
                    Text(model.roundedPHFact)
                        .foregroundStyle(.secondary)
                }
                .padding(14)
                .background(.white, in: RoundedRectangle(cornerRadius: 16))
            }
        }
        .onReceive(timer) { _ in
            model.syncPHDisplayTowardTarget()
        }
    }

    private func phColor(for value: Double) -> Color {
        let pH = max(0, min(14, value))
        func lerp(_ a: Double, _ b: Double, _ t: Double) -> Double { a + (b - a) * t }

        let stops: [(limit: Double, a: (Double, Double, Double), b: (Double, Double, Double), start: Double, span: Double)] = [
            (0, (255,0,0), (255,0,0), 0, 1),
            (3, (255,0,0), (255,69,0), 0, 3),
            (5, (255,69,0), (255,140,0), 3, 2),
            (6.5, (255,140,0), (255,215,0), 5, 1.5),
            (7.5, (255,215,0), (0,128,0), 6.5, 1),
            (9, (0,128,0), (0,191,255), 7.5, 1.5),
            (11, (0,191,255), (0,0,255), 9, 2),
            (14, (0,0,255), (75,0,130), 11, 3)
        ]

        for stop in stops where pH <= stop.limit {
            let t = stop.span == 0 ? 0 : (pH - stop.start) / stop.span
            return Color(
                red: lerp(stop.a.0, stop.b.0, t) / 255,
                green: lerp(stop.a.1, stop.b.1, t) / 255,
                blue: lerp(stop.a.2, stop.b.2, t) / 255
            )
        }

        return Color(red: 75/255, green: 0, blue: 130/255)
    }
}
