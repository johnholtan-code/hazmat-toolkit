import SwiftUI
import HazMatDesignSystem

struct ToolListView: View {
    @EnvironmentObject private var model: AppModel
    @State private var search = ""
    @State private var pendingMonitor: MonitorType?
    @State private var showingAirMonitorBuilder = false

    private var filtered: [MonitorType] {
        let tools = MonitorType.allCases
        guard !search.isEmpty else { return tools }
        return tools.filter { $0.rawValue.localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        ScreenShell(title: "Tools (\(filtered.count))", subtitle: "Choose a Detection Device") {
            VStack(spacing: 12) {
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .center, spacing: 12) {
                        TextField("Search tools", text: $search)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(ThemeColors.panel)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(ThemeColors.panelStroke, lineWidth: 1)
                            )
                            .frame(maxWidth: 280, alignment: .leading)

                        Spacer(minLength: 0)

                        Text("Build New Air Monitor")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.72))

                        newBuilderButton
                    }
                    .padding(.horizontal, 4)

                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Search tools", text: $search)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(ThemeColors.panel)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(ThemeColors.panelStroke, lineWidth: 1)
                            )

                        HStack(spacing: 10) {
                            Text("Build New Air Monitor")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.white.opacity(0.72))
                            Spacer(minLength: 0)
                            newBuilderButton
                        }
                    }
                    .padding(.horizontal, 4)
                }

                if let scenario = model.selectedScenario {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Selected scenario")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.72))
                        Text(scenario.name)
                            .font(.headline)
                            .foregroundStyle(.white)

                        // TODO: Add zone/status display when available on Scenario
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .hazmatPanel()
                }

                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(filtered) { monitor in
                            HStack(alignment: .top, spacing: 12) {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(monitor.rawValue)
                                        .font(.headline)
                                        .foregroundStyle(.white)
                                    Text(monitor.displayDescription)
                                        .font(.subheadline)
                                        .foregroundStyle(.white.opacity(0.72))
                                }
                                Spacer()
                                Button("Run") { pendingMonitor = monitor }
                                    .buttonStyle(PrimaryButtonStyle())
                            }
                            .hazmatPanel()
                        }

                        if !model.savedAirMonitorProfiles.isEmpty {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Custom Air Monitors")
                                    .font(.headline)
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 2)

                                ForEach(model.savedAirMonitorProfiles) { profile in
                                    VStack(alignment: .leading, spacing: 8) {
                                        HStack(alignment: .top) {
                                            VStack(alignment: .leading, spacing: 4) {
                                                Text(profile.name)
                                                    .font(.headline)
                                                    .foregroundStyle(.white)
                                                Text(profile.sensors.map(\.catalogAbbr).joined(separator: " • "))
                                                    .font(.caption)
                                                    .foregroundStyle(.white.opacity(0.72))
                                                    .lineLimit(2)
                                            }
                                            Spacer()
                                        }

                                        HStack {
                                            Button("Run") {
                                                model.runAirMonitorProfile(profile)
                                            }
                                            .buttonStyle(PrimaryButtonStyle())

                                            Button("Edit") {
                                                model.beginEditingAirMonitorProfile(profile)
                                                showingAirMonitorBuilder = true
                                            }
                                            .buttonStyle(SecondaryButtonStyle())

                                            Button("Delete", role: .destructive) {
                                                model.deleteAirMonitorProfile(profile)
                                            }
                                            .buttonStyle(SecondaryButtonStyle())
                                        }
                                    }
                                    .hazmatPanel()
                                }
                            }
                        }

                        if filtered.isEmpty {
                            Text("No scenarios to show.")
                                .foregroundStyle(.white.opacity(0.72))
                                .italic()
                                .frame(maxWidth: .infinity)
                                .hazmatPanel()
                        }
                    }
                }
            }
        }
        .sheet(item: $pendingMonitor) { monitor in
            NavigationStack {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Are you sure?")
                        .font(.title2.bold())
                        .foregroundStyle(.white)
                    Text(monitor.rawValue)
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text(monitor.isAirMonitor
                         ? "Run the built-in monitor profile. To create a custom monitor, use the Build New Air Monitor section on the Tools page."
                         : "This matches the Power App tool routing: Radiation Monitor -> radiation simulator, pH Paper -> pH simulator.")
                        .foregroundStyle(.white.opacity(0.72))
                    HStack {
                        Button("No") { pendingMonitor = nil }
                            .buttonStyle(SecondaryButtonStyle())
                        Spacer()
                        Button("Run") {
                            model.chooseMonitor(monitor)
                            pendingMonitor = nil
                            model.navPath.append(model.routeForSelectedMonitor())
                        }
                        .buttonStyle(PrimaryButtonStyle())
                    }
                }
                .padding()
                .hazmatBackground()
                .navigationTitle("Tool")
                .navigationBarTitleDisplayMode(.inline)
            }
            .presentationDetents([.medium])
        }
        .sheet(isPresented: $showingAirMonitorBuilder) {
            AirMonitorBuilderView()
                .environmentObject(model)
            .presentationDetents([.large])
            .presentationContentInteraction(.scrolls)
        }
    }

    private var newBuilderButton: some View {
        Button("New") {
            model.prepareAirMonitorBuilder(for: .fourGasPID)
            showingAirMonitorBuilder = true
        }
        .buttonStyle(PrimaryButtonStyle())
    }
}
