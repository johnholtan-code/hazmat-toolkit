import SwiftUI
import HazMatDesignSystem
import CoreLocation
import UIKit
import CoreImage.CIFilterBuiltins

struct WatchScenarioView: View {
    @ObservedObject var store: AppStore
    let scenarioID: UUID
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    @State private var selectedTraineeID: String?
    @State private var showAllPoints = true
    @State private var autoRefresh = false

    private var scenario: Scenario? { store.scenario(by: scenarioID) }

    private var allPoints: [GeoTrackingPoint] {
        guard let scenario else { return [] }
        return store.trackingByScenarioName[scenario.scenarioName] ?? []
    }

    private var shapes: [GeoSimShape] {
        store.shapesByScenarioID[scenarioID] ?? []
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

                    Section {
                        if #available(iOS 17.0, *) {
                            MapKitPanel(
                                title: "WatchScenario Live Map",
                                subtitle: "Native MapKit map showing trainer-defined zones and tracking points filtered by scenario/trainee.",
                                pins: trackingPins,
                                polygons: watchPolygons,
                                fallbackCenter: scenarioFallbackCoordinate(scenario),
                                preferFallbackCenterWhenAvailable: true,
                                recenterOnPinsChange: false,
                                recenterOnMyLocationChange: false
                            )
                            .frame(height: 780)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .hazmatPanel()
                        } else {
                            Text("Map view requires iOS 17 or newer.")
                                .foregroundStyle(.secondary)
                        }
                    }

                    Section {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 16) {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text("Show all points")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Toggle("", isOn: $showAllPoints)
                                        .labelsHidden()
                                }

                                VStack(alignment: .leading, spacing: 6) {
                                    Text("Trainee")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Picker("Trainee", selection: Binding(
                                        get: { selectedTraineeID ?? traineeIDs.first ?? "" },
                                        set: { selectedTraineeID = $0 }
                                    )) {
                                        if traineeIDs.isEmpty {
                                            Text("None").tag("")
                                        } else {
                                            ForEach(traineeIDs, id: \.self) { trainee in
                                                Text(trainee).tag(trainee)
                                            }
                                        }
                                    }
                                    .pickerStyle(.menu)
                                    .disabled(showAllPoints || traineeIDs.isEmpty)
                                    .frame(minWidth: 180, alignment: .leading)
                                }

                                VStack(alignment: .leading, spacing: 6) {
                                    Text("Auto Refresh")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Toggle("", isOn: $autoRefresh)
                                        .labelsHidden()
                                }

