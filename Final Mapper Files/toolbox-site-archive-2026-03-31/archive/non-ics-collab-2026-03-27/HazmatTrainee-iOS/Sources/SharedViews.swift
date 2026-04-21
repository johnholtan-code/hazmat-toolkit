import SwiftUI
import HazMatDesignSystem

struct ScreenShell<Content: View>: View {
    let title: String
    let subtitle: String?
    @ViewBuilder var content: Content

    init(title: String, subtitle: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.content = content()
    }

    var body: some View {
        VStack(spacing: 16) {
            VStack(spacing: 8) {
                Text(title)
                    .font(.system(size: 30, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                if let subtitle {
                    Text(subtitle)
                        .font(.headline)
                        .foregroundStyle(ThemeColors.accent)
                }
            }
            .hazmatPanel()

            content

            Spacer(minLength: 8)
        }
        .padding(16)
        .hazmatBackground()
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ZonePickerCard: View {
    let zones: [ScenarioZone]
    @Binding var selected: String
    let onChange: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Training Zone")
                .font(.headline)
                .foregroundStyle(.white)
            Picker("Training Zone", selection: $selected) {
                ForEach(zones) { zone in
                    Text(zone.name).tag(zone.name)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: selected) { _, value in
                onChange(value)
            }
        }
        .hazmatPanel()
    }
}

struct MetricTile: View {
    let title: String
    let value: String
    let unit: String
    let alarmState: AirMonitorAlarmState
    @State private var pulse = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.72))
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value)
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(valueColor)
                Text(unit)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.72))
            }
            Text(alarmLabel)
                .font(.caption.weight(.bold))
                .foregroundStyle(alarmBadgeTextColor)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(alarmBadgeBackground, in: Capsule())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(tileBackground, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(tileBorder, lineWidth: alarmState == .normal ? 1 : 2)
        }
        .onAppear { updatePulseAnimation() }
        .onChange(of: alarmState) { _, _ in
            updatePulseAnimation()
        }
    }

    private var alarmLabel: String {
        switch alarmState {
        case .normal: return "Normal"
        case .low: return "LOW"
        case .high: return "HIGH"
        }
    }

    private var flashingColor: Color {
        switch alarmState {
        case .normal: return .clear
        case .low: return THMGTheme.accentYellow
        case .high: return THMGTheme.warning
        }
    }

    private var valueColor: Color {
        switch alarmState {
        case .normal: return .white
        case .low: return pulse ? Color(red: 0.25, green: 0.18, blue: 0.0) : .white
        case .high: return pulse ? THMGTheme.warning : .white
        }
    }

    private var alarmBadgeTextColor: Color {
        switch alarmState {
        case .normal: return .green
        case .low: return .black
        case .high: return .white
        }
    }

    private var alarmBadgeBackground: Color {
        switch alarmState {
        case .normal:
            return THMGTheme.ok.opacity(0.2)
        case .low, .high:
            return (pulse ? flashingColor : flashingColor.opacity(0.45))
        }
    }

    private var tileBackground: Color {
        guard alarmState != .normal else { return ThemeColors.panel }
        return pulse ? flashingColor.opacity(0.22) : ThemeColors.panel
    }

    private var tileBorder: Color {
        guard alarmState != .normal else { return ThemeColors.panelStroke }
        return pulse ? flashingColor : flashingColor.opacity(0.45)
    }

    private func updatePulseAnimation() {
        if alarmState == .normal {
            withAnimation(.none) {
                pulse = false
            }
            return
        }

        pulse = false
        withAnimation(.easeInOut(duration: 0.45).repeatForever(autoreverses: true)) {
            pulse = true
        }
    }
}
