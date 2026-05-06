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
    @State private var selectedSessionPickerID: UUID?
    @Environment(\.dismiss) private var dismiss

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
        Group {
            if horizontalSizeClass == .compact {
                VStack(spacing: 12) {
                    reviewControlsPanel
                    reviewMapPanel
                }
            } else {
                GeometryReader { proxy in
                    HStack(alignment: .top, spacing: 16) {
                        reviewControlsPanel
                            .frame(width: proxy.size.width * 0.25, alignment: .topLeading)

                        reviewMapPanel
                            .frame(width: proxy.size.width * 0.75, alignment: .topLeading)
                    }
                }
                .frame(height: 820)
            }
        }
        .hazmatBackground()
        .navigationTitle("Scenario Review")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button {
                    dismiss()
                } label: {
                    Label("Back", systemImage: "chevron.left")
                }
            }
        }
        .task {
            guard !hasStartedLoading else { return }
            hasStartedLoading = true
            await viewModel.loadSessionData()
            selectedSessionPickerID = viewModel.selectedSessionID
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
    
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    @ViewBuilder
    private var reviewMapPanel: some View {
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
            .frame(height: 780)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .hazmatPanel()
        } else {
            Text("Map review requires iOS 17 or newer.")
                .foregroundStyle(.secondary)
        }
    }

    private var reviewControlsPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            sessionPickerCard

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    statCard(title: "Mode", value: viewModel.selectedSessionID == nil ? "Choose session" : "Session review")
                    statCard(title: "Participants", value: "\(viewModel.allParticipants.count)")
                    statCard(title: "Points", value: "\(viewModel.allPoints.count)")
                    statCard(title: "Zone Events", value: "\(viewModel.allZoneEvents.count)")
                }
                .padding(.horizontal, 16)
            }
            
            sessionTimeSummaryCard

            if viewModel.selectedSessionID == nil {
                Text("Select a session to load playback data.")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 16)
            } else if !viewModel.allParticipants.isEmpty {
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
            }

            VStack(spacing: 10) {
                playbackControls
            }
            .padding(16)
            .hazmatPanel()
        }
        .hazmatPanel()
    }

    private var sessionPickerCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Session")
                .font(.subheadline.weight(.semibold))
            if viewModel.availableSessions.isEmpty {
                Text("No sessions found for this scenario yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                Picker("Session", selection: Binding(
                    get: { selectedSessionPickerID },
                    set: { newValue in
                        selectedSessionPickerID = newValue
                        viewModel.selectSession(newValue)
                        Task { await viewModel.loadSessionData() }
                    }
                )) {
                    Text("Select a session").tag(Optional<UUID>.none)
                    ForEach(viewModel.availableSessions, id: \.id) { session in
                        Text(sessionTitle(for: session)).tag(Optional(session.id))
                    }
                }
                .pickerStyle(.menu)
            }
        }
        .padding(.horizontal, 16)
    }

    private func sessionTitle(for session: ScenarioSessionSummary) -> String {
        let base = session.sessionName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? session.sessionName!
            : "Session \(session.id.uuidString.prefix(8))"
        let time = clockLabel(for: session.startsAt ?? session.createdAt)
        let status = session.isLive ? "LIVE" : "CLOSED"
        return "\(base) • \(time) • \(status)"
    }

    private var playbackControls: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                Button("Play") { viewModel.play() }
                    .buttonStyle(.borderedProminent)
                    .disabled(viewModel.isPlaying || viewModel.selectedSessionID == nil)
                Button("Pause") { viewModel.pause() }
                    .buttonStyle(.bordered)
                    .disabled(!viewModel.isPlaying)
                Button("Restart") { viewModel.restartPlayback() }
                    .buttonStyle(.bordered)
                    .disabled(viewModel.selectedSessionID == nil)
                Spacer()
                Picker("Speed", selection: $viewModel.playbackSpeed) {
                    Text("1x").tag(1.0)
                    Text("2x").tag(2.0)
                    Text("5x").tag(5.0)
                    Text("10x").tag(10.0)
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 260)
                .disabled(viewModel.selectedSessionID == nil)
            }

            Text(viewModel.selectedSamplingStatusText)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            Slider(value: $viewModel.currentTime, in: 0...max(viewModel.sessionDuration, 1))
                .disabled(viewModel.selectedSessionID == nil)

            HStack {
                Text(durationLabel(viewModel.currentTime))
                Spacer()
                Text(durationLabel(viewModel.sessionDuration))
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            HStack {
                Spacer()
                samplingPostureWidget
                Spacer()
            }
        }
    }

    private var samplingPostureWidget: some View {
        let band = activePlaybackBand
        return HStack(spacing: 8) {
            ZStack {
                Circle().stroke(Color.primary, lineWidth: 2.2).frame(width: 16, height: 16).position(x: 14, y: 6)
                Path { p in p.move(to: CGPoint(x: 14, y: 14)); p.addQuadCurve(to: CGPoint(x: 14, y: 46), control: CGPoint(x: 20, y: 30)) }
                    .stroke(Color.primary, style: StrokeStyle(lineWidth: 3.4, lineCap: .round))
                Path { p in p.move(to: CGPoint(x: 14, y: 24)); p.addLine(to: CGPoint(x: 22, y: 34)) }
                    .stroke(Color.primary, style: StrokeStyle(lineWidth: 3.4, lineCap: .round))
                Path { p in p.move(to: CGPoint(x: 14, y: 26)); p.addLine(to: armEndPoint(for: band)) }
                    .stroke(Color.primary, style: StrokeStyle(lineWidth: 3.4, lineCap: .round))
                Path { p in p.move(to: CGPoint(x: 14, y: 46)); p.addLine(to: CGPoint(x: 8, y: 60)) }
                    .stroke(Color.primary, style: StrokeStyle(lineWidth: 3.4, lineCap: .round))
                Path { p in p.move(to: CGPoint(x: 14, y: 46)); p.addLine(to: CGPoint(x: 22, y: 60)) }
                    .stroke(Color.primary, style: StrokeStyle(lineWidth: 3.4, lineCap: .round))
                RoundedRectangle(cornerRadius: 2).fill(bandColor(for: band)).frame(width: 7, height: 12).position(phonePoint(for: band))
            }
            .scaleEffect(2.0, anchor: .topLeading)
            .frame(width: 74, height: 138, alignment: .topLeading)
            Text(band)
                .font(.caption.weight(.semibold))
                .foregroundStyle(bandColor(for: band))
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(bandColor(for: band).opacity(0.15), in: Capsule())
        }
    }

    private var activePlaybackBand: String {
        guard let traineeID = viewModel.selectedTraineeIDs.first, viewModel.selectionMode != .all else { return "N/A" }
        let raw = viewModel.playbackChipBandLabel(for: traineeID)
        let normalized = raw.uppercased()
        if normalized.contains("HIGH") { return "HIGH" }
        if normalized.contains("LOW") { return "LOW" }
        if normalized.contains("NORMAL") { return "NORMAL" }
        return "N/A"
    }

    private func bandColor(for band: String) -> Color {
        switch band {
        case "HIGH": return .red
        case "NORMAL": return .orange
        case "LOW": return .blue
        default: return .secondary
        }
    }

    private func armEndPoint(for band: String) -> CGPoint {
        switch band {
        case "HIGH": return CGPoint(x: 7, y: 8)
        case "LOW": return CGPoint(x: 7, y: 38)
        default: return CGPoint(x: 7, y: 22)
        }
    }

    private func phonePoint(for band: String) -> CGPoint {
        switch band {
        case "HIGH": return CGPoint(x: 8, y: 7)
        case "LOW": return CGPoint(x: 8, y: 38)
        default: return CGPoint(x: 8, y: 22)
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
                tint: .red
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
    
    private var sessionTimeSummaryCard: some View {
        HStack(spacing: 10) {
            sessionTimePill(
                title: "First Seen",
                value: clockLabel(for: viewModel.sessionStartTime),
                detail: dateLabel(for: viewModel.sessionStartTime)
            )
            sessionTimePill(
                title: "Last Seen",
                value: clockLabel(for: viewModel.sessionEndTime),
                detail: dateLabel(for: viewModel.sessionEndTime)
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
    }

    private func sessionTimePill(title: String, value: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.weight(.bold))
            Text(detail)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.secondary.opacity(0.14))
        )
    }

    private func clockLabel(for date: Date?) -> String {
        guard let date else { return "N/A" }
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return formatter.string(from: date)
    }

    private func dateLabel(for date: Date?) -> String {
        guard let date else { return "No data" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    private func durationLabel(_ seconds: TimeInterval) -> String {
        let rounded = max(0, Int(seconds.rounded()))
        if rounded < 60 {
            return "\(rounded)s"
        }
        let minutes = rounded / 60
        let remainingSeconds = rounded % 60
        if remainingSeconds == 0 {
            return "\(minutes)m"
        }
        return "\(minutes)m \(remainingSeconds)s"
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
