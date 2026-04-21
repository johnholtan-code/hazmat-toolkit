import SwiftUI

// Local fallbacks for design system types if HazMatDesignSystem isn't linked.
private enum LocalTheme {
    static let accent: Color = .orange
    static let panel: Color = Color(.sRGB, red: 0.12, green: 0.12, blue: 0.14, opacity: 0.85)
    static let panelStroke: Color = Color.white.opacity(0.12)
}

private struct LocalPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Color.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .frame(minHeight: 36)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.blue.opacity(configuration.isPressed ? 0.85 : 1.0))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.white.opacity(0.15), lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

private struct LocalSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Color.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .frame(minHeight: 36)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.white.opacity(configuration.isPressed ? 0.12 : 0.08))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.white.opacity(0.15), lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

private extension View {
    func localHazmatBackground() -> some View {
        background(
            LinearGradient(
                colors: [Color(.sRGB, red: 0.10, green: 0.10, blue: 0.12, opacity: 1), Color.black],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .ignoresSafeArea()
    }

    func localHazmatPanel(cornerRadius: CGFloat = 16) -> some View {
        self
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(LocalTheme.panel)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(LocalTheme.panelStroke, lineWidth: 1)
            )
    }
}

struct ScenarioListView: View {
    @ObservedObject var store: AppStore
    let device: DetectionDevice

    @State private var pendingDelete: Scenario?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header

                if store.scenarios(for: device).isEmpty {
                    if #available(iOS 17.0, *) {
                        ContentUnavailableView(
                            "No scenarios to show",
                            systemImage: "tray",
                            description: Text("Create a new \(device.rawValue) scenario.")
                        )
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 20)
                        .localHazmatPanel()
                    } else {
                        VStack(alignment: .center, spacing: 8) {
                            Image(systemName: "tray")
                                .font(.largeTitle)
                                .foregroundStyle(LocalTheme.accent)
                            Text("No scenarios to show")
                                .font(.headline)
                                .foregroundStyle(.white)
                            Text("Create a new \(device.rawValue) scenario.")
                                .font(.subheadline)
                                .foregroundStyle(.white.opacity(0.7))
                        }
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 24)
                        .localHazmatPanel()
                    }
                } else {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(store.scenarios(for: device)) { scenario in
                            VStack(alignment: .leading, spacing: 10) {
                                HStack(alignment: .firstTextBaseline, spacing: 10) {
                                    Text(scenario.scenarioName)
                                        .font(.title3.weight(.bold))
                                        .foregroundStyle(.white)
                                        .lineLimit(2)
                                    Spacer(minLength: 8)
                                    Text(scenario.scenarioDate.formatted(date: .abbreviated, time: .omitted))
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(LocalTheme.accent)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(
                                            Capsule(style: .continuous)
                                                .fill(LocalTheme.accent.opacity(0.14))
                                        )
                                }

                                Text("Running on: \(scenario.scenarioDate.formatted(date: .abbreviated, time: .omitted))")
                                    .font(.subheadline)
                                    .foregroundStyle(.white.opacity(0.72))

                                Text("Created on: \(scenario.createdAt.formatted(date: .abbreviated, time: .omitted))")
                                    .font(.subheadline)
                                    .foregroundStyle(.white.opacity(0.6))

                                HStack(spacing: 10) {
                                    Button("Watch") { store.openWatch(for: scenario) }
                                        .buttonStyle(LocalPrimaryButtonStyle())
                                    Button("Edit") { store.openEditor(for: scenario) }
                                        .buttonStyle(LocalSecondaryButtonStyle())
                                    Button("Remove", role: .destructive) { pendingDelete = scenario }
                                        .buttonStyle(.bordered)
                                }
                            }
                            .localHazmatPanel()
                            .overlay(alignment: .topLeading) {
                                RoundedRectangle(cornerRadius: 3, style: .continuous)
                                    .fill(LocalTheme.accent)
                                    .frame(width: 46, height: 4)
                                    .padding(.top, 8)
                                    .padding(.leading, 10)
                            }
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .localHazmatBackground()
        .navigationTitle(device.rawValue)
        .navigationBarTitleDisplayMode(.inline)
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

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Hazmat ToolK.I.T.")
                .font(.headline.weight(.semibold))
                .foregroundStyle(.white.opacity(0.9))
                .frame(maxWidth: .infinity, alignment: .center)

            VStack(alignment: .center, spacing: 12) {
                Text(device.rawValue)
                    .font(.system(size: 34, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)

                Text("The HazMat Guys Trainer")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(LocalTheme.accent)

                createButton
            }
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.top, 28)

            controlsRow
        }
        .padding(.top, 68)
        .localHazmatPanel()
    }

    private var createButton: some View {
        Button {
            store.openCreateScenario(for: device)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "plus")
                    .font(.body.weight(.bold))
                Text("New Scenario")
                    .font(.subheadline.weight(.bold))
            }
        }
        .buttonStyle(LocalPrimaryButtonStyle())
    }

    private var controlsRow: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Sorted by newest created")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.white)
                    Text(store.scenarioCreatedFilterSummary())
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.68))
                }

                Spacer()

                Menu {
                    Section("Created On") {
                        ForEach(AppStore.ScenarioCreatedFilter.allCases, id: \.self) { filter in
                            Button {
                                store.scenarioCreatedFilter = filter
                            } label: {
                                if store.scenarioCreatedFilter == filter {
                                    Label(filter.label, systemImage: "checkmark")
                                } else {
                                    Text(filter.label)
                                }
                            }
                        }
                    }
                } label: {
                    Label("Sort & Filter", systemImage: "line.3.horizontal.decrease.circle")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(
                            Capsule(style: .continuous)
                                .fill(Color.white.opacity(0.08))
                        )
                        .overlay(
                            Capsule(style: .continuous)
                                .stroke(Color.white.opacity(0.12), lineWidth: 1)
                        )
                }
            }

            if store.scenarioCreatedFilter == .customDate {
                DatePicker(
                    "Created on",
                    selection: $store.scenarioCreatedFilterDate,
                    displayedComponents: .date
                )
                .datePickerStyle(.compact)
                .labelsHidden()
                .tint(LocalTheme.accent)
            }
        }
    }
}
