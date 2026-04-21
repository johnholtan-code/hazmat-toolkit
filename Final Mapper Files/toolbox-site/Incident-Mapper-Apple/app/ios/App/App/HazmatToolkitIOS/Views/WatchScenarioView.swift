import SwiftUI
import HazMatDesignSystem
import CoreLocation

struct WatchScenarioView: View {
    @ObservedObject var store: AppStore
    let scenarioID: UUID

    @State private var selectedTraineeID: String?
    @State private var showAllPoints = true
    @State private var autoRefresh = false

    private var scenario: Scenario? { store.scenario(by: scenarioID) }

    private var allPoints: [GeoTrackingPoint] {
        guard let scenario else { return [] }
        return store.trackingByScenarioName[scenario.scenarioName] ?? []
    }

    private var filteredPoints: [GeoTrackingPoint] {
        guard !showAllPoints, let trainee = selectedTraineeID else { return allPoints }
        return allPoints.filter { $0.traineeID == trainee }
    }

    private var traineeIDs: [String] {
        Array(Set(allPoints.map(\.traineeID))).sorted()
    }

    var body: some View {
        Group {
            if let scenario {
                List {
                    Section("Scenario") {
                        HStack(alignment: .top, spacing: 16) {
                            scenarioDetailCell(
                                title: "Name",
                                value: scenario.scenarioName,
                                alignment: .leading
                            )
                            Divider()
                            scenarioDetailCell(
                                title: "Device",
                                value: scenario.detectionDevice.rawValue,
                                alignment: .center
                            )
                            Divider()
                            scenarioDetailCell(
                                title: "Date",
                                value: scenario.scenarioDate.formatted(date: .abbreviated, time: .omitted),
                                alignment: .trailing
                            )
                        }
                        .padding(.vertical, 4)
                        .hazmatPanel()
                    }

                    Section("Map") {
                        if #available(iOS 17.0, *) {
                            MapKitPanel(
                                title: "WatchScenario Live Map",
                                subtitle: "Native MapKit map showing tracking points filtered by scenario/trainee.",
                                pins: trackingPins,
                                fallbackCenter: scenarioFallbackCoordinate(scenario)
                            )
                            .frame(height: 780)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .hazmatPanel()
                        } else {
                            Text("Map view requires iOS 17 or newer.")
                                .foregroundStyle(.secondary)
                        }
                    }

                    Section("Filters") {
                        Toggle("Show all points", isOn: $showAllPoints)
                        Picker("Trainee", selection: Binding(
                            get: { selectedTraineeID ?? traineeIDs.first ?? "" },
                            set: { selectedTraineeID = $0 }
                        )) {
                            ForEach(traineeIDs, id: \.self) { trainee in
                                Text(trainee).tag(trainee)
                            }
                        }
                        .disabled(showAllPoints || traineeIDs.isEmpty)

                        Toggle("Auto refresh", isOn: $autoRefresh)
                        Button("Refresh Now") {
                            Task { await store.loadTracking(for: scenario.scenarioName) }
                        }
                    }
                    .hazmatPanel()

                    Section("Tracking Points (\(filteredPoints.count))") {
                        if filteredPoints.isEmpty {
                            Text("No tracking points yet")
                                .foregroundStyle(.secondary)
                        }
                        ForEach(filteredPoints.reversed()) { point in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(point.traineeID)
                                    .font(.headline)
                                Text("\(point.latitude, format: .number.precision(.fractionLength(5))), \(point.longitude, format: .number.precision(.fractionLength(5)))")
                                    .font(.subheadline)
                                Text(point.createdAt.formatted(date: .omitted, time: .standard))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .hazmatBackground()
                .navigationTitle("Watch Scenario")
                .task(id: scenarioID) {
                    await store.loadTracking(for: scenario.scenarioName)
                }
                .task(id: autoRefresh) {
                    guard autoRefresh else { return }
                    while autoRefresh {
                        #if swift(>=5.7)
                        if #available(iOS 16.0, *) {
                            try? await Task.sleep(for: .seconds(3))
                        } else {
                            try? await Task.sleep(nanoseconds: 3_000_000_000)
                        }
                        #else
                        try? await Task.sleep(nanoseconds: 3_000_000_000)
                        #endif
                        guard autoRefresh else { break }
                        await store.loadTracking(for: scenario.scenarioName)
                    }
                }
            } else {
                if #available(iOS 17.0, *) {
                    ContentUnavailableView("Scenario not found", systemImage: "exclamationmark.triangle")
                } else {
                    VStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.largeTitle)
                            .foregroundStyle(.secondary)
                        Text("Scenario not found")
                            .font(.headline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                    .hazmatPanel()
                }
            }
        }
    }

    private func scenarioFallbackCoordinate(_ scenario: Scenario) -> CLLocationCoordinate2D? {
        guard let lat = scenario.latitude, let lon = scenario.longitude else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    private var trackingPins: [MapPinItem] {
        filteredPoints.map { point in
            MapPinItem(
                title: point.traineeID,
                coordinate: CLLocationCoordinate2D(latitude: point.latitude, longitude: point.longitude),
                tint: selectedTraineeID == point.traineeID ? .yellow : .red
            )
        }
    }

    @ViewBuilder
    private func scenarioDetailCell(title: String, value: String, alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.weight(.medium))
                .multilineTextAlignment(alignment == .leading ? .leading : alignment == .center ? .center : .trailing)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : alignment == .center ? .center : .trailing)
    }
}

