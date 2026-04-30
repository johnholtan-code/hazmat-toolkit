import SwiftUI
import HazMatDesignSystem
import CoreLocation
import Foundation

struct TrainerMapReviewView: View {
    @ObservedObject var store: AppStore
    let sessionID: UUID?
    let scenarioID: UUID
    let scenarioName: String

    @StateObject private var viewModel: TrainerMapViewModel
    @State private var hasStartedLoading = false

    init(store: AppStore, sessionID: UUID?, scenarioID: UUID, scenarioName: String) {
        self.store = store
        self.sessionID = sessionID
        self.scenarioID = scenarioID
        self.scenarioName = scenarioName
        _viewModel = StateObject(
            wrappedValue: TrainerMapViewModel(
                sessionID: sessionID,
                scenarioID: scenarioID,
                scenarioName: scenarioName,
                repository: store.hazmatRepository
            )
        )
    }

    var body: some View {
        VStack(spacing: 12) {
            Section {
                if #available(iOS 17.0, *) {
                    MapKitPanel(
                        title: "Session Review Map",
                        subtitle: "Current trainee positions for playback.",
                        pins: currentPins,
                        polygons: reviewPolygons,
                        paths: playbackPaths,
                        fallbackCenter: reviewFallbackCenter,
                        preferFallbackCenterWhenAvailable: true,
                        recenterOnPinsChange: false,
                        recenterOnMyLocationChange: false
                    )
                    .frame(height: 460)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                } else {
                    Text("Map review requires iOS 17 or newer.")
                        .foregroundStyle(.secondary)
                }
            }
            .hazmatPanel()

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    statCard(title: "Mode", value: sessionID == nil ? "Scenario history" : "Session review")
                    statCard(title: "Participants", value: "\(viewModel.allParticipants.count)")
                    statCard(title: "Points", value: "\(viewModel.allPoints.count)")
                    statCard(title: "Zone Events", value: "\(viewModel.allZoneEvents.count)")
                }
                .padding(.horizontal, 16)
            }

            if !viewModel.allParticipants.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Participant Playback")
                        .font(.subheadline.weight(.semibold))
                    ScrollView(.horizontal, showsIndicators: true) {
                        HStack(spacing: 8) {
                            let allSelected = viewModel.selectionMode == .all
                            Button {
                                viewModel.setSelectionMode(.all)
                            } label: {
                                Text("All Participants")
                                    .font(.subheadline.weight(.semibold))
                                    .padding(.vertical, 8)
                                    .padding(.horizontal, 12)
                                    .foregroundStyle(allSelected ? .white : .primary)
                                    .background(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .fill(allSelected ? Color.accentColor : Color.secondary.opacity(0.22))
                                    )
                            }
                            .buttonStyle(.plain)

                            ForEach(viewModel.allParticipants, id: \.id) { participant in
                                let isSelected = viewModel.selectionMode != .all && viewModel.visibleTraineeIDs.contains(participant.traineeName)
                                Button {
                                    viewModel.setSelectionMode(.single)
                                    viewModel.toggleTraineeSelection(participant.traineeName)
                                } label: {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(participant.traineeName)
                                            .font(.subheadline.weight(.semibold))
                                        if let device = participant.deviceType {
                                            Text(device.rawValue.replacingOccurrences(of: "_", with: " "))
                                                .font(.caption)
                                        }
                                        Text("Band: \(viewModel.playbackChipBandLabel(for: participant.traineeName))")
                                            .font(.caption2.weight(.semibold))
                                            .opacity(0.95)
                                    }
                                    .padding(.vertical, 8)
                                    .padding(.horizontal, 12)
                                    .foregroundStyle(isSelected ? .white : .primary)
                                    .background(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .fill(isSelected ? Color.accentColor : Color.secondary.opacity(0.22))
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 10)
                .hazmatPanel()
            }

            VStack(spacing: 10) {
                HStack {
                    Button(viewModel.isPlaying ? "Pause" : "Play") {
                        viewModel.isPlaying ? viewModel.pause() : viewModel.play()
                    }
                    .buttonStyle(.borderedProminent)

                    Spacer()

                    Text("\(Int(viewModel.playbackSpeed))x")
                }

                Text(viewModel.selectedSamplingStatusText)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Slider(
                    value: $viewModel.currentTime,
                    in: 0...max(viewModel.sessionDuration, 1)
                )

                HStack {
                    Text("\(Int(viewModel.currentTime))s")
                    Spacer()
                    Text("\(Int(viewModel.sessionDuration))s")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            .padding(16)
            .hazmatPanel()
        }
        .hazmatBackground()
        .navigationTitle("Scenario Review")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard !hasStartedLoading else { return }
            hasStartedLoading = true
            await viewModel.loadSessionData()
        }
        .overlay {
            if viewModel.isLoading {
                ZStack {
                    Color.black.opacity(0.15).ignoresSafeArea()
                    ProgressView("Loading review data...")
                        .padding(16)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
        }
        .alert("Error", isPresented: .constant(viewModel.errorMessage != nil), presenting: viewModel.errorMessage) { _ in
            Button("Dismiss") { viewModel.errorMessage = nil }
        } message: { msg in
            Text(msg)
        }
    }

    private func statCard(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.weight(.semibold))
        }
        .frame(minWidth: 120, alignment: .leading)
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.secondary.opacity(0.14))
        )
    }

    private var currentPins: [MapPinItem] {
        viewModel.currentMarkers.map { marker in
            MapPinItem(
                title: marker.title,
                coordinate: marker.coordinate,
                tint: .red,
                statusText: marker.samplingLabel
            )
        }
    }

    private var playbackPaths: [MapPathItem] {
        let grouped = Dictionary(grouping: viewModel.visiblePoints, by: \.traineeName)
        return grouped.keys.sorted().compactMap { traineeName in
            guard let points = grouped[traineeName], points.count >= 2 else { return nil }
            let sortedPoints = points.sorted(by: { $0.timestamp < $1.timestamp })
            let coordinates = sortedPoints.map {
                CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)
            }

            return MapPathItem(
                title: traineeName,
                coordinates: coordinates,
                strokeColor: pathColor(for: traineeName),
                lineWidth: 3
            )
        }
    }

    private func pathColor(for traineeName: String) -> Color {
        let palette: [Color] = [.red, .blue, .green, .orange, .teal, .pink, .indigo, .mint]
        let index = abs(traineeName.hashValue) % palette.count
        return palette[index]
    }

    private var reviewFallbackCenter: CLLocationCoordinate2D? {
        let points = reviewPolygons.flatMap(\.coordinates)
        guard !points.isEmpty else { return nil }
        let lats = points.map(\.latitude)
        let lons = points.map(\.longitude)
        guard let minLat = lats.min(), let maxLat = lats.max(), let minLon = lons.min(), let maxLon = lons.max() else {
            return nil
        }
        return CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2)
    }

    private var reviewPolygons: [MapPolygonItem] {
        viewModel.visibleZones.compactMap { shape in
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
}
