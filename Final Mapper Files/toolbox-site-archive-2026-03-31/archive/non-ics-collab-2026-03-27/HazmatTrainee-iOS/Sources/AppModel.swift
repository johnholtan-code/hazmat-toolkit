import Foundation
import SwiftUI
import CoreLocation
import CoreMotion

enum ExternalAppRoute: String {
    case continueSession
}

enum AppIntentBridge {
    static let pendingRouteKey = "THMGTrainee.PendingExternalRoute"
    static let persistedScenarioKey = "THMGTrainee.PersistedSelectedScenario"
    static let lastJoinCodeKey = "THMGTrainee.LastJoinCode"
    static let lastTraineeNameKey = "THMGTrainee.LastTraineeName"
}

private struct PersistedDownloadedScenario: Codable {
    var source: String
    var scenario: Scenario
}

enum RadiationInstrumentMode: String, CaseIterable, Identifiable {
    case directional = "Directional"
    case omni = "Omni"

    var id: String { rawValue }
}

enum RadiationShieldingMaterial: String, CaseIterable, Identifiable {
    case none = "None"
    case steel = "Steel"
    case concrete = "Concrete"
    case lead = "Lead"

    var id: String { rawValue }
}

enum AirMonitorCalibrationStep: Int, CaseIterable, Identifiable {
    case normal
    case high
    case low

    var id: Int { rawValue }
}

