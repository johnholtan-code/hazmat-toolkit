import SwiftUI

struct ScenarioListView: View {
    @EnvironmentObject private var model: AppModel
    @State private var search = ""
    @State private var pendingScenario: Scenario?

    private var filtered: [Scenario] {
        guard !search.isEmpty else { return model.scenarios }
        return model.scenarios.filter { $0.name.localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        ScreenShell(title: "Scenarios (\(filtered.count))", subtitle: "Choose the Scenario") {
            VStack(spacing: 12) {
                TextField("Search scenarios", text: $search)
                    .textFieldStyle(.roundedBorder)
                    .padding(.horizontal, 4)

                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(filtered) { scenario in
                            ScenarioCard(scenario: scenario) {
                                pendingScenario = scenario
                            }
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
        .sheet(item: $pendingScenario) { scenario in
            NavigationStack {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Are you sure?")
                        .font(.title2.bold())
                    Text(scenario.name)
                        .font(.headline)
                    Text(scenario.notes)
                        .foregroundStyle(.secondary)
                    HStack {
                        Button("No") { pendingScenario = nil }
                            .buttonStyle(.bordered)
                        Spacer()
                        Button("Next") {
                            model.chooseScenario(scenario)
                            pendingScenario = nil
                            model.navPath.append(AppScreen.tools)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(THMGTheme.accentYellow)
                        .foregroundStyle(.black)
                    }
                }
                .padding()
                .navigationTitle("Scenario")
                .navigationBarTitleDisplayMode(.inline)
            }
            .presentationDetents([.medium])
        }
    }
}

private struct ScenarioCard: View {
    let scenario: Scenario
    let onNext: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(scenario.name)
                    .font(.headline)
                Text(scenario.date, style: .date)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(scenario.notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            Spacer()
            Button("Next", action: onNext)
                .buttonStyle(.bordered)
        }
        .padding(14)
        .background(.white, in: RoundedRectangle(cornerRadius: 16))
    }
}
