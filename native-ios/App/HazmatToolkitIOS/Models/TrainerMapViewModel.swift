import Foundation
import Combine
import CoreLocation
import MapKit

@MainActor
final class TrainerMapViewModel: ObservableObject {
    private struct LoadedReviewData {
        let participants: [SessionTrackingParticipant]
        let zoneEvents: [SessionZoneEvent]
        let points: [TrackingPointWithMetadata]
        let groupedPoints: [String: [TrackingPointWithMetadata]]
        let sortedTraineeIDs: [String]
        let sessionStartTime: Date?
        let sessionEndTime: Date?
        let shapes: [GeoSimShape]
        let samplingDebugSummary: String
    }
    nonisolated private static let maxPointsPerTraineeForReview = 1200

    enum SelectionMode: Hashable {
        case single
        case multi
        case all
    }

    // MARK: - Published State
    @Published var sessionID: UUID?
    @Published var scenarioID: UUID
    @Published var scenarioName: String
    @Published var selectedTraineeIDs: Set<String> = []
    @Published var selectionMode: SelectionMode = .single
    @Published var isPlaying: Bool = false
    @Published var playbackSpeed: Double = 2.0
    @Published var currentTime: TimeInterval = 0
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var samplingDebugSummary: String = ""

    @Published var allParticipants: [SessionTrackingParticipant] = []
    @Published var allPoints: [TrackingPointWithMetadata] = []
    @Published var allZoneEvents: [SessionZoneEvent] = []
    @Published var visibleZones: [GeoSimShape] = []

    // KPI state
    @Published var kpiDwellHigh: TimeInterval = 0
    @Published var kpiDwellNormal: TimeInterval = 0
    @Published var kpiDwellLow: TimeInterval = 0
    @Published var kpiTransitionCount: Int = 0
    @Published var kpiShortHolds: Int = 0

    // Metadata about current session
    var sessionStartTime: Date?
    var sessionEndTime: Date?

    var sessionDuration: TimeInterval {
        guard let start = sessionStartTime, let end = sessionEndTime else { return 0 }
        return end.timeIntervalSince(start)
    }

    var visibleTraineeIDs: Set<String> {
        switch selectionMode {
        case .single:
            return selectedTraineeIDs.count == 1 ? selectedTraineeIDs : Set([allParticipants.first?.traineeName ?? ""].compactMap { $0.isEmpty ? nil : $0 })
        case .multi:
            return selectedTraineeIDs.isEmpty ? Set(allParticipants.map(\.traineeName)) : selectedTraineeIDs
        case .all:
            return Set(allParticipants.map(\.traineeName))
        }
    }

    var visiblePoints: [TrackingPointWithMetadata] {
        allPoints
            .filter { visibleTraineeIDs.contains($0.traineeName) }
            .filter { $0.timestamp <= (sessionStartTime ?? .now).addingTimeInterval(currentTime) }
    }

    var currentMarkers: [TraineeMarkerData] {
        visibleTraineeIDs.compactMap { traineeID in
            guard let point = latestPoint(for: traineeID, at: currentPlaybackDate),
                  let coordinate = interpolatedCoordinate(for: traineeID, at: currentPlaybackDate) else {
                return nil
            }
            return TraineeMarkerData(
                id: traineeID,
                coordinate: coordinate,
                title: traineeID,
                monitorType: point.monitorType,
                samplingLabel: samplingLabel(for: point),
                zone: point.activeZone
            )
        }
    }

    var selectedSamplingStatusText: String {
        guard selectionMode != .all, let selectedID = selectedTraineeIDs.first else {
            return "Sampling: Select one trainee"
        }
        guard let point = latestPoint(for: selectedID, at: currentPlaybackDate) else {
            return "Sampling: No points"
        }
        if let label = samplingLabel(for: point) {
            return "Sampling: \(label)"
        }
        return "Sampling: No sampling data in tracking payload"
    }

