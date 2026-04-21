import SwiftUI

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
        ZStack {
            THMGTheme.softGray.ignoresSafeArea()
            VStack(spacing: 16) {
                VStack(spacing: 8) {
                    Text(title)
                        .font(.system(size: 30, weight: .semibold, design: .rounded))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color(.systemGray4))
                    if let subtitle {
                        Text(subtitle)
                            .font(.headline)
                            .foregroundStyle(.secondary)
                    }
                }
                content
                Spacer(minLength: 8)
                HStack {
                    Spacer()
                    PoweredByBadge()
                }
            }
            .padding(16)
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct PoweredByBadge: View {
    var body: some View {
        VStack(spacing: 2) {
            Text("Powered by")
                .font(.caption)
                .foregroundStyle(.secondary)
            Image("PoweredByLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 120, height: 42)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(.white.opacity(0.95), in: UnevenRoundedRectangle(topLeadingRadius: 0, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: 16))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.black.opacity(0.06), lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
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
        .padding(14)
        .background(.white, in: RoundedRectangle(cornerRadius: 16))
    }
}

struct MetricTile: View {
    let title: String
    let value: String
    let unit: String
    let isAlarm: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value)
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(isAlarm ? THMGTheme.warning : .primary)
                Text(unit)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Text(isAlarm ? "ALARM" : "Normal")
                .font(.caption.weight(.bold))
                .foregroundStyle(isAlarm ? .white : .green)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(isAlarm ? THMGTheme.warning : THMGTheme.ok.opacity(0.2), in: Capsule())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(.white, in: RoundedRectangle(cornerRadius: 16))
    }
}
