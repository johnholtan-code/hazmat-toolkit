import SwiftUI
import HazMatDesignSystem

struct HomeView: View {
    @ObservedObject var store: AppStore

    var body: some View {
        List {
            Section {
                ForEach(store.filteredTools) { tool in
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(tool.rawValue)
                                .font(.headline)
                            Text(tool.isAvailableInCurrentPowerApp ? "Available for Training Scenarios" : "Coming Soon")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        if tool.isAvailableInCurrentPowerApp {
                            Text("\(store.scenarios(for: tool).count)")
                                .font(.subheadline.monospacedDigit())
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(ThemeColors.accent.opacity(0.25), in: Capsule())
                        }
                    }
                    .contentShape(Rectangle())
                    .onTapGesture {
                        guard tool.isAvailableInCurrentPowerApp else { return }
                        store.openScenarioList(for: tool)
                    }
                    .swipeActions {
                        if tool.isAvailableInCurrentPowerApp {
                            Button("View") {
                                store.openScenarioList(for: tool)
                            }
                            .tint(.gray)
                        }
                    }
                    .opacity(tool.isAvailableInCurrentPowerApp ? 1 : 0.55)
                }
            } header: {
                Text("Detection Tools")
            } footer: {
                Text("Power App parity target: Air Monitor, Radiation Detection, and pH Paper first.")
            }
        }
        .hazmatBackground()
        .navigationTitle("Hazmat ToolK.I.T.")
        .searchable(text: $store.toolSearchText, prompt: "Search tools")
    }
}