                                VStack(alignment: .leading, spacing: 6) {
                                    Text("Refresh Now")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Button("Refresh Now") {
                                        Task { await store.loadTracking(for: scenario.scenarioName) }
                                    }
                                    .buttonStyle(.bordered)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    .hazmatPanel()

                    Section("Session Controls") {
                        let sessionState = store.sessionState(for: scenarioID)
                        let isBusy = store.isSessionActionInProgress(for: scenarioID)

                        VStack(alignment: .leading, spacing: 10) {
                            if let sessionState {
                                if horizontalSizeClass == .compact {
                                    sessionControlsInfo(for: sessionState)
                                    sessionControlsButtons(for: sessionState, isBusy: isBusy)
                                } else {
                                    HStack(alignment: .top, spacing: 20) {
                                        sessionControlsInfo(for: sessionState)
                                            .frame(maxWidth: .infinity, alignment: .leading)

                                        sessionControlsButtons(for: sessionState, isBusy: isBusy)
                                            .frame(width: 260, alignment: .topLeading)
                                    }
                                }
                            } else {
                                Text("No session created yet.")
                                    .foregroundStyle(.secondary)
                                Button("Create Session + Join Code") {
                                    Task { await store.createTrainingSession(for: scenarioID) }
                                }
                                .buttonStyle(.borderedProminent)
                                .disabled(isBusy)
                            }

                            if isBusy {
                                ProgressView()
                                    .controlSize(.small)
                            }
                        }
                    }
                    .hazmatPanel()

                    Section("Trainees (\(traineeIDs.count))") {
                        if traineeIDs.isEmpty {
                            Text("No trainees yet")
                                .foregroundStyle(.secondary)
                        }
                        ForEach(traineeIDs, id: \.self) { trainee in
                            Text(trainee)
                                .font(.headline)
                        }
                    }
                }
                .hazmatBackground()
                .navigationTitle("Watch Scenario")
                .navigationBarTitleDisplayMode(.inline)
                .listStyle(.plain)
                .task(id: scenarioID) {
                    await store.loadShapes(for: scenarioID)
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

    private var watchPolygons: [MapPolygonItem] {
        shapes.compactMap { shape in
            guard shape.kind == .polygon,
                  let coordinates = parsePolygonCoordinates(from: shape.shapeGeoJSON),
                  coordinates.count >= 3 else {
                return nil
            }

            let strokeColor = Color(hazmatHex: shape.displayColorHex ?? "") ?? .orange
            return MapPolygonItem(
                id: shape.id,
                title: shape.description,
                coordinates: coordinates,
                strokeColor: strokeColor,
                fillColor: strokeColor.opacity(0.18),
                lineWidth: 2
            )
        }
    }

    private func parsePolygonCoordinates(from geoJSON: String) -> [CLLocationCoordinate2D]? {
        guard let data = geoJSON.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = object["type"] as? String,
              type.caseInsensitiveCompare("Polygon") == .orderedSame,
              let coordinates = object["coordinates"] as? [[[Double]]],
              let firstRing = coordinates.first else {
            return nil
        }

        let points = firstRing.compactMap { pair -> CLLocationCoordinate2D? in
            guard pair.count >= 2 else { return nil }
            return CLLocationCoordinate2D(latitude: pair[1], longitude: pair[0])
        }

        if points.count >= 4,
           let first = points.first,
           let last = points.last,
           first.latitude == last.latitude,
           first.longitude == last.longitude {
            return Array(points.dropLast())
        }

        return points.isEmpty ? nil : points
    }

    private func qrCodeImage(from payload: String) -> UIImage? {
        let data = Data(payload.utf8)
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = data
        filter.correctionLevel = "M"

        guard let output = filter.outputImage else { return nil }
        let transformed = output.transformed(by: CGAffineTransform(scaleX: 8, y: 8))
        guard let cgImage = context.createCGImage(transformed, from: transformed.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }

    @ViewBuilder
    private func sessionControlsInfo(for sessionState: AppStore.ScenarioSessionControlState) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Status: \(sessionState.status.capitalized)")
                .font(.subheadline.weight(.semibold))

            Text("Join Code: \(sessionState.joinCode)")
                .font(.system(.title3, design: .monospaced).weight(.bold))

            Text("Expires: \(sessionState.joinCodeExpiresAt.formatted(date: .omitted, time: .shortened))")
                .font(.caption)
                .foregroundStyle(.secondary)

            if let qrPayload = sessionState.qrPayload {
                if let qrImage = qrCodeImage(from: qrPayload) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Join QR")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Image(uiImage: qrImage)
                            .interpolation(.none)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 160, height: 160)
                            .padding(8)
                            .background(.white, in: RoundedRectangle(cornerRadius: 10))
                    }
                }

                DisclosureGroup("QR Payload (debug)") {
                    Text(qrPayload)
                        .font(.caption.monospaced())
                        .textSelection(.enabled)
                        .foregroundStyle(.secondary)
                }
                .font(.caption)
            }
        }
    }

    @ViewBuilder
    private func sessionControlsButtons(for sessionState: AppStore.ScenarioSessionControlState, isBusy: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Actions")
                .font(.caption)
                .foregroundStyle(.secondary)

            if sessionState.status.lowercased() == "closed" {
                Button("Restart Session") {
                    Task { await store.createTrainingSession(for: scenarioID) }
                }
                .disabled(isBusy)
                .buttonStyle(.borderedProminent)
            } else {
                Button("Rotate Code") {
                    Task { await store.rotateTrainingSessionJoinCode(for: scenarioID) }
                }
                .disabled(isBusy)
                .buttonStyle(.borderedProminent)

                Button("Close Session") {
                    Task { await store.endTrainingSession(for: scenarioID) }
                }
                .disabled(isBusy)
                .buttonStyle(.borderedProminent)
            }
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
