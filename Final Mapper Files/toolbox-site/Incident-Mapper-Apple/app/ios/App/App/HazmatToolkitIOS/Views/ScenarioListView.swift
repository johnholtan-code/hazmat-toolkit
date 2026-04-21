import SwiftUI
import HazMatDesignSystem

struct ScenarioListView: View {
    @ObservedObject var store: AppStore
    let device: DetectionDevice

    @State private var pendingDelete: Scenario?

    var body: some View {
        List {
            if store.scenarios(for: device).isEmpty {
                if #available(iOS 17.0, *) {
                    ContentUnavailableView(
                        "No scenarios to show",
                        systemImage: "tray",
                        description: Text("Create a new \(device.rawValue) scenario.")
                    )
                } else {
                    VStack(alignment: .center, spacing: 8) {
                        Image(systemName: "tray")
                            .font(.largeTitle)
                            .foregroundStyle(.secondary)
                        Text("No scenarios to show")
                            .font(.headline)
                            .foregroundStyle(.secondary)
                        Text("Create a new \(device.rawValue) scenario.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 24)
                }
            } else {
                ForEach(store.scenarios(for: device)) { scenario in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(scenario.scenarioName)
                            .font(.headline)
                        Text("Running on: \(scenario.scenarioDate.formatted(date: .abbreviated, time: .omitted))")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        HStack {
                            Button("Watch") { store.openWatch(for: scenario) }
                                .buttonStyle(PrimaryButtonStyle())
                            Button("Edit") { store.openEditor(for: scenario) }
                                .buttonStyle(SecondaryButtonStyle())
                            Button("Remove") { pendingDelete = scenario }
                                .buttonStyle(.bordered)
                                .tint(.red)
                        }
                    }
                    .padding(.vertical, 4)
                    .hazmatPanel()
                }
            }
        }
        .hazmatBackground()
        .navigationTitle(device.rawValue)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    store.openCreateScenario(for: device)
                } label: {
                    Label("Create New", systemImage: "plus")
                }
            }
        }
        .searchable(text: $store.scenarioSearchText, prompt: "Search scenarios")
        .alert("Delete Scenario?", isPresented: deleteAlertBinding, presenting: pendingDelete) { scenario in
            Button("Delete", role: .destructive) {
                Task { await store.deleteScenario(scenario.id) }
                pendingDelete = nil
            }
            Button("Cancel", role: .cancel) {
                pendingDelete = nil
            }
        } message: { scenario in
            Text("This will remove the scenario header and associated shape data (Power App behavior removes `GeoSims` rows first).")
        }
    }

    private var deleteAlertBinding: Binding<Bool> {
        Binding(
            get: { pendingDelete != nil },
            set: { if !$0 { pendingDelete = nil } }
        )
    }
}
