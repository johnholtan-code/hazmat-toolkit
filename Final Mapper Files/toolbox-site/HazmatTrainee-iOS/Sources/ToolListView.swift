import SwiftUI

struct ToolListView: View {
    @EnvironmentObject private var model: AppModel
    @State private var search = ""
    @State private var pendingMonitor: MonitorType?

    private var filtered: [MonitorType] {
        let tools = MonitorType.allCases
        guard !search.isEmpty else { return tools }
        return tools.filter { $0.rawValue.localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        ScreenShell(title: "Tools (\(filtered.count))", subtitle: "Choose a Detection Device") {
            VStack(spacing: 12) {
                TextField("Search tools", text: $search)
                    .textFieldStyle(.roundedBorder)
                    .padding(.horizontal, 4)

                if let scenario = model.selectedScenario {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Selected scenario")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(scenario.name)
                            .font(.headline)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(.white, in: RoundedRectangle(cornerRadius: 14))
                }

                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(filtered) { monitor in
                            HStack(alignment: .top, spacing: 12) {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(monitor.rawValue)
                                        .font(.headline)
                                    Text(monitor.displayDescription)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Button("Run") { pendingMonitor = monitor }
                                    .buttonStyle(.bordered)
                            }
                            .padding(14)
                            .background(.white, in: RoundedRectangle(cornerRadius: 16))
                        }

                        if filtered.isEmpty {
                            Text("No scenarios to show.")
                                .foregroundStyle(.secondary)
                                .italic()
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(.white, in: RoundedRectangle(cornerRadius: 14))
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
                    Text(monitor.rawValue)
                        .font(.headline)
                    Text("This matches the Power App tool routing: Radiation Monitor -> radiation simulator, pH Paper -> pH simulator, everything else -> gas simulator.")
                        .foregroundStyle(.secondary)
                    HStack {
                        Button("No") { pendingMonitor = nil }
                            .buttonStyle(.bordered)
                        Spacer()
                        Button("Run") {
                            model.chooseMonitor(monitor)
                            pendingMonitor = nil
                            model.navPath.append(model.routeForSelectedMonitor())
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(THMGTheme.accentYellow)
                        .foregroundStyle(.black)
                    }
                }
                .padding()
                .navigationTitle("Tool")
                .navigationBarTitleDisplayMode(.inline)
            }
            .presentationDetents([.medium])
        }
    }
}