    private func samplingLabel(for point: TrackingPointWithMetadata) -> String? {
        let normalized = normalizedSamplingBand(for: point)
        let bandText: String
        switch normalized {
        case "high":
            bandText = "HIGH"
        case "normal":
            bandText = "NORMAL"
        case "low":
            bandText = "LOW"
        default:
            return nil
        }
        if let dwell = point.secondsInCurrentBand {
            return "\(bandText) for \(Self.formatDurationCompact(dwell))"
        }
        return bandText
    }

    func playbackChipBandLabel(for traineeID: String) -> String {
        guard let point = latestPoint(for: traineeID, at: currentPlaybackDate) else { return "N/A" }
        if let payloadLabel = point.samplingBandLabel?.trimmingCharacters(in: .whitespacesAndNewlines),
           !payloadLabel.isEmpty {
            return payloadLabel.uppercased()
        }

        let normalized = normalizedSamplingBand(for: point)
        switch normalized {
        case "high":
            if let dwell = point.secondsInCurrentBand {
                return "HIGH (\(Self.formatDurationCompact(dwell)))"
            }
            return "HIGH"
        case "normal":
            if let dwell = point.secondsInCurrentBand {
                return "NORMAL (\(Self.formatDurationCompact(dwell)))"
            }
            return "NORMAL"
        case "low":
            if let dwell = point.secondsInCurrentBand {
                return "LOW (\(Self.formatDurationCompact(dwell)))"
            }
            return "LOW"
        default:
            return "N/A"
        }
    }

    private func normalizedSamplingBand(for point: TrackingPointWithMetadata) -> String {
        let rawBand = point.samplingBand?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        if ["high", "normal", "low"].contains(rawBand) {
            return rawBand
        }

        let rawLabel = point.samplingBandLabel?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        if rawLabel.contains("high") {
            return "high"
        }
        if rawLabel.contains("normal") {
            return "normal"
        }
        if rawLabel.contains("low") {
            return "low"
        }
        return ""
    }

