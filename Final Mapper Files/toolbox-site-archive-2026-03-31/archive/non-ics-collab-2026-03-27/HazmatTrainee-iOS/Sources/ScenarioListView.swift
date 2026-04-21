import SwiftUI
import HazMatDesignSystem

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
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
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
                    .padding(.horizontal, 4)

                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(filtered) { scenario in
                            ScenarioCard(scenario: scenario) {
                                pendingScenario = scenario
                            }
                        }

                        if filtered.isEmpty {
                            Text("No downloaded scenario yet. Join a trainer session first.")
                                .foregroundStyle(.white.opacity(0.72))
                                .italic()
                                .frame(maxWidth: .infinity)
                                .hazmatPanel()
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
                        .foregroundStyle(.white)
                    Text(scenario.name)
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text(scenario.notes)
                        .foregroundStyle(.white.opacity(0.72))
                    HStack {
                        Button("No") { pendingScenario = nil }
                            .buttonStyle(SecondaryButtonStyle())
                        Spacer()
                        Button("Next") {
                            model.chooseScenario(scenario)
                            pendingScenario = nil
                            model.navPath.append(AppScreen.tools)
                        }
                        .buttonStyle(PrimaryButtonStyle())
                    }
                }
                .padding()
                .hazmatBackground()
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
                    .foregroundStyle(.white)
                Text(scenario.date, style: .date)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.72))
                Text(scenario.notes)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.72))
                    .lineLimit(2)
            }
            Spacer()
            Button("Next", action: onNext)
                .buttonStyle(PrimaryButtonStyle())
        }
        .hazmatPanel()
    }
}