@MainActor
final class AppModel: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var didFinishSplash = false
    @Published var traineeName = ""
    @Published var joinCode = ""
    @Published var isJoiningSession = false
    @Published var isSendingTrackingPing = false
    @Published var backendErrorMessage: String?
    @Published var backendStatusMessage: String?
    @Published var locationTrackingStatusMessage: String?
    @Published var scenarios: [Scenario] = []
    @Published var selectedScenario: Scenario?
    @Published var selectedMonitor: MonitorType?
    @Published var selectedZoneName: String = "OUT"
    @Published var airMonitorDeviceName: String = "My Air Monitor"
    @Published var airMonitorSensors: [TraineeAirMonitorSensorSlot] = []
    @Published var savedAirMonitorProfiles: [TraineeAirMonitorProfile] = []
    @Published var editingAirMonitorProfileID: UUID?

    @Published var gasReadings: GasReadings = .baseline
    @Published var doseRateRph: Double = 0
    @Published var doseAt1mRph: Double = 0.025
    @Published var backgroundRph: Double = 0.000015
    @Published var shielding: Double = 1.0
    @Published var minRadiusM: Double = 0.5
    @Published var deviceHeadingDegrees: Double?
    @Published var radiationInstrumentMode: RadiationInstrumentMode = .directional
    @Published var radiationShieldingMaterial: RadiationShieldingMaterial = .none
    @Published var radiationShieldingThicknessCm: Double = 0
    @Published var radiationResponseBlend: Double = 0.30
    @Published var radiationMaxDisplayRph: Double = 9.999
    @Published var radiationDistanceFromSourceM: Double?

    @Published var phDisplay: Double = 7
    @Published var phTarget: Double = 7
    @Published var isToolRunActive = false
    @Published private(set) var currentSamplingBand: AirMonitorSamplingBand = .normal
    @Published private(set) var isLearningAirMonitorBaseline = false
    @Published private(set) var learnedAirMonitorBaselineTiltRadians: Double?
    @Published private(set) var airMonitorCalibrationStep: AirMonitorCalibrationStep?
    @Published private(set) var airMonitorCalibrationStatusMessage: String?

    @Published var navPath = NavigationPath()

    private let apiClient = DataverseClient()
    private let airMonitorMotionManager = AirMonitorHeightSamplingMotionManager()
    private let locationManager = CLLocationManager()
    private var sessionAccessToken: String?
    private var joinedSessionID: String?
    private var joinedSessionStatus: String?
    private var joinedSessionIsLive: Bool?
    private var joinedSessionCenterLatitude: Double?
    private var joinedSessionCenterLongitude: Double?
    private var joinedSessionGeoShapes: [DataverseClient.JoinedSessionGeoShape] = []
    private var pendingTrackingPoints: [TrackingPointUpload] = []
    private var lastCapturedLocationAt: Date?
    private var trackingUploadLoopTask: Task<Void, Never>?
    private var sessionStateRefreshTask: Task<Void, Never>?
    private let trackingCaptureInterval: TimeInterval = 5
    private let trackingUploadInterval: UInt64 = 15_000_000_000
    private let phTransitionDuration: TimeInterval = 5
    private let airMonitorTiltSmoothingAlpha: Double = 0.22
    private let minimumCalibrationDeltaDegrees: Double = 8
    private var phTransitionStartValue: Double = 7
    private var phTransitionStartAt: Date?
    private var pendingExternalRoute: ExternalAppRoute?
    private var smoothedAirMonitorTiltRadians: Double?
    private var calibratedNormalTiltRadians: Double?
    private var calibratedHighTiltRadians: Double?
    private var calibratedLowTiltRadians: Double?
    private var highBandEnterThresholdDegrees: Double = 18
    private var lowBandEnterThresholdDegrees: Double = 18
    private var highBandExitThresholdDegrees: Double = 10
    private var lowBandExitThresholdDegrees: Double = 10
    private var hasPersistedDownloadedScenario = false

    let phFacts: [Int: String] = [
        0: "Hydrochloric acid - highly corrosive",
        1: "Battery acid - extremely acidic and dangerous",
        2: "Gastric acid - found in the human stomach",
        3: "Vinegar - used in cooking and cleaning",
        4: "Tomato juice - mildly acidic",
        5: "Black coffee - acidic beverage",
        6: "Urine or milk - slightly acidic",
        7: "Pure water - neutral substance",
        8: "Egg whites - slightly alkaline",
        9: "Baking soda - commonly used alkaline",
        10: "Great for cleaning - mild alkali",
        11: "Ammonia solution - strong cleaning agent",
        12: "Soapy water - moderately alkaline",
        13: "Bleach - highly alkaline and corrosive",
        14: "Sodium hydroxide - caustic soda (lye)"
    ]

    override init() {
        super.init()
        airMonitorMotionManager.onTiltAngleUpdate = { [weak self] angle in
            self?.handleAirMonitorTiltAngleUpdate(angle)
        }
        configureLocationManager()
        scenarios = []
        airMonitorSensors = defaultAirMonitorSensors(for: .fourGasPID)
        resetSimulatorDefaults()
        restoreLastJoinCredentialsIfAvailable()
        restorePersistedSelectedScenarioIfAvailable()
        consumePendingExternalRoute()
    }

    func joinScenarioSessionFromBackend() async {
        let trimmedName = traineeName.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedCode = joinCode.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedName.isEmpty else {
            backendErrorMessage = "Enter your name first."
            return
        }
        guard !trimmedCode.isEmpty else {
            backendErrorMessage = "Enter the join code."
            return
        }

        isJoiningSession = true
        defer { isJoiningSession = false }

        do {
            let joined = try await apiClient.joinSession(joinCode: trimmedCode, traineeName: trimmedName)

            scenarios = [joined.scenario]
            selectedScenario = joined.scenario
            sessionAccessToken = joined.accessToken
            joinedSessionID = joined.sessionID
            joinedSessionStatus = joined.sessionStatus
            joinedSessionIsLive = joined.isLive
            joinedSessionCenterLatitude = joined.centerLatitude
            joinedSessionCenterLongitude = joined.centerLongitude
            joinedSessionGeoShapes = joined.geoShapes.sorted { lhs, rhs in
                if lhs.sortOrder != rhs.sortOrder { return lhs.sortOrder < rhs.sortOrder }
                return lhs.description < rhs.description
            }
            persistLastJoinCredentials(name: trimmedName, code: trimmedCode)
            resetSimulatorDefaults()
            chooseScenario(joined.scenario)
            persistDownloadedScenario(joined.scenario)
            hasPersistedDownloadedScenario = true
            backendErrorMessage = nil
            let trainerLabel = joined.trainerName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                ? (joined.trainerName ?? "Trainer")
                : "Trainer"
            backendStatusMessage = "Joined \(trainerLabel)'s training session and loaded snapshot."
            refreshLocationTrackingState()
            startSessionStateRefreshLoopIfNeeded()
            navPath.append(AppScreen.scenarios)
        } catch {
            backendErrorMessage = error.localizedDescription
        }
    }

    func continueSession() async {
        if canAttemptSessionRefresh {
            await joinScenarioSessionFromBackend()
            return
        }

        guard hasDownloadedScenario else {
            backendErrorMessage = "No downloaded session is available yet."
            return
        }
        navPath.append(AppScreen.scenarios)
    }

    func freshJoinSession() async {
        guard canAttemptSessionRefresh else {
            backendErrorMessage = "Enter your name and join code to refresh the live session."
            return
        }
        await joinScenarioSessionFromBackend()
    }

    func clearBackendError() {
        backendErrorMessage = nil
    }

    func clearBackendStatus() {
        backendStatusMessage = nil
    }

    func finishSplash() {
        didFinishSplash = true
        processPendingExternalRouteIfPossible()
    }

    func setToolRunActive(_ isActive: Bool) {
        isToolRunActive = isActive
        refreshAirMonitorMotionState()
    }

    func beginAirMonitorCalibrationIfNeeded() {
        guard isToolRunActive, selectedMonitor?.isAirMonitor == true else { return }
        guard airMonitorCalibrationStep == nil, learnedAirMonitorBaselineTiltRadians == nil else { return }
        airMonitorCalibrationStep = .normal
        isLearningAirMonitorBaseline = true
        airMonitorCalibrationStatusMessage = nil
        currentSamplingBand = .normal
    }

    @discardableResult
    func captureAirMonitorCalibrationStep() -> Bool {
        guard let step = airMonitorCalibrationStep else { return false }
        guard let currentTilt = smoothedAirMonitorTiltRadians else {
            airMonitorCalibrationStatusMessage = "Hold the monitor steady and try again."
            return false
        }

        switch step {
        case .normal:
            calibratedNormalTiltRadians = currentTilt
            airMonitorCalibrationStep = .high
            airMonitorCalibrationStatusMessage = nil
            return true
        case .high:
            guard let normalTilt = calibratedNormalTiltRadians else {
                airMonitorCalibrationStatusMessage = "Capture the normal position first."
                airMonitorCalibrationStep = .normal
                return false
            }

            let deltaDegrees = (currentTilt - normalTilt) * 180 / .pi
            guard deltaDegrees >= minimumCalibrationDeltaDegrees else {
                airMonitorCalibrationStatusMessage = "Raise the monitor higher and capture again."
                return false
            }

            calibratedHighTiltRadians = currentTilt
            airMonitorCalibrationStep = .low
            airMonitorCalibrationStatusMessage = nil
            return true
        case .low:
            guard let normalTilt = calibratedNormalTiltRadians else {
                airMonitorCalibrationStatusMessage = "Capture the normal position first."
                airMonitorCalibrationStep = .normal
                return false
            }

            let deltaDegrees = (currentTilt - normalTilt) * 180 / .pi
            guard deltaDegrees <= -minimumCalibrationDeltaDegrees else {
                airMonitorCalibrationStatusMessage = "Lower the monitor farther and capture again."
                return false
            }

            calibratedLowTiltRadians = currentTilt
            finalizeAirMonitorCalibration()
            return true
        }
    }

    func applyScannedJoinPayload(_ payload: String) {
        let trimmed = payload.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        if let data = trimmed.data(using: .utf8),
           let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let joinCode = object["joinCode"] as? String {
            self.joinCode = joinCode
            backendStatusMessage = "Join code scanned."
            return
        }

        self.joinCode = trimmed
        backendStatusMessage = "Join code scanned."
    }

    var canSendTrackingPing: Bool {
        sessionAccessToken != nil && isSessionActiveForTracking && !isSendingTrackingPing
    }

    var hasDownloadedScenario: Bool {
        hasPersistedDownloadedScenario || sessionAccessToken != nil
    }

    func enqueueExternalRoute(_ route: ExternalAppRoute) {
        pendingExternalRoute = route
        processPendingExternalRouteIfPossible()
    }

    var isGPSDrivenLiveSession: Bool {
        sessionAccessToken != nil && !joinedSessionGeoShapes.isEmpty
    }

    private var isSessionActiveForTracking: Bool {
        let normalized = (joinedSessionStatus ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalized == "ended" || normalized == "cancelled" || normalized == "closed" {
            return false
        }
        return sessionAccessToken != nil
    }

    private func startSessionStateRefreshLoopIfNeeded() {
        guard sessionAccessToken != nil else { return }
        guard sessionStateRefreshTask == nil else { return }
        sessionStateRefreshTask = Task { [weak self] in
            while let self, !Task.isCancelled {
                await self.refreshJoinedSessionStateFromBackend()
                try? await Task.sleep(nanoseconds: 10_000_000_000)
            }
        }
    }

    private func refreshJoinedSessionStateFromBackend() async {
        guard let token = sessionAccessToken else { return }
        do {
            let state = try await apiClient.fetchMySessionState(accessToken: token)
            let oldActive = isSessionActiveForTracking
            joinedSessionStatus = state.status
            joinedSessionIsLive = state.isLive

            if let refreshedScenario = state.scenario {
                applyRefreshedSessionSnapshot(
                    scenario: refreshedScenario,
                    centerLatitude: state.centerLatitude,
                    centerLongitude: state.centerLongitude,
                    geoShapes: state.geoShapes
                )
            }

            let nowActive = isSessionActiveForTracking
            if nowActive != oldActive {
                refreshLocationTrackingState()
                backendStatusMessage = nowActive
                    ? "Training session is active. Breadcrumb tracking running."
                    : "Training session ended. Tracking stopped."
            }
        } catch {
            // Keep previous state if polling fails; avoid noisy user-facing errors.
        }
    }

    private func applyRefreshedSessionSnapshot(
        scenario: Scenario,
        centerLatitude: Double?,
        centerLongitude: Double?,
        geoShapes: [DataverseClient.JoinedSessionGeoShape]
    ) {
        let previousZoneName = selectedZoneName

        selectedScenario = scenario
        joinedSessionCenterLatitude = centerLatitude
        joinedSessionCenterLongitude = centerLongitude
        joinedSessionGeoShapes = geoShapes.sorted { lhs, rhs in
            if lhs.sortOrder != rhs.sortOrder { return lhs.sortOrder < rhs.sortOrder }
            return lhs.description < rhs.description
        }

        if scenario.zones.contains(where: { $0.name == previousZoneName }) {
            selectedZoneName = previousZoneName
        } else {
            selectedZoneName = scenario.zones.first?.name ?? "OUT"
        }

        if let zone = currentZone {
            gasReadings = adjustedGasReadings(for: zone)
            beginPHTransition(to: zone.ph)
        }

        doseAt1mRph = scenario.radiationSource.doseAt1mRph
        backgroundRph = scenario.radiationSource.backgroundRph
        shielding = scenario.radiationSource.shielding

    }

    func sendTestTrackingPing() async {
        guard let token = sessionAccessToken else {
            backendErrorMessage = "Join a session first."
            return
        }
        guard isSessionActiveForTracking else {
            backendErrorMessage = "This training session is closed."
            return
        }

        isSendingTrackingPing = true
        defer { isSendingTrackingPing = false }

        let baseLat = joinedSessionCenterLatitude ?? 29.7604
        let baseLon = joinedSessionCenterLongitude ?? -95.3698
        let jitterLat = baseLat + Double.random(in: -0.00025...0.00025)
        let jitterLon = baseLon + Double.random(in: -0.00025...0.00025)
        let point = TrackingPointUpload(
            clientPointID: UUID(),
            recordedAt: .now,
            lat: jitterLat,
            lon: jitterLon,
            accuracyM: Double.random(in: 3.5...8.5)
        )

        do {
            try await apiClient.uploadTrackingBatch(accessToken: token, points: [point])
            let sessionText = joinedSessionID ?? "current"
            backendStatusMessage = "Tracking ping sent for session \(sessionText)."
            backendErrorMessage = nil
        } catch {
            backendErrorMessage = error.localizedDescription
        }
    }

    private func configureLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = kCLDistanceFilterNone
        if CLLocationManager.headingAvailable() {
            locationManager.headingFilter = 5
        }
        locationTrackingStatusMessage = "Location tracking idle."
    }

    private func startLocationTrackingIfPossible() {
        guard sessionAccessToken != nil else { return }
        let status = locationManager.authorizationStatus
        switch status {
        case .authorizedAlways, .authorizedWhenInUse:
            locationManager.startUpdatingLocation()
            if CLLocationManager.headingAvailable() {
                locationManager.startUpdatingHeading()
            }
            if isSessionActiveForTracking {
                locationTrackingStatusMessage = "Location tracking active (capturing every 5s, uploading every 15s)."
                startTrackingUploadLoopIfNeeded()
            } else {
                locationTrackingStatusMessage = "Training session closed. Location upload disabled."
            }
        case .notDetermined:
            locationTrackingStatusMessage = "Requesting location permission..."
            locationManager.requestWhenInUseAuthorization()
        case .restricted, .denied:
            locationTrackingStatusMessage = "Location permission denied. Tracking upload disabled."
        @unknown default:
            locationTrackingStatusMessage = "Unknown location permission state."
        }
    }

    private func startTrackingUploadLoopIfNeeded() {
        guard isSessionActiveForTracking else { return }
        guard trackingUploadLoopTask == nil else { return }
        trackingUploadLoopTask = Task { [weak self] in
            while let self, !Task.isCancelled {
                try? await Task.sleep(nanoseconds: self.trackingUploadInterval)
                guard !Task.isCancelled else { break }
                await self.flushPendingTrackingPoints()
            }
        }
    }

    private func queueLocationForUpload(_ location: CLLocation) {
        guard sessionAccessToken != nil else { return }
        applyGPSDrivenShapeSelection(using: location)

        guard isSessionActiveForTracking else { return }
        let now = Date()
        if let last = lastCapturedLocationAt, now.timeIntervalSince(last) < trackingCaptureInterval {
            return
        }
        lastCapturedLocationAt = now

        pendingTrackingPoints.append(makeTrackingPointUpload(from: location, recordedAt: now))
    }

    private func makeTrackingPointUpload(from location: CLLocation, recordedAt: Date) -> TrackingPointUpload {
        let activeShape = activeGeoShape(for: location.coordinate)
        return TrackingPointUpload(
                clientPointID: UUID(),
                recordedAt: recordedAt,
                lat: location.coordinate.latitude,
                lon: location.coordinate.longitude,
                accuracyM: location.horizontalAccuracy >= 0 ? location.horizontalAccuracy : nil,
                speedMps: location.speed >= 0 ? location.speed : nil,
                headingDeg: location.course >= 0 ? location.course : nil,
                activeShapeID: activeShape?.id,
                activeShapeSortOrder: activeShape?.sortOrder
            )
    }

    private func applyGPSDrivenShapeSelection(using location: CLLocation) {
        guard !joinedSessionGeoShapes.isEmpty else { return }
        let hit = activeGeoShape(for: location.coordinate)

        if let hit {
            if selectedZoneName != hit.description {
                applyZoneToSimulators(zoneName: hit.description)
            } else {
                // Keep exact configured zone values during a live GPS-driven session.
                applyZoneToSimulators(zoneName: hit.description)
            }
            // Radiation reading is computed below using nearest configured source,
            // so trainees see realistic falloff even outside tiny point hit-zones.
        } else if selectedZoneName != "OUT" {
            applyZoneToSimulators(zoneName: "OUT")
        }

        if let sourceShape = nearestRadiationSourceShape(to: location.coordinate),
           let sourceCoordinate = radiationSourceCoordinate(for: sourceShape) {
            if let configuredDoseRate = sourceShape.doseRate {
                // Interpret trainer-set dose as source strength at 1 meter.
                doseAt1mRph = configuredDoseRate
            } else if let scenarioDose = selectedScenario?.radiationSource.doseAt1mRph {
                doseAt1mRph = scenarioDose
            }
            // Temporary strict mode for troubleshooting: ignore source/background payload and force zero baseline.
            backgroundRph = 0.0
            if let shieldingValue = sourceShape.shielding {
                shielding = shieldingValue
            } else {
                shielding = 1.0
            }

            let sourceLocation = CLLocation(latitude: sourceCoordinate.latitude, longitude: sourceCoordinate.longitude)
            let distance = max(location.distance(from: sourceLocation), minRadiusM)
            radiationDistanceFromSourceM = distance
            let angleFactor = directionalAttenuationFactor(
                detectorCoordinate: location.coordinate,
                sourceCoordinate: sourceCoordinate,
                headingDegrees: deviceHeadingDegrees
            )
            let raw = backgroundRph + (((doseAt1mRph * effectiveRadiationShieldingMultiplier) / (distance * distance)) * angleFactor)
            applyRadiationSample(max(0, raw))
        } else if let fallbackCenter = joinedSessionFallbackCenterCoordinate {
            // Fallback so radiation still varies by distance if scenario has no explicit rad pin fields.
            let sourceLocation = CLLocation(latitude: fallbackCenter.latitude, longitude: fallbackCenter.longitude)
            let distance = max(location.distance(from: sourceLocation), minRadiusM)
            radiationDistanceFromSourceM = distance
            let angleFactor = directionalAttenuationFactor(
                detectorCoordinate: location.coordinate,
                sourceCoordinate: fallbackCenter,
                headingDegrees: deviceHeadingDegrees
            )
            let raw = backgroundRph + (((doseAt1mRph * effectiveRadiationShieldingMultiplier) / (distance * distance)) * angleFactor)
            applyRadiationSample(max(0, raw))
        } else if let configuredDoseRate = hit?.doseRate {
            applyRadiationSample(configuredDoseRate)
            doseAt1mRph = configuredDoseRate
            radiationDistanceFromSourceM = nil
        } else {
            applyRadiationSample(0)
            radiationDistanceFromSourceM = nil
        }

        locationTrackingStatusMessage = "Queued \(pendingTrackingPoints.count) location point(s)."
    }

    private func activeGeoShape(for coordinate: CLLocationCoordinate2D) -> DataverseClient.JoinedSessionGeoShape? {
        let matches = joinedSessionGeoShapes.filter { shape in
            isTrainerZoneShape(shape) && shapeContainsCoordinate(shape, coordinate: coordinate)
        }
        return matches.max { lhs, rhs in lhs.sortOrder < rhs.sortOrder }
    }

    private func nearestRadiationSourceShape(to coordinate: CLLocationCoordinate2D) -> DataverseClient.JoinedSessionGeoShape? {
        let detector = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        let candidates = joinedSessionGeoShapes.filter { radiationSourceCoordinate(for: $0) != nil }
        guard !candidates.isEmpty else { return nil }

        var best: DataverseClient.JoinedSessionGeoShape?
        var bestDistance = Double.greatestFiniteMagnitude

        for shape in candidates {
            guard let source = radiationSourceCoordinate(for: shape) else { continue }
            let distance = detector.distance(from: CLLocation(latitude: source.latitude, longitude: source.longitude))

            if distance + 0.25 < bestDistance {
                best = shape
                bestDistance = distance
                continue
            }

            // If distances are effectively tied, prefer higher sort order (newer trainer edits).
            if abs(distance - bestDistance) <= 0.25 {
                if let currentBest = best, shape.sortOrder > currentBest.sortOrder {
                    best = shape
                } else if best == nil {
                    best = shape
                }
            }
        }

        return best
    }

    private var joinedSessionFallbackCenterCoordinate: CLLocationCoordinate2D? {
        guard let lat = joinedSessionCenterLatitude, let lon = joinedSessionCenterLongitude else {
            return nil
        }
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    private func radiationSourceCoordinate(for shape: DataverseClient.JoinedSessionGeoShape) -> CLLocationCoordinate2D? {
        guard shape.kind.lowercased() == "point" else { return nil }
        if let lat = shape.radiationLatitude, let lon = shape.radiationLongitude {
            return CLLocationCoordinate2D(latitude: lat, longitude: lon)
        }
        if let center = shape.center {
            return CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude)
        }
        return nil
    }

    private func shapeContainsCoordinate(_ shape: DataverseClient.JoinedSessionGeoShape, coordinate: CLLocationCoordinate2D) -> Bool {
        switch shape.kind.lowercased() {
        case "circle":
            guard let center = shape.center, let radiusM = shape.radiusM else { return false }
            let centerLocation = CLLocation(latitude: center.latitude, longitude: center.longitude)
            let pointLocation = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
            return pointLocation.distance(from: centerLocation) <= radiusM
        case "point":
            guard let center = shape.center else { return false }
            let centerLocation = CLLocation(latitude: center.latitude, longitude: center.longitude)
            let pointLocation = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
            let threshold = max(shape.radiusM ?? 3.0, 3.0)
            return pointLocation.distance(from: centerLocation) <= threshold
        case "polygon":
            guard let outerRing = shape.polygonRings.first, outerRing.count >= 3 else { return false }
            if !pointInPolygon(coordinate, ring: outerRing) {
                return false
            }
            if shape.polygonRings.count > 1 {
                for hole in shape.polygonRings.dropFirst() where hole.count >= 3 {
                    if pointInPolygon(coordinate, ring: hole) {
                        return false
                    }
                }
            }
            return true
        default:
            return false
        }
    }

    private func isTrainerZoneShape(_ shape: DataverseClient.JoinedSessionGeoShape) -> Bool {
        shape.oxygen != nil ||
        shape.lel != nil ||
        shape.carbonMonoxide != nil ||
        shape.hydrogenSulfide != nil ||
        shape.pid != nil ||
        shape.pH != nil
    }

    private func pointInPolygon(_ point: CLLocationCoordinate2D, ring: [DataverseClient.JoinedSessionGeoShape.Coordinate]) -> Bool {
        var isInside = false
        var j = ring.count - 1

        for i in ring.indices {
            let xi = ring[i].longitude
            let yi = ring[i].latitude
            let xj = ring[j].longitude
            let yj = ring[j].latitude

            let intersects = ((yi > point.latitude) != (yj > point.latitude)) &&
                (point.longitude < (xj - xi) * (point.latitude - yi) / ((yj - yi) == 0 ? 0.0000001 : (yj - yi)) + xi)

            if intersects {
                isInside.toggle()
            }
            j = i
        }

        return isInside
    }

    private func flushPendingTrackingPoints() async {
        guard isSessionActiveForTracking else { return }
        guard let token = sessionAccessToken else { return }
        guard !pendingTrackingPoints.isEmpty else { return }

        let batch = pendingTrackingPoints
        do {
            try await apiClient.uploadTrackingBatch(accessToken: token, points: batch)
            pendingTrackingPoints.removeFirst(batch.count)
            locationTrackingStatusMessage = "Uploaded \(batch.count) point(s). Queue: \(pendingTrackingPoints.count)."
        } catch {
            backendErrorMessage = error.localizedDescription
            locationTrackingStatusMessage = "Upload failed. Queue retained (\(pendingTrackingPoints.count))."
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            self.refreshLocationTrackingState()
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let latest = locations.last else { return }
        Task { @MainActor [weak self] in
            guard let self else { return }
            self.queueLocationForUpload(latest)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        let heading = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magneticHeading
        guard heading >= 0 else { return }
        Task { @MainActor [weak self] in
            self?.deviceHeadingDegrees = heading
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor [weak self] in
            self?.locationTrackingStatusMessage = "Location error: \(error.localizedDescription)"
        }
    }

    private func refreshLocationTrackingState() {
        guard sessionAccessToken != nil else { return }
        startLocationTrackingIfPossible()
        if isSessionActiveForTracking {
            startTrackingUploadLoopIfNeeded()
        } else {
            locationManager.stopUpdatingLocation()
            if CLLocationManager.headingAvailable() {
                locationManager.stopUpdatingHeading()
            }
            trackingUploadLoopTask?.cancel()
            trackingUploadLoopTask = nil
        }
    }

    func resetSimulatorDefaults() {
        stopAirMonitorSamplingMotion()
        gasReadings = .baseline
        doseRateRph = 0
        doseAt1mRph = 0.025
        backgroundRph = 0.000015
        shielding = 1.0
        minRadiusM = 0.5
        radiationInstrumentMode = .directional
        radiationShieldingMaterial = .none
        radiationShieldingThicknessCm = 0
        radiationResponseBlend = 0.30
        radiationMaxDisplayRph = 9.999
        radiationDistanceFromSourceM = nil
        phDisplay = 7
        phTarget = 7
        phTransitionStartValue = 7
        phTransitionStartAt = nil
        selectedZoneName = "OUT"
    }

    func chooseScenario(_ scenario: Scenario) {
        selectedScenario = scenario
        selectedZoneName = scenario.zones.first?.name ?? "OUT"
        gasReadings = .baseline
        doseAt1mRph = scenario.radiationSource.doseAt1mRph
        backgroundRph = scenario.radiationSource.backgroundRph
        shielding = scenario.radiationSource.shielding
        minRadiusM = 0.5
        applyZoneToSimulators(zoneName: selectedZoneName)
    }

    func chooseMonitor(_ monitor: MonitorType) {
        selectedMonitor = monitor
        refreshAirMonitorMotionState()
    }

    func prepareAirMonitorBuilder(for monitor: MonitorType) {
        selectedMonitor = monitor
        airMonitorDeviceName = monitor == .fourGasPID ? "Custom 4 Gas + PID" : "Custom 4 Gas"
        editingAirMonitorProfileID = nil
        airMonitorSensors = defaultAirMonitorSensors(for: monitor)
        refreshAirMonitorMotionState()
    }

    func beginEditingAirMonitorProfile(_ profile: TraineeAirMonitorProfile) {
        selectedMonitor = profile.baseMonitor
        airMonitorDeviceName = profile.name
        editingAirMonitorProfileID = profile.id
        airMonitorSensors = profile.sensors
        refreshAirMonitorMotionState()
    }

    func defaultAirMonitorSensors(for monitor: MonitorType) -> [TraineeAirMonitorSensorSlot] {
        let items: [TraineeChemicalCatalogItem]
        switch monitor {
        case .fourGas:
            items = TraineeChemicalCatalog.defaultsForFourGas
        case .fourGasPID:
            let voc = TraineeChemicalCatalog.all.first(where: { $0.abbr == "VOC" })
            items = TraineeChemicalCatalog.defaultsForFourGas + (voc.map { [$0] } ?? [])
        default:
            items = TraineeChemicalCatalog.defaultsForFourGas
        }
        return items.map { item in
            TraineeAirMonitorSensorSlot(catalogAbbr: item.abbr, unit: item.units.first ?? "")
        }
    }

    func addAirMonitorSensorSlot() {
        guard airMonitorSensors.count < 6 else { return }
        let used = Set(airMonitorSensors.map(\.catalogAbbr))
        let item = TraineeChemicalCatalog.all.first(where: { !used.contains($0.abbr) })
            ?? TraineeChemicalCatalog.all.first
            ?? TraineeChemicalCatalogItem(name: "Oxygen", abbr: "O2", units: ["%vol"])
        airMonitorSensors.append(
            TraineeAirMonitorSensorSlot(catalogAbbr: item.abbr, unit: item.units.first ?? "")
        )
    }

    func removeAirMonitorSensor(at index: Int) {
        guard airMonitorSensors.indices.contains(index) else { return }
        airMonitorSensors.remove(at: index)
        if airMonitorSensors.isEmpty {
            airMonitorSensors = defaultAirMonitorSensors(for: selectedMonitor ?? .fourGasPID)
        }
    }

    func moveAirMonitorSensorUp(at index: Int) {
        guard airMonitorSensors.indices.contains(index), index > 0 else { return }
        airMonitorSensors.swapAt(index, index - 1)
    }

    func moveAirMonitorSensorDown(at index: Int) {
        guard airMonitorSensors.indices.contains(index), index < airMonitorSensors.count - 1 else { return }
        airMonitorSensors.swapAt(index, index + 1)
    }

    func launchConfiguredAirMonitor() {
        if airMonitorSensors.isEmpty {
            airMonitorSensors = defaultAirMonitorSensors(for: selectedMonitor ?? .fourGasPID)
        }
        navPath.append(AppScreen.gasSimulator)
    }

    func saveCurrentAirMonitorProfile(runAfterSave: Bool = false) {
        let base = (selectedMonitor?.isAirMonitor == true ? selectedMonitor : .fourGasPID) ?? .fourGasPID
        let trimmedName = airMonitorDeviceName.trimmingCharacters(in: .whitespacesAndNewlines)
        let defaultName = base == .fourGasPID ? "Custom 4 Gas + PID" : "Custom 4 Gas"
        let profileName = trimmedName.isEmpty ? defaultName : trimmedName
        let sensors = Array(airMonitorSensors.prefix(6))
        guard !sensors.isEmpty else { return }

        let profile = TraineeAirMonitorProfile(
            id: editingAirMonitorProfileID ?? UUID(),
            name: profileName,
            baseMonitor: base,
            sensors: sensors
        )

        if let idx = savedAirMonitorProfiles.firstIndex(where: { $0.id == profile.id }) {
            savedAirMonitorProfiles[idx] = profile
        } else {
            savedAirMonitorProfiles.insert(profile, at: 0)
        }
        editingAirMonitorProfileID = profile.id
        airMonitorDeviceName = profile.name
        airMonitorSensors = profile.sensors

        if runAfterSave {
            runAirMonitorProfile(profile)
        }
    }

    func deleteAirMonitorProfile(_ profile: TraineeAirMonitorProfile) {
        savedAirMonitorProfiles.removeAll { $0.id == profile.id }
        if editingAirMonitorProfileID == profile.id {
            editingAirMonitorProfileID = nil
        }
    }

    func runAirMonitorProfile(_ profile: TraineeAirMonitorProfile) {
        selectedMonitor = profile.baseMonitor
        airMonitorDeviceName = profile.name
        airMonitorSensors = profile.sensors
        editingAirMonitorProfileID = profile.id
        refreshAirMonitorMotionState()
        navPath.append(AppScreen.gasSimulator)
    }

    func applyZoneToSimulators(zoneName: String) {
        selectedZoneName = zoneName
        guard let zone = currentZone else { return }
        gasReadings = adjustedGasReadings(for: zone)
        beginPHTransition(to: zone.ph)
    }

    var currentZone: ScenarioZone? {
        selectedScenario?.zones.first { $0.name == selectedZoneName } ?? selectedScenario?.zones.first
    }

    var gasAlarms: [String: Bool] {
        [
            "O2": gasReadings.oxygen < 19.5 || gasReadings.oxygen > 23.4,
            "LEL": gasReadings.lel > 10,
            "CO": gasReadings.co > 35,
            "H2S": gasReadings.h2s > 10,
            "VOC": gasReadings.pid > 50
        ]
    }

    var roundedPHFact: String {
        phFacts[Int(phDisplay.rounded())] ?? ""
    }

    func routeForSelectedMonitor() -> AppScreen {
        switch selectedMonitor {
        case .fourGas, .fourGasPID:
            return .gasSimulator
        case .radiation:
            return .radiationSimulator
        case .phPaper:
            return .phSimulator
        default:
            return .gasSimulator
        }
    }

    var currentAirMonitorDisplayName: String {
        let trimmed = airMonitorDeviceName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }
        return selectedMonitor?.rawValue ?? "Air Monitor"
    }

    func airMonitorValueText(for slot: TraineeAirMonitorSensorSlot) -> String {
        switch normalizedAirMonitorAbbreviation(slot.catalogAbbr) {
        case "O2":
            return String(format: "%.1f", gasReadings.oxygen)
        case "LEL":
            return String(format: "%.1f", gasReadings.lel)
        case "CO":
            return String(format: "%.0f", gasReadings.co)
        case "H2S":
            return String(format: "%.1f", gasReadings.h2s)
        case "VOC":
            return String(format: "%.1f", gasReadings.pid)
        default:
            return "---"
        }
    }

    func airMonitorAlarmState(for slot: TraineeAirMonitorSensorSlot) -> AirMonitorAlarmState {
        guard let reading = airMonitorNumericValue(for: slot) else { return .normal }
        let unit = airMonitorUnit(for: slot)
        let abbr = slot.catalogAbbr

        // Primary lookup by exact catalog abbreviation + selected unit.
        if let alarm = AlarmPreset.defaults[abbr]?.byUnit[unit] {
            return evaluateAlarmState(reading: reading, alarm: alarm, abbr: abbr)
        }

        // Fallback to normalized channel (e.g., CH4 / NG/CH4 / C3H8 using LEL thresholds).
        let normalized = normalizedAirMonitorAbbreviation(abbr)
        if let alarm = AlarmPreset.defaults[normalized]?.byUnit[unit] {
            return evaluateAlarmState(reading: reading, alarm: alarm, abbr: normalized)
        }

        // Last-resort fallback keeps current mapped channels working if units are changed oddly.
        switch normalized {
        case "O2":
            if reading < 19.5 { return .low }
            if reading > 23.5 { return .high }
            return .normal
        case "LEL":
            if reading >= 20 { return .high }
            if reading >= 10 { return .low }
            return .normal
        case "CO":
            if reading >= 200 { return .high }
            if reading >= 35 { return .low }
            return .normal
        case "H2S":
            if reading >= 15 { return .high }
            if reading >= 10 { return .low }
            return .normal
        case "VOC":
            if reading >= 100 { return .high }
            if reading >= 50 { return .low }
            return .normal
        default:
            return .normal
        }
    }

    func airMonitorAlarm(for slot: TraineeAirMonitorSensorSlot) -> Bool {
        airMonitorAlarmState(for: slot) != .normal
    }

    var highestAirMonitorAlarmState: AirMonitorAlarmState {
        var highest: AirMonitorAlarmState = .normal
        for slot in airMonitorSensors {
            let state = airMonitorAlarmState(for: slot)
            switch state {
            case .high:
                return .high
            case .low:
                if highest == .normal { highest = .low }
            case .normal:
                continue
            }
        }
        return highest
    }

    func airMonitorTileTitle(for slot: TraineeAirMonitorSensorSlot) -> String {
        let normalized = normalizedAirMonitorAbbreviation(slot.catalogAbbr)
        if normalized == "O2" { return "OXYGEN" }
        return slot.catalogAbbr.uppercased()
    }

    func airMonitorUnit(for slot: TraineeAirMonitorSensorSlot) -> String {
        let trimmed = slot.unit.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }
        return airMonitorCatalogItem(for: slot.catalogAbbr)?.units.first ?? ""
    }

    func airMonitorCatalogItem(for abbr: String) -> TraineeChemicalCatalogItem? {
        TraineeChemicalCatalog.all.first(where: { $0.abbr == abbr })
    }

    private func airMonitorNumericValue(for slot: TraineeAirMonitorSensorSlot) -> Double? {
        switch normalizedAirMonitorAbbreviation(slot.catalogAbbr) {
        case "O2":
            return gasReadings.oxygen
        case "LEL":
            return gasReadings.lel
        case "CO":
            return gasReadings.co
        case "H2S":
            return gasReadings.h2s
        case "VOC":
            return gasReadings.pid
        default:
            return nil
        }
    }

    private func evaluateAlarmState(reading: Double, alarm: AlarmSet, abbr: String) -> AirMonitorAlarmState {
        if let high = alarm.high, reading >= high {
            return .high
        }
        if let low = alarm.low {
            if abbr.uppercased() == "O2" {
                if reading <= low { return .low }
            } else if reading >= low {
                return .low
            }
        }
        return .normal
    }

    private func normalizedAirMonitorAbbreviation(_ abbr: String) -> String {
        switch abbr.uppercased() {
        case "O2":
            return "O2"
        case "LEL", "CH4", "NG/CH4", "C3H8", "C4H10", "H2", "C2H2", "C2H4":
            return "LEL"
        case "CO":
            return "CO"
        case "H2S":
            return "H2S"
        case "VOC":
            return "VOC"
        default:
            return abbr.uppercased()
        }
    }

    func simulateGasDrift() {
        // Trainer-provided sessions should stay on exact configured values.
        // Do not add synthetic drift/noise when replaying a downloaded snapshot.
        guard !isGPSDrivenLiveSession, !hasDownloadedScenario else {
            if let zone = currentZone {
                gasReadings = adjustedGasReadings(for: zone)
            }
            return
        }
        guard let zone = currentZone else { return }
        let target = adjustedGasReadings(for: zone)
        gasReadings.oxygen = drift(from: gasReadings.oxygen, target: target.oxygen, spread: 0.15, clamp: 0...30)
        gasReadings.lel = drift(from: gasReadings.lel, target: target.lel, spread: 1.2, clamp: 0...100)
        gasReadings.co = drift(from: gasReadings.co, target: target.co, spread: 3.0, clamp: 0...500)
        gasReadings.h2s = drift(from: gasReadings.h2s, target: target.h2s, spread: 1.0, clamp: 0...200)
        gasReadings.pid = drift(from: gasReadings.pid, target: target.pid, spread: 6.0, clamp: 0...2000)
    }

    func updateRadiation(distanceMeters: Double, guideBias: Double = 1.0) {
        guard !isGPSDrivenLiveSession else { return }
        let effectiveDistance = max(distanceMeters, minRadiusM)
        let raw = backgroundRph + ((doseAt1mRph * effectiveRadiationShieldingMultiplier * guideBias) / (effectiveDistance * effectiveDistance))
        let noise = raw * Double.random(in: -0.05...0.05) * guideBias
        let sample = max(0, raw + noise)
        applyRadiationSample(sample)
    }

    func updateRadiation(distanceMeters: Double, guideBias: Double = 1.0, pointingOffsetDegrees: Double) {
        let directionalFactor = simulatedDirectionalAttenuationFactor(offsetDegrees: pointingOffsetDegrees)
        updateRadiation(distanceMeters: distanceMeters, guideBias: guideBias * directionalFactor)
    }

    var formattedDoseRateText: String { Self.formatRadiationRateRph(doseRateRph) }
    var formattedBackgroundText: String { Self.formatRadiationRateRph(backgroundRph) }
    var formattedDoseAt1mText: String { Self.formatRadiationRateRph(doseAt1mRph) }
    var isRadiationOverRange: Bool { doseRateRph > radiationMaxDisplayRph }
    var radiationDisplayStatusText: String {
        if isRadiationOverRange { return "OVER RANGE" }
        return formattedDoseRateText
    }
    var formattedRadiationDistanceText: String {
        guard let meters = radiationDistanceFromSourceM else { return "—" }
        let feet = meters * 3.28084
        return "\(Int(meters.rounded())) m (\(Int(feet.rounded())) ft)"
    }
    var radiationEstimatedClicksPerSecond: Double {
        // Simple training response curve: quiet at background, increasingly rapid as dose rises.
        let dose = max(doseRateRph, 0)
        let urPerHour = dose * 1_000_000
        if urPerHour < 25 { return 0.3 }
        if urPerHour < 100 { return 1.0 }
        if urPerHour < 1_000 { return 3.0 }
        if urPerHour < 10_000 { return 8.0 }
        if urPerHour < 100_000 { return 18.0 }
        return 30.0
    }
    var radiationClickIntervalSeconds: Double {
        1.0 / max(radiationEstimatedClicksPerSecond, 0.2)
    }

    func syncPHDisplayTowardTarget() {
        guard let phTransitionStartAt else {
            phDisplay = phTarget
            return
        }
        let elapsed = Date().timeIntervalSince(phTransitionStartAt)
        let progress = min(max(elapsed / phTransitionDuration, 0), 1)
        phDisplay = phTransitionStartValue + ((phTarget - phTransitionStartValue) * progress)

        guard progress < 1 else {
            phDisplay = phTarget
            self.phTransitionStartAt = nil
            return
        }
    }

    private func beginPHTransition(to targetPH: Double) {
        let clampedTarget = min(max(targetPH, 0), 14)

        if abs(phDisplay - clampedTarget) < 0.01 {
            phTarget = clampedTarget
            phDisplay = clampedTarget
            phTransitionStartValue = clampedTarget
            phTransitionStartAt = nil
            return
        }

        phTransitionStartValue = phDisplay
        phTransitionStartAt = Date()
        phTarget = clampedTarget
    }

    private func drift(from current: Double, target: Double, spread: Double, clamp: ClosedRange<Double>) -> Double {
        let noise = Double.random(in: -spread...spread)
        let nudged = current + (target - current) * 0.3 + noise
        return min(max(nudged, clamp.lowerBound), clamp.upperBound)
    }

    private func simulatedDirectionalAttenuationFactor(offsetDegrees: Double) -> Double {
        guard radiationInstrumentMode == .directional else { return 1.0 }
        return directionalAttenuationFromAngularDifference(abs(offsetDegrees))
    }

    private func directionalAttenuationFactor(
        detectorCoordinate: CLLocationCoordinate2D,
        sourceCoordinate: CLLocationCoordinate2D,
        headingDegrees: Double?
    ) -> Double {
        guard radiationInstrumentMode == .directional else { return 1.0 }
        guard let headingDegrees else { return 1.0 }
        let bearing = bearingDegrees(from: detectorCoordinate, to: sourceCoordinate)
        let delta = angularDifferenceDegrees(headingDegrees, bearing)
        return directionalAttenuationFromAngularDifference(delta)
    }

    private var effectiveRadiationShieldingMultiplier: Double {
        shielding * materialAttenuationMultiplier(material: radiationShieldingMaterial, thicknessCm: radiationShieldingThicknessCm)
    }

    private func materialAttenuationMultiplier(material: RadiationShieldingMaterial, thicknessCm: Double) -> Double {
        let t = max(thicknessCm, 0)
        guard t > 0 else { return 1.0 }
        // Training approximation using exponential attenuation coefficients by material.
        let muPerCm: Double
        switch material {
        case .none: muPerCm = 0
        case .steel: muPerCm = 0.12
        case .concrete: muPerCm = 0.08
        case .lead: muPerCm = 0.45
        }
        guard muPerCm > 0 else { return 1.0 }
        return exp(-muPerCm * t)
    }

    private func applyRadiationSample(_ sample: Double) {
        let clamped = max(sample, 0)
        let alpha = min(max(radiationResponseBlend, 0.05), 1.0)
        doseRateRph = (doseRateRph == 0) ? clamped : (doseRateRph * (1 - alpha) + clamped * alpha)
    }

    private func directionalAttenuationFromAngularDifference(_ deltaDegrees: Double) -> Double {
        // Directional search behavior: strongest response when pointed at source,
        // rapidly attenuated when pointed away.
        let radians = deltaDegrees * .pi / 180
        let forwardLobe = max(cos(radians), 0)
        let shaped = pow(forwardLobe, 2.2)
        return max(0.03, shaped)
    }

    private func bearingDegrees(from a: CLLocationCoordinate2D, to b: CLLocationCoordinate2D) -> Double {
        let lat1 = a.latitude * .pi / 180
        let lat2 = b.latitude * .pi / 180
        let dLon = (b.longitude - a.longitude) * .pi / 180
        let y = sin(dLon) * cos(lat2)
        let x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLon)
        let bearing = atan2(y, x) * 180 / .pi
        return bearing < 0 ? (bearing + 360) : bearing
    }

    private func angularDifferenceDegrees(_ a: Double, _ b: Double) -> Double {
        let raw = abs(a - b).truncatingRemainder(dividingBy: 360)
        return raw > 180 ? (360 - raw) : raw
    }

    private static func formatRadiationRateRph(_ doseRph: Double) -> String {
        let dose = max(doseRph, 0)
        if dose < 0.001 {
            return String(format: "%.1f uR/hr", dose * 1_000_000)
        }
        if dose < 1 {
            return String(format: "%.1f mR/hr", dose * 1_000)
        }
        return String(format: "%.3f R/hr", dose)
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    private func refreshAirMonitorMotionState() {
        let shouldRun = isToolRunActive && (selectedMonitor?.isAirMonitor == true)
        if shouldRun {
            startAirMonitorSamplingMotionIfNeeded()
        } else {
            stopAirMonitorSamplingMotion()
        }
    }

    private func startAirMonitorSamplingMotionIfNeeded() {
        guard !airMonitorMotionManager.isRunning else { return }
        currentSamplingBand = .normal
        isLearningAirMonitorBaseline = false
        learnedAirMonitorBaselineTiltRadians = nil
        airMonitorCalibrationStep = .normal
        airMonitorCalibrationStatusMessage = nil
        smoothedAirMonitorTiltRadians = nil
        calibratedNormalTiltRadians = nil
        calibratedHighTiltRadians = nil
        calibratedLowTiltRadians = nil
        highBandEnterThresholdDegrees = 18
        lowBandEnterThresholdDegrees = 18
        highBandExitThresholdDegrees = 10
        lowBandExitThresholdDegrees = 10
        airMonitorMotionManager.start()
    }

    private func stopAirMonitorSamplingMotion() {
        airMonitorMotionManager.stop()
        currentSamplingBand = .normal
        isLearningAirMonitorBaseline = false
        learnedAirMonitorBaselineTiltRadians = nil
        airMonitorCalibrationStep = nil
        airMonitorCalibrationStatusMessage = nil
        smoothedAirMonitorTiltRadians = nil
        calibratedNormalTiltRadians = nil
        calibratedHighTiltRadians = nil
        calibratedLowTiltRadians = nil
        highBandEnterThresholdDegrees = 18
        lowBandEnterThresholdDegrees = 18
        highBandExitThresholdDegrees = 10
        lowBandExitThresholdDegrees = 10
    }

    private func handleAirMonitorTiltAngleUpdate(_ angleRadians: Double) {
        guard airMonitorMotionManager.isRunning else { return }

        if let existing = smoothedAirMonitorTiltRadians {
            smoothedAirMonitorTiltRadians = existing + ((angleRadians - existing) * airMonitorTiltSmoothingAlpha)
        } else {
            smoothedAirMonitorTiltRadians = angleRadians
        }

        guard let smoothed = smoothedAirMonitorTiltRadians else { return }

        if airMonitorCalibrationStep != nil {
            currentSamplingBand = .normal
            return
        }

        guard let baseline = learnedAirMonitorBaselineTiltRadians else {
            currentSamplingBand = .normal
            return
        }

        let deltaDegrees = (smoothed - baseline) * 180 / .pi
        let priorBand = currentSamplingBand

        switch currentSamplingBand {
        case .normal:
            if deltaDegrees >= highBandEnterThresholdDegrees {
                currentSamplingBand = .high
            } else if deltaDegrees <= -lowBandEnterThresholdDegrees {
                currentSamplingBand = .low
            }
        case .high:
            if deltaDegrees <= -lowBandEnterThresholdDegrees {
                currentSamplingBand = .low
            } else if deltaDegrees < highBandExitThresholdDegrees {
                currentSamplingBand = .normal
            }
        case .low:
            if deltaDegrees >= highBandEnterThresholdDegrees {
                currentSamplingBand = .high
            } else if deltaDegrees > -lowBandExitThresholdDegrees {
                currentSamplingBand = .normal
            }
        }

        if priorBand != currentSamplingBand, let zone = currentZone {
            gasReadings = adjustedGasReadings(for: zone)
        }
    }

    private func adjustedGasReadings(for zone: ScenarioZone) -> GasReadings {
        GasReadings(
            oxygen: adjustedAirMonitorReading(base: zone.oxygen, channel: "O2", zone: zone, clamp: 0...30),
            lel: adjustedAirMonitorReading(base: zone.lel, channel: "LEL", zone: zone, clamp: 0...100),
            co: adjustedAirMonitorReading(base: zone.co, channel: "CO", zone: zone, clamp: 0...500),
            h2s: adjustedAirMonitorReading(base: zone.h2s, channel: "H2S", zone: zone, clamp: 0...200),
            pid: adjustedAirMonitorReading(base: zone.pid, channel: "VOC", zone: zone, clamp: 0...2000)
        )
    }

    private func adjustedAirMonitorReading(
        base: Double,
        channel: String,
        zone: ScenarioZone,
        clamp: ClosedRange<Double>
    ) -> Double {
        let channelAdjustment = zone.airMonitorSampling?.adjustment(for: channel) ?? .unchanged
        let bandAdjustment = effectiveBandAdjustment(for: channelAdjustment)

        guard bandAdjustment.mode == .lower else {
            return min(max(base, clamp.lowerBound), clamp.upperBound)
        }

        let feather = min(max(bandAdjustment.featherPercent, 0), 100)
        let adjusted = base * (1 - (feather / 100))
        return min(max(adjusted, clamp.lowerBound), clamp.upperBound)
    }

    private func effectiveBandAdjustment(
        for channelAdjustment: AirMonitorSamplingChannelAdjustment
    ) -> AirMonitorSamplingBandAdjustment {
        switch currentSamplingBand {
        case .high:
            return channelAdjustment.high
        case .low:
            return channelAdjustment.low
        case .normal:
            let high = channelAdjustment.high
            let low = channelAdjustment.low
            let highIsAdjusted = high != .unchanged
            let lowIsAdjusted = low != .unchanged

            if highIsAdjusted && !lowIsAdjusted { return high }
            if lowIsAdjusted && !highIsAdjusted { return low }
            if highIsAdjusted && lowIsAdjusted && high == low { return high }
            return .unchanged
        }
    }

    private func finalizeAirMonitorCalibration() {
        guard let normalTilt = calibratedNormalTiltRadians,
              let highTilt = calibratedHighTiltRadians,
              let lowTilt = calibratedLowTiltRadians else {
            airMonitorCalibrationStatusMessage = "Calibration could not be completed. Try again."
            airMonitorCalibrationStep = .normal
            isLearningAirMonitorBaseline = true
            return
        }

        learnedAirMonitorBaselineTiltRadians = normalTilt

        let highDeltaDegrees = max(((highTilt - normalTilt) * 180 / .pi) * 0.5, minimumCalibrationDeltaDegrees / 2)
        let lowDeltaDegrees = max(((normalTilt - lowTilt) * 180 / .pi) * 0.5, minimumCalibrationDeltaDegrees / 2)

        highBandEnterThresholdDegrees = max(4, highDeltaDegrees)
        lowBandEnterThresholdDegrees = max(4, lowDeltaDegrees)
        highBandExitThresholdDegrees = max(3, highBandEnterThresholdDegrees * 0.55)
        lowBandExitThresholdDegrees = max(3, lowBandEnterThresholdDegrees * 0.55)

        airMonitorCalibrationStep = nil
        airMonitorCalibrationStatusMessage = nil
        isLearningAirMonitorBaseline = false
        currentSamplingBand = .normal

        if let zone = currentZone {
            gasReadings = adjustedGasReadings(for: zone)
        }
    }

    private func processPendingExternalRouteIfPossible() {
        guard didFinishSplash, let route = pendingExternalRoute else { return }
        pendingExternalRoute = nil

        switch route {
        case .continueSession:
            navPath = NavigationPath()
            Task { [weak self] in
                await self?.continueSession()
            }
        }
    }

    private func consumePendingExternalRoute() {
        let defaults = UserDefaults.standard
        guard let routeValue = defaults.string(forKey: AppIntentBridge.pendingRouteKey),
              let route = ExternalAppRoute(rawValue: routeValue) else {
            return
        }
        defaults.removeObject(forKey: AppIntentBridge.pendingRouteKey)
        pendingExternalRoute = route
    }

    private func persistDownloadedScenario(_ scenario: Scenario) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .formatted(Self.dateFormatter)
        let payload = PersistedDownloadedScenario(source: "backend_join", scenario: scenario)
        guard let data = try? encoder.encode(payload) else { return }
        UserDefaults.standard.set(data, forKey: AppIntentBridge.persistedScenarioKey)
    }

    private func restorePersistedSelectedScenarioIfAvailable() {
        let defaults = UserDefaults.standard
        guard let data = defaults.data(forKey: AppIntentBridge.persistedScenarioKey) else { return }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .formatted(Self.dateFormatter)
        guard let payload = try? decoder.decode(PersistedDownloadedScenario.self, from: data),
              payload.source == "backend_join" else {
            defaults.removeObject(forKey: AppIntentBridge.persistedScenarioKey)
            hasPersistedDownloadedScenario = false
            return
        }

        hasPersistedDownloadedScenario = true
        scenarios = [payload.scenario]
        chooseScenario(payload.scenario)
    }

    private var canAttemptSessionRefresh: Bool {
        !traineeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !joinCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func persistLastJoinCredentials(name: String, code: String) {
        let defaults = UserDefaults.standard
        defaults.set(name, forKey: AppIntentBridge.lastTraineeNameKey)
        defaults.set(code, forKey: AppIntentBridge.lastJoinCodeKey)
    }

    private func restoreLastJoinCredentialsIfAvailable() {
        let defaults = UserDefaults.standard
        if traineeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
           let savedName = defaults.string(forKey: AppIntentBridge.lastTraineeNameKey) {
            traineeName = savedName
        }
        if joinCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
           let savedCode = defaults.string(forKey: AppIntentBridge.lastJoinCodeKey) {
            joinCode = savedCode
        }
    }
}

private final class AirMonitorHeightSamplingMotionManager {
    var onTiltAngleUpdate: ((Double) -> Void)?

    private let motionManager = CMMotionManager()
    private let queue: OperationQueue = {
        let queue = OperationQueue()
        queue.name = "THMGTrainee.AirMonitorMotion"
        queue.qualityOfService = .userInteractive
        return queue
    }()

    var isRunning: Bool {
        motionManager.isDeviceMotionActive
    }

    func start() {
        guard motionManager.isDeviceMotionAvailable else { return }
        guard !motionManager.isDeviceMotionActive else { return }

        motionManager.deviceMotionUpdateInterval = 1.0 / 20.0
        motionManager.startDeviceMotionUpdates(to: queue) { [weak self] motion, _ in
            guard let gravity = motion?.gravity else { return }
            let tiltAngle = atan2(gravity.z, -gravity.y)
            DispatchQueue.main.async {
                self?.onTiltAngleUpdate?(tiltAngle)
            }
        }
    }

    func stop() {
        motionManager.stopDeviceMotionUpdates()
    }
}
