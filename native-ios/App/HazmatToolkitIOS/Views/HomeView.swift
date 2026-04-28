import SwiftUI
import HazMatDesignSystem

struct HomeView: View {
    @ObservedObject var store: AppStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if store.supportsTrainerAccounts && store.isTrainerSignedIn {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Signed in")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                            Text(store.currentTrainerEmail)
                                .font(.subheadline.monospaced())
                                .foregroundStyle(.primary)
                        }

                        Spacer()

                        Button("Sign Out", role: .destructive) {
                            Task { await store.signOutTrainer() }
                        }
                        .buttonStyle(SecondaryButtonStyle())
                    }
                    .hazmatPanel()
                }

                Text("Detection Tools")
                    .font(.headline)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 4)

                VStack(spacing: 8) {
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
                        .opacity(tool.isAvailableInCurrentPowerApp ? 1 : 0.55)
                        .padding(.vertical, 4)

                        if tool.id != store.filteredTools.last?.id {
                            Divider()
                        }
                    }
                }
                .hazmatPanel()

                Text("Power App parity target: Air Monitor, Radiation Detection, and pH Paper first.")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.72))
                    .padding(.horizontal, 4)
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .hazmatBackground()
        .navigationTitle("Hazmat ToolK.I.T.")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: Binding(get: { store.toolSearchText }, set: { store.toolSearchText = $0 }), prompt: "Search tools")
    }
}