    private nonisolated static func formatDurationCompact(_ seconds: Double) -> String {
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

    // MARK: - Private
    private var playbackTimer: AnyCancellable?
    private let repository: any HazmatRepository
    private var pointsByTrainee: [String: [TrackingPointWithMetadata]] = [:]
    private var sortedTraineeIDs: [String] = []
    private var currentPlaybackDate: Date {
        (sessionStartTime ?? .now).addingTimeInterval(currentTime)
    }

    // MARK: - Init
    init(sessionID: UUID?, scenarioID: UUID, scenarioName: String, repository: any HazmatRepository) {
        self.sessionID = sessionID
        self.scenarioID = scenarioID
        self.scenarioName = scenarioName
        self.repository = repository
    }

    // MARK: - Public Methods
    func loadSessionData() async {
        isLoading = true
        errorMessage = nil

        do {
            let repository = self.repository
            let sessionID = self.sessionID
            let scenarioID = self.scenarioID
            let scenarioName = self.scenarioName

            let loaded = try await Task.detached(priority: .userInitiated) {
                let shapes = (try? await repository.fetchShapes(for: scenarioID)) ?? []

                if let sessionID {
                    let review = try await repository.fetchTrackingReview(for: sessionID)
                    let participants = review.participants
                    let zoneEvents = review.zoneEvents
                    var points = review.points.map { pt in
                        TrackingPointWithMetadata(
                            id: pt.id,
                            traineeName: pt.traineeID,
                            latitude: pt.latitude,
                            longitude: pt.longitude,
                            timestamp: pt.createdAt,
                            monitorType: participants.first(where: { $0.traineeName == pt.traineeID })?.deviceType,
                            samplingBand: pt.samplingBand,
                            samplingBandLabel: pt.samplingBandLabel,
                            secondsInCurrentBand: pt.secondsInCurrentBand,
                            activeZone: nil
                        )
                    }
                    let reviewSamplingCount = points.filter {
                        ($0.samplingBand?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false) ||
                        ($0.samplingBandLabel?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
                    }.count

                    let scenarioPoints = try await repository.fetchTrackingPoints(for: scenarioName)
                    let scenarioSamplingCount = scenarioPoints.filter {
                        ($0.samplingBand?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false) ||
                        ($0.samplingBandLabel?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
                    }.count

                    points = Self.backfilledSampling(points: points, withScenarioPoints: scenarioPoints)

                    let mergedSamplingCount = points.filter {
                        ($0.samplingBand?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false) ||
                        ($0.samplingBandLabel?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
                    }.count

                    let grouped = Dictionary(grouping: points, by: \.traineeName)
                        .mapValues { $0.sorted(by: { $0.timestamp < $1.timestamp }) }

                    return LoadedReviewData(
                        participants: participants,
                        zoneEvents: zoneEvents,
                        points: points,
                        groupedPoints: grouped,
                        sortedTraineeIDs: grouped.keys.sorted(),
                        sessionStartTime: participants.map(\.joinedAt).min(),
                        sessionEndTime: participants.compactMap(\.lastSeenAt).max(),
                        shapes: shapes,
                        samplingDebugSummary: "review=\(reviewSamplingCount)/\(review.points.count), scenario=\(scenarioSamplingCount)/\(scenarioPoints.count), merged=\(mergedSamplingCount)/\(points.count)"
                    )
                } else {
                    let scenarioPoints = try await repository.fetchTrackingPoints(for: scenarioName)
                    let trimmedScenarioPoints = Self.trimmedPointsForReview(
                        scenarioPoints,
                        maxPointsPerTrainee: Self.maxPointsPerTraineeForReview
                    )
                    let participants = Self.makeParticipantsFromPoints(trimmedScenarioPoints)
                    let points = trimmedScenarioPoints.map {
                        TrackingPointWithMetadata(
                            id: $0.id,
                            traineeName: $0.traineeID,
                            latitude: $0.latitude,
                            longitude: $0.longitude,
                            timestamp: $0.createdAt,
                            monitorType: $0.detectionDevice,
                            samplingBand: $0.samplingBand,
                            samplingBandLabel: $0.samplingBandLabel,
                            secondsInCurrentBand: $0.secondsInCurrentBand,
                            activeZone: nil
                        )
                    }
                    let grouped = Dictionary(grouping: points, by: \.traineeName)
                        .mapValues { $0.sorted(by: { $0.timestamp < $1.timestamp }) }

                    let scenarioSamplingCount = trimmedScenarioPoints.filter {
                        ($0.samplingBand?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false) ||
                        ($0.samplingBandLabel?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
                    }.count

                    return LoadedReviewData(
                        participants: participants,
                        zoneEvents: [],
                        points: points,
                        groupedPoints: grouped,
                        sortedTraineeIDs: grouped.keys.sorted(),
                        sessionStartTime: trimmedScenarioPoints.map(\.createdAt).min(),
                        sessionEndTime: trimmedScenarioPoints.map(\.createdAt).max(),
                        shapes: shapes,
                        samplingDebugSummary: "scenario-only=\(scenarioSamplingCount)/\(trimmedScenarioPoints.count)"
                    )
                }
            }.value

            self.allParticipants = loaded.participants
            self.allZoneEvents = loaded.zoneEvents
            self.sessionStartTime = loaded.sessionStartTime
            self.sessionEndTime = loaded.sessionEndTime
            self.allPoints = loaded.points
            self.pointsByTrainee = loaded.groupedPoints
            self.sortedTraineeIDs = loaded.sortedTraineeIDs
            self.visibleZones = loaded.shapes
            self.samplingDebugSummary = loaded.samplingDebugSummary
            self.currentTime = 0
            self.updateKPIs()
            if selectedTraineeIDs.isEmpty, let first = allParticipants.first?.traineeName {
                selectedTraineeIDs = [first]
            }
            self.isLoading = false
        } catch {
            self.errorMessage = "Failed to load session data: \(error.localizedDescription)"
            self.isLoading = false
        }
    }

    func toggleTraineeSelection(_ traineeID: String) {
        switch selectionMode {
        case .single:
            selectedTraineeIDs = [traineeID]
            seekToFirstPoint(for: traineeID)
        case .multi:
            if selectedTraineeIDs.contains(traineeID) {
                selectedTraineeIDs.remove(traineeID)
                if selectedTraineeIDs.isEmpty {
                    selectedTraineeIDs.insert(traineeID)
                }
            } else {
                selectedTraineeIDs.insert(traineeID)
            }
        case .all:
            // All mode doesn't allow individual selection
            break
        }
        updateKPIs()
    }

    func setSelectionMode(_ mode: SelectionMode) {
        selectionMode = mode
        switch mode {
        case .single:
            if selectedTraineeIDs.isEmpty, let first = allParticipants.first?.traineeName {
                selectedTraineeIDs = [first]
            } else if selectedTraineeIDs.count > 1 {
                selectedTraineeIDs = Set([selectedTraineeIDs.first ?? ""])
            }
        case .multi:
            if selectedTraineeIDs.isEmpty {
                selectedTraineeIDs = Set(allParticipants.map(\.traineeName))
            }
        case .all:
            selectedTraineeIDs = Set(allParticipants.map(\.traineeName))
        }
        updateKPIs()
    }

    func play() {
        if currentTime >= sessionDuration {
            currentTime = 0
        }
        isPlaying = true
        startPlayback()
    }

    func pause() {
        isPlaying = false
        playbackTimer?.cancel()
    }

    func seek(to time: TimeInterval) {
        currentTime = min(max(0, time), sessionDuration)
    }

    func setPlaybackSpeed(_ speed: Double) {
        playbackSpeed = speed
    }

    // MARK: - Private Methods
    private func startPlayback() {
        playbackTimer = Timer
            .publish(every: 0.1, on: .main, in: .default)
            .autoconnect()
            .sink { [weak self] _ in
                self?.updatePlayback()
            }
    }

    private func updatePlayback() {
        guard isPlaying else { return }
        let deltaTime = (0.016 * playbackSpeed)
        let newTime = currentTime + deltaTime
        
        if newTime >= sessionDuration {
            currentTime = sessionDuration
            isPlaying = false
            playbackTimer?.cancel()
        } else {
            currentTime = newTime
        }
    }

    private func updateKPIs() {
        let visible = visiblePoints.filter { visibleTraineeIDs.contains($0.traineeName) }
        _ = visible

        // Reset
        kpiDwellHigh = 0
        kpiDwellNormal = 0
        kpiDwellLow = 0
        kpiTransitionCount = 0
        kpiShortHolds = 0

        // Count zone transitions per visible trainee
        for traineeID in visibleTraineeIDs {
            let events = allZoneEvents.filter { $0.traineeName == traineeID }
            kpiTransitionCount += events.count
            
            for event in events {
                // Infer sampling band from zone event (or derive from points in that zone)
                // For now, distribute dwell based on event duration
                // TODO: get actual samplingBand from backend when available
                let duration = event.durationSeconds
                if duration > 30 {
                    kpiDwellHigh += duration
                } else if duration > 10 {
                    kpiDwellNormal += duration
                } else if duration > 0 {
                    kpiDwellLow += duration
                }
            }
        }

        // Count short holds (zone entry/exit < 5s apart)
        let visibleEvents = allZoneEvents.filter { visibleTraineeIDs.contains($0.traineeName) }
        var lastExitTime: Date?
        for event in visibleEvents.sorted(by: { $0.enteredAt < $1.enteredAt }) {
            if let lastExit = lastExitTime {
                let gap = event.enteredAt.timeIntervalSince(lastExit)
                if gap < 5 {
                    kpiShortHolds += 1
                }
            }
            lastExitTime = event.exitedAt
        }
    }

    private func latestPoint(for traineeID: String, at timestamp: Date) -> TrackingPointWithMetadata? {
        guard let points = pointsByTrainee[traineeID], !points.isEmpty else { return nil }
        var low = 0
        var high = points.count - 1
        var result: TrackingPointWithMetadata?
        while low <= high {
            let mid = (low + high) / 2
            let midPoint = points[mid]
            if midPoint.timestamp <= timestamp {
                result = midPoint
                low = mid + 1
            } else {
                high = mid - 1
            }
        }

        // If playback time is before this trainee's first sample, show the first sample
        // so participant selection never appears blank.
        return result ?? points.first
    }

    private func interpolatedCoordinate(for traineeID: String, at timestamp: Date) -> CLLocationCoordinate2D? {
        guard let points = pointsByTrainee[traineeID], !points.isEmpty else { return nil }
        if points.count == 1 {
            return CLLocationCoordinate2D(latitude: points[0].latitude, longitude: points[0].longitude)
        }

        if let first = points.first, timestamp <= first.timestamp {
            return CLLocationCoordinate2D(latitude: first.latitude, longitude: first.longitude)
        }
        if let last = points.last, timestamp >= last.timestamp {
            return CLLocationCoordinate2D(latitude: last.latitude, longitude: last.longitude)
        }

        var low = 0
        var high = points.count - 1
        while low <= high {
            let mid = (low + high) / 2
            let midTime = points[mid].timestamp
            if midTime < timestamp {
                low = mid + 1
            } else if midTime > timestamp {
                high = mid - 1
            } else {
                let exact = points[mid]
                return CLLocationCoordinate2D(latitude: exact.latitude, longitude: exact.longitude)
            }
        }

        let upperIndex = min(max(low, 1), points.count - 1)
        let lowerIndex = upperIndex - 1
        let lower = points[lowerIndex]
        let upper = points[upperIndex]

        let total = upper.timestamp.timeIntervalSince(lower.timestamp)
        guard total > 0 else {
            return CLLocationCoordinate2D(latitude: lower.latitude, longitude: lower.longitude)
        }

        let elapsed = timestamp.timeIntervalSince(lower.timestamp)
        let t = min(max(elapsed / total, 0), 1)
        let lat = lower.latitude + (upper.latitude - lower.latitude) * t
        let lon = lower.longitude + (upper.longitude - lower.longitude) * t
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    private func seekToFirstPoint(for traineeID: String) {
        guard let firstPoint = pointsByTrainee[traineeID]?.first,
              let sessionStartTime else { return }
        let offset = max(0, firstPoint.timestamp.timeIntervalSince(sessionStartTime))
        seek(to: offset)
    }

    private nonisolated static func makeParticipantsFromPoints(_ points: [GeoTrackingPoint]) -> [SessionTrackingParticipant] {
        let grouped = Dictionary(grouping: points, by: \.traineeID)
        return grouped.keys.sorted().map { traineeID in
            let traineePoints = grouped[traineeID] ?? []
            let joinedAt = traineePoints.map(\.createdAt).min() ?? .now
            let lastSeenAt = traineePoints.map(\.createdAt).max()
            let latest = traineePoints.max(by: { $0.createdAt < $1.createdAt })
            return SessionTrackingParticipant(
                id: UUID(),
                traineeName: traineeID,
                deviceType: latest?.detectionDevice,
                joinedAt: joinedAt,
                lastSeenAt: lastSeenAt,
                latestPoint: latest.map {
                    SessionTrackingParticipant.LatestPoint(
                        recordedAt: $0.createdAt,
                        receivedAt: nil,
                        latitude: $0.latitude,
                        longitude: $0.longitude,
                        accuracyM: nil,
                        isBackfilled: false
                    )
                }
            )
        }
    }

    private nonisolated static func trimmedPointsForReview(
        _ points: [GeoTrackingPoint],
        maxPointsPerTrainee: Int
    ) -> [GeoTrackingPoint] {
        guard maxPointsPerTrainee > 0 else { return [] }
        let grouped = Dictionary(grouping: points, by: \.traineeID)
        return grouped.values.flatMap { traineePoints in
            let sorted = traineePoints.sorted(by: { $0.createdAt < $1.createdAt })
            if sorted.count <= maxPointsPerTrainee { return sorted }
            return Array(sorted.suffix(maxPointsPerTrainee))
        }
        .sorted(by: { $0.createdAt < $1.createdAt })
    }

    private nonisolated static func backfilledSampling(
        points: [TrackingPointWithMetadata],
        withScenarioPoints scenarioPoints: [GeoTrackingPoint]
    ) -> [TrackingPointWithMetadata] {
        let scenarioByTrainee = Dictionary(grouping: scenarioPoints, by: \.traineeID)
            .mapValues { $0.sorted(by: { $0.createdAt < $1.createdAt }) }
        let scenarioByNormalizedTrainee = Dictionary(grouping: scenarioPoints, by: {
            normalizedIdentifier($0.traineeID)
        })
        .mapValues { $0.sorted(by: { $0.createdAt < $1.createdAt }) }
        let sortedScenarioPoints = scenarioPoints.sorted(by: { $0.createdAt < $1.createdAt })

        return points.map { point in
            let hasSampling = (point.samplingBand?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false) ||
                (point.samplingBandLabel?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
            guard !hasSampling else {
                return point
            }

            let directCandidates = scenarioByTrainee[point.traineeName]
            let normalizedCandidates = scenarioByNormalizedTrainee[normalizedIdentifier(point.traineeName)]
            let candidates = directCandidates ?? normalizedCandidates

            let nearest: GeoTrackingPoint? = {
                if let candidates, let nearest = nearestScenarioPoint(to: point.timestamp, in: candidates) {
                    return nearest
                }
                guard let nearestAny = nearestScenarioPoint(to: point.timestamp, in: sortedScenarioPoints) else {
                    return nil
                }
                // Avoid accidental cross-trainee backfill if timestamps are far apart.
                let gap = abs(nearestAny.createdAt.timeIntervalSince(point.timestamp))
                return gap <= 20 ? nearestAny : nil
            }()

            guard let nearest else { return point }

            return TrackingPointWithMetadata(
                id: point.id,
                traineeName: point.traineeName,
                latitude: point.latitude,
                longitude: point.longitude,
                timestamp: point.timestamp,
                monitorType: point.monitorType,
                samplingBand: nearest.samplingBand,
                samplingBandLabel: nearest.samplingBandLabel,
                secondsInCurrentBand: nearest.secondsInCurrentBand,
                activeZone: point.activeZone
            )
        }
    }

    private nonisolated static func nearestScenarioPoint(to timestamp: Date, in points: [GeoTrackingPoint]) -> GeoTrackingPoint? {
        guard !points.isEmpty else { return nil }
        var nearest = points[0]
        var smallestGap = abs(points[0].createdAt.timeIntervalSince(timestamp))
        for point in points.dropFirst() {
            let gap = abs(point.createdAt.timeIntervalSince(timestamp))
            if gap < smallestGap {
                smallestGap = gap
                nearest = point
            }
        }
        return nearest
    }

    private nonisolated static func normalizedIdentifier(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "-", with: "")
            .replacingOccurrences(of: "_", with: "")
            .replacingOccurrences(of: " ", with: "")
    }
}

// MARK: - Supporting Models
struct TrackingPointWithMetadata: Identifiable {
    let id: UUID
    let traineeName: String
    let latitude: Double
    let longitude: Double
    let timestamp: Date
    let monitorType: DetectionDevice?
    let samplingBand: String?
    let samplingBandLabel: String?
    let secondsInCurrentBand: Double?
    let activeZone: String?
}

typealias TrackingPointID = UUID

struct TraineeMarkerData: Identifiable {
    let id: String
    let coordinate: CLLocationCoordinate2D
    let title: String
    let monitorType: DetectionDevice?
    let samplingLabel: String?
    let zone: String?
}
