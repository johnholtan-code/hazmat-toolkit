import Foundation
import Combine
import CoreLocation

@MainActor
final class AppStore: ObservableObject {
    enum ScenarioCreatedFilter: String, CaseIterable {
        case all
        case today
        case thisWeek
        case customDate

        var label: String {
            switch self {
            case .all:
                return "All"
            case .today:
                return "Today"
            case .thisWeek:
                return "This Week"
            case .customDate:
                return "Pick a Date"
            }
        }
    }

    struct ScenarioSessionControlState: Codable, Hashable {
        var sessionID: UUID
        var status: String
        var joinCode: String
        var joinCodeExpiresAt: Date
        var startsAt: Date?
        var endedAt: Date?
        var isLive: Bool
        var qrPayload: String?
    }

    @Published var path: [AppRoute] = []
    @Published var showingSplash = true

    @Published var toolSearchText = ""
    @Published var scenarioSearchText = ""
    @Published var scenarioCreatedFilter: ScenarioCreatedFilter = .all
    @Published var scenarioCreatedFilterDate: Date = .now
    @Published var errorMessage: String?
    @Published var sessionStateByScenarioID: [UUID: ScenarioSessionControlState] = [:]
    @Published var sessionActionInProgressByScenarioID: [UUID: Bool] = [:]

    @Published private(set) var scenarios: [Scenario] = []
    @Published private(set) var shapesByScenarioID: [UUID: [GeoSimShape]] = [:]
    @Published private(set) var trackingByScenarioName: [String: [GeoTrackingPoint]] = [:]

    let allTools = DetectionDevice.allCases
    @Published private(set) var currentTrainerEmail = ""
    let repositoryModeDescription: String

    private let repository: any HazmatRepository
    private let authTokenProvider = AppStoreAccessTokenProvider()
    private static let trainerAuthStorageKey = "hazmatToolkitTrainerAuth.v1"

    init(repository: (any HazmatRepository)? = nil) {
        let persistedAuth = Self.loadPersistedTrainerAuth()
        if let persistedAuth {
            self.currentTrainerEmail = persistedAuth.email
        }
        if let repository {
            self.repository = repository
            self.repositoryModeDescription = "custom:\(String(describing: type(of: repository)))"
        } else {
            let selection = Self.makeRepositorySelectionFromConfiguration(tokenProvider: authTokenProvider)
            self.repository = selection.repository
            self.repositoryModeDescription = selection.modeDescription
        }
        if let persistedAuth {
            Task { [authTokenProvider] in
                await authTokenProvider.setToken(persistedAuth.accessToken)
            }
        }
        print("[HazmatToolkitIOS] Repository mode: \(repositoryModeDescription)")
    }

    var filteredTools: [DetectionDevice] {
        guard !toolSearchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return allTools
        }
        return allTools.filter { $0.rawValue.localizedCaseInsensitiveContains(toolSearchText) }
    }

    var supportsTrainerAccounts: Bool {
        true
    }

    var isTrainerSignedIn: Bool {
        !currentTrainerEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var currentTrainerName: String {
        currentTrainerEmail
    }

    func scenarios(for device: DetectionDevice) -> [Scenario] {
        scenarios
            .filter { $0.detectionDevice == device }
            .filter { scenarioSearchText.isEmpty || $0.scenarioName.localizedCaseInsensitiveContains(scenarioSearchText) }
            .filter(matchesScenarioCreatedFilter)
            .sorted { lhs, rhs in
                if Calendar.current.isDate(lhs.createdAt, equalTo: rhs.createdAt, toGranularity: .second) {
                    return lhs.scenarioName.localizedCaseInsensitiveCompare(rhs.scenarioName) == .orderedAscending
                }
                return lhs.createdAt > rhs.createdAt
            }
    }

    func bootstrap() async {
        do {
            scenarios = try await repository.fetchScenarios()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOutTrainer() async {
        currentTrainerEmail = ""
        await authTokenProvider.clearToken()
        Self.clearPersistedTrainerAuth()
        sessionStateByScenarioID = [:]
        sessionActionInProgressByScenarioID = [:]
        scenarios = []
        path = []
    }

    func signInTrainer(email: String, password: String) async -> Bool {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedPassword = password
        guard !normalizedEmail.isEmpty, !normalizedPassword.isEmpty else {
            errorMessage = "Enter your trainer email and password."
            return false
        }
        guard normalizedPassword.count >= 8 else {
            errorMessage = "Password must be at least 8 characters."
            return false
        }

        do {
            let baseURL = try requireAPIBaseURL()
            let request = try await makeJSONRequest(
                url: baseURL.appendingPathComponent("v1/auth/sign-in"),
                method: "POST",
                body: TrainerAuthSignInRequest(email: normalizedEmail, password: normalizedPassword),
                trainerRef: nil
            )
            let envelope: TrainerAuthEnvelopeResponse = try await sendJSON(request, decode: TrainerAuthEnvelopeResponse.self)
            await applyAuthEnvelope(envelope, fallbackEmail: normalizedEmail)
            errorMessage = nil
            await bootstrap()
            return true
        } catch {
            do {
                let envelope = try await signInWithSupabaseBridge(email: normalizedEmail, password: normalizedPassword)
                await applyAuthEnvelope(envelope, fallbackEmail: normalizedEmail)
                errorMessage = nil
                await bootstrap()
                return true
            } catch {
                errorMessage = error.localizedDescription
                return false
            }
        }
    }

    func signUpTrainer(email: String, password: String, displayName: String, organizationName: String?) async -> Bool {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedPassword = password
        let normalizedDisplayName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedOrganizationName = organizationName?.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !normalizedEmail.isEmpty else {
            errorMessage = "Enter a trainer email."
            return false
        }
        guard normalizedPassword.count >= 8 else {
            errorMessage = "Password must be at least 8 characters."
            return false
        }
        guard !normalizedDisplayName.isEmpty else {
            errorMessage = "Enter a display name."
            return false
        }

        do {
            let baseURL = try requireAPIBaseURL()
            let request = try await makeJSONRequest(
                url: baseURL.appendingPathComponent("v1/auth/sign-up"),
                method: "POST",
                body: TrainerAuthSignUpRequest(
                    email: normalizedEmail,
                    password: normalizedPassword,
                    displayName: normalizedDisplayName,
                    organizationName: normalizedOrganizationName?.isEmpty == true ? nil : normalizedOrganizationName
                ),
                trainerRef: nil
            )
            let envelope: TrainerAuthEnvelopeResponse = try await sendJSON(request, decode: TrainerAuthEnvelopeResponse.self)
            await applyAuthEnvelope(envelope, fallbackEmail: normalizedEmail)
            errorMessage = nil
            await bootstrap()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func resetTrainerPassword(email: String, newPassword: String) async -> Bool {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedPassword = newPassword
        guard !normalizedEmail.isEmpty else {
            errorMessage = "Enter the trainer email."
            return false
        }
        guard normalizedPassword.count >= 8 else {
            errorMessage = "New password must be at least 8 characters."
            return false
        }

        do {
            let baseURL = try requireAPIBaseURL()
            let meRequest = try await makeJSONRequest(
                url: baseURL.appendingPathComponent("v1/auth/me"),
                method: "GET",
                body: Optional<String>.none,
                trainerRef: normalizedEmail
            )
            let meEnvelope: TrainerAuthEnvelopeResponse = try await sendJSON(meRequest, decode: TrainerAuthEnvelopeResponse.self)
            guard let organizationID = meEnvelope.currentOrganization?.id, !organizationID.isEmpty else {
                errorMessage = "No organization was found for this trainer account."
                return false
            }

            let resetURL = baseURL.appendingPathComponent("v1/admin/organizations/\(organizationID)/members/reset-password")
            let resetRequest = try await makeJSONRequest(
                url: resetURL,
                method: "POST",
                body: TrainerAuthResetPasswordRequest(email: normalizedEmail, password: normalizedPassword),
                trainerRef: normalizedEmail
            )
            let _: TrainerPasswordResetResponse = try await sendJSON(resetRequest, decode: TrainerPasswordResetResponse.self)
            return await signInTrainer(email: normalizedEmail, password: normalizedPassword)
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func dismissSplashAfterDelay() {
        Task {
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            showingSplash = false
        }
    }

    func openScenarioList(for device: DetectionDevice) {
        scenarioSearchText = ""
        scenarioCreatedFilter = .all
        scenarioCreatedFilterDate = .now
        path.append(.scenarioList(device))
    }

    func scenarioCreatedFilterSummary() -> String {
        switch scenarioCreatedFilter {
        case .all:
            return "Created: All"
        case .today:
            return "Created: Today"
        case .thisWeek:
            return "Created: This Week"
        case .customDate:
            return "Created: \(scenarioCreatedFilterDate.formatted(date: .abbreviated, time: .omitted))"
        }
    }

    private func matchesScenarioCreatedFilter(_ scenario: Scenario) -> Bool {
        let calendar = Calendar.current
        switch scenarioCreatedFilter {
        case .all:
            return true
        case .today:
            return calendar.isDateInToday(scenario.createdAt)
        case .thisWeek:
            return calendar.isDate(scenario.createdAt, equalTo: Date(), toGranularity: .weekOfYear)
        case .customDate:
            return calendar.isDate(scenario.createdAt, inSameDayAs: scenarioCreatedFilterDate)
        }
    }

    func openCreateScenario(for device: DetectionDevice) {
        path.append(.createScenario(device))
    }

    func openEditor(for scenario: Scenario) {
        path.append(.editScenario(scenario.id))
    }

    func openWatch(for scenario: Scenario) {
        path.append(.watchScenario(scenario.id))
    }

    func scenario(by id: UUID) -> Scenario? {
        scenarios.first { $0.id == id }
    }

    func loadShapes(for scenarioID: UUID) async {
        do {
            let shapes = try await repository.fetchShapes(for: scenarioID)
            shapesByScenarioID[scenarioID] = shapes
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadTracking(for scenarioName: String) async {
        do {
            let points = try await repository.fetchTrackingPoints(for: scenarioName)
            trackingByScenarioName[scenarioName] = points
        } catch {
            guard !Self.isCancellationLikeError(error) else { return }
            errorMessage = error.localizedDescription
        }
    }

    func sessionState(for scenarioID: UUID) -> ScenarioSessionControlState? {
        sessionStateByScenarioID[scenarioID]
    }

    func isSessionActionInProgress(for scenarioID: UUID) -> Bool {
        sessionActionInProgressByScenarioID[scenarioID] ?? false
    }

    func createTrainingSession(for scenarioID: UUID, ttlMinutes: Int = 1_440) async {
        guard let scenario = scenario(by: scenarioID) else {
            errorMessage = "Scenario not found."
            return
        }

        sessionActionInProgressByScenarioID[scenarioID] = true
        defer { sessionActionInProgressByScenarioID[scenarioID] = false }

        if repositoryModeDescription.hasPrefix("mock") {
            let now = Date()
            sessionStateByScenarioID[scenarioID] = .init(
                sessionID: UUID(),
                status: "scheduled",
                joinCode: Self.generateMockJoinCode(),
                joinCodeExpiresAt: now.addingTimeInterval(Double(ttlMinutes) * 60),
                startsAt: nil,
                endedAt: nil,
                isLive: false,
                qrPayload: "{\"type\":\"hazmat_session_join\",\"joinCode\":\"MOCK\"}"
            )
            return
        }

        do {
            let baseURL = try requireAPIBaseURL()
            let request = try await makeJSONRequest(
                url: baseURL.appendingPathComponent("v1/sessions"),
                method: "POST",
                body: TrainerCreateSessionRequest(scenarioID: scenario.id, sessionName: scenario.scenarioName, joinCodeTTLMinutes: ttlMinutes),
                trainerRef: nil
            )
            let response: TrainerCreateSessionResponse = try await sendJSON(request, decode: TrainerCreateSessionResponse.self)
            sessionStateByScenarioID[scenarioID] = response.toControlState()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func rotateTrainingSessionJoinCode(for scenarioID: UUID) async {
        guard let state = sessionStateByScenarioID[scenarioID] else {
            errorMessage = "Create a session first."
            return
        }

        sessionActionInProgressByScenarioID[scenarioID] = true
        defer { sessionActionInProgressByScenarioID[scenarioID] = false }

        if repositoryModeDescription.hasPrefix("mock") {
            var updated = state
            updated.joinCode = Self.generateMockJoinCode()
            updated.joinCodeExpiresAt = Date().addingTimeInterval(60 * 60)
            sessionStateByScenarioID[scenarioID] = updated
            return
        }

        do {
            let baseURL = try requireAPIBaseURL()
            let url = baseURL.appendingPathComponent("v1/sessions/\(state.sessionID.uuidString)/rotate-join-code")
            let request = try await makeJSONRequest(url: url, method: "POST", body: Optional<String>.none, trainerRef: currentTrainerEmail)
            let response: TrainerJoinCodeInfoResponse = try await sendJSON(request, decode: TrainerJoinCodeInfoResponse.self)
            var updated = state
            updated.joinCode = response.joinCode
            updated.joinCodeExpiresAt = response.joinCodeExpiresAt
            updated.qrPayload = "{\"type\":\"hazmat_session_join\",\"joinCode\":\"\(response.joinCode)\"}"
            sessionStateByScenarioID[scenarioID] = updated
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func startTrainingSession(for scenarioID: UUID) async {
        await mutateTrainingSessionLifecycle(for: scenarioID, action: "start")
    }

    func endTrainingSession(for scenarioID: UUID) async {
        await mutateTrainingSessionLifecycle(for: scenarioID, action: "end")
    }

    func createScenario(
        name: String,
        trainerName: String,
        date: Date,
        latitudeText: String,
        longitudeText: String,
        device: DetectionDevice
    ) async -> Bool {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            errorMessage = "Please enter a scenario name."
            return false
        }

        let duplicate = scenarios.contains {
            $0.trainerName.caseInsensitiveCompare(trainerName) == .orderedSame &&
            $0.scenarioName.caseInsensitiveCompare(trimmed) == .orderedSame
        }
        if duplicate {
            errorMessage = "You already have a scenario with this name. Choose a different name."
            return false
        }

        let scenario = Scenario(
            scenarioName: trimmed,
            trainerName: trainerName,
            scenarioDate: date,
            latitude: Double(latitudeText),
            longitude: Double(longitudeText),
            detectionDevice: device
        )

        do {
            let created = try await repository.createScenario(scenario)
            scenarios.append(created)
            if case .createScenario = path.last {
                path.removeLast()
            }
            path.append(.editScenario(created.id))
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func deleteScenario(_ scenarioID: UUID) async {
        do {
            try await repository.deleteScenario(scenarioID)
            if let removed = scenarios.first(where: { $0.id == scenarioID }) {
                trackingByScenarioName[removed.scenarioName] = nil
            }
            scenarios.removeAll { $0.id == scenarioID }
            shapesByScenarioID[scenarioID] = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func addShape(
        to scenarioID: UUID,
        description: String,
        variant: EditorVariant
    ) async {
        let bucket = shapesByScenarioID[scenarioID] ?? []
        let nextSort = (bucket.map(\.sortOrder).max() ?? 0) + 1
        let defaultZoneName = nextAvailableZoneName(in: bucket)
        var shape = GeoSimShape(
            scenarioID: scenarioID,
            description: description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? defaultZoneName : description,
            shapeGeoJSON: "{ \"type\": \"Polygon\", \"coordinates\": [] }",
            sortOrder: nextSort
        )

        switch variant {
        case .airMonitor:
            shape.oxygen = "20.8"
            shape.lel = "0"
            shape.carbonMonoxide = "0"
            shape.hydrogenSulfide = "0"
            shape.pid = "0"
        case .radiation:
            shape.doseRate = "0.0"
            shape.background = "0.0"
            shape.shielding = "None"
            shape.radDoseUnit = "nSv/h"
            shape.radExposureUnit = "mR/h"
        case .pH:
            shape.pH = 7.0
        }

        do {
            let saved = try await repository.upsertShape(shape)
            var updated = shapesByScenarioID[scenarioID] ?? []
            updated.append(saved)
            shapesByScenarioID[scenarioID] = updated.sorted { $0.sortOrder < $1.sortOrder }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func addPolygonShape(
        to scenarioID: UUID,
        description: String,
        vertices: [CLLocationCoordinate2D],
        variant: EditorVariant,
        displayColorHex: String? = nil,
        chemicalReadings: [ShapeChemicalReading] = [],
        pHValue: Double? = nil,
        oxygenHighSamplingMode: String? = nil,
        oxygenHighFeatherPercent: Double? = nil,
        oxygenLowSamplingMode: String? = nil,
        oxygenLowFeatherPercent: Double? = nil,
        lelHighSamplingMode: String? = nil,
        lelHighFeatherPercent: Double? = nil,
        lelLowSamplingMode: String? = nil,
        lelLowFeatherPercent: Double? = nil,
        carbonMonoxideHighSamplingMode: String? = nil,
        carbonMonoxideHighFeatherPercent: Double? = nil,
        carbonMonoxideLowSamplingMode: String? = nil,
        carbonMonoxideLowFeatherPercent: Double? = nil,
        hydrogenSulfideHighSamplingMode: String? = nil,
        hydrogenSulfideHighFeatherPercent: Double? = nil,
        hydrogenSulfideLowSamplingMode: String? = nil,
        hydrogenSulfideLowFeatherPercent: Double? = nil,
        pidHighSamplingMode: String? = nil,
        pidHighFeatherPercent: Double? = nil,
        pidLowSamplingMode: String? = nil,
        pidLowFeatherPercent: Double? = nil
    ) async {
        print("=== addPolygonShape called ===")
        print("LEL High Sampling Mode received: \(lelHighSamplingMode)")
        print("LEL High Feather Percent received: \(lelHighFeatherPercent)")

        guard vertices.count >= 3 else {
            errorMessage = "Polygon needs at least 3 points."
            return
        }

        let bucket = shapesByScenarioID[scenarioID] ?? []
        let nextSort = (bucket.map(\.sortOrder).max() ?? 0) + 1
        let title = description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nextAvailableZoneName(in: bucket) : description

        var shape = GeoSimShape(
            scenarioID: scenarioID,
            description: title,
            shapeGeoJSON: polygonGeoJSONString(vertices: vertices),
            displayColorHex: displayColorHex,
            sortOrder: nextSort,
            kind: .polygon
        )

        switch variant {
        case .airMonitor:
            let cleanedReadings = chemicalReadings.filter { !$0.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            shape.chemicalReadings = cleanedReadings
            shape.oxygen = cleanedReadings.first(where: { $0.abbr == "O2" })?.value ?? "20.8"
            shape.lel = cleanedReadings.first(where: { $0.abbr == "LEL" })?.value ?? "0"
            shape.carbonMonoxide = cleanedReadings.first(where: { $0.abbr == "CO" })?.value ?? "0"
            shape.hydrogenSulfide = cleanedReadings.first(where: { $0.abbr == "H2S" })?.value ?? "0"
            shape.pid = "0"
            shape.oxygenHighSamplingMode = oxygenHighSamplingMode
            shape.oxygenHighFeatherPercent = oxygenHighFeatherPercent
            shape.oxygenLowSamplingMode = oxygenLowSamplingMode
            shape.oxygenLowFeatherPercent = oxygenLowFeatherPercent
            shape.lelHighSamplingMode = lelHighSamplingMode
            shape.lelHighFeatherPercent = lelHighFeatherPercent
            shape.lelLowSamplingMode = lelLowSamplingMode
            shape.lelLowFeatherPercent = lelLowFeatherPercent
            shape.carbonMonoxideHighSamplingMode = carbonMonoxideHighSamplingMode
            shape.carbonMonoxideHighFeatherPercent = carbonMonoxideHighFeatherPercent
            shape.carbonMonoxideLowSamplingMode = carbonMonoxideLowSamplingMode
            shape.carbonMonoxideLowFeatherPercent = carbonMonoxideLowFeatherPercent
            shape.hydrogenSulfideHighSamplingMode = hydrogenSulfideHighSamplingMode
            shape.hydrogenSulfideHighFeatherPercent = hydrogenSulfideHighFeatherPercent
            shape.hydrogenSulfideLowSamplingMode = hydrogenSulfideLowSamplingMode
            shape.hydrogenSulfideLowFeatherPercent = hydrogenSulfideLowFeatherPercent
            shape.pidHighSamplingMode = pidHighSamplingMode
            shape.pidHighFeatherPercent = pidHighFeatherPercent
            shape.pidLowSamplingMode = pidLowSamplingMode
            shape.pidLowFeatherPercent = pidLowFeatherPercent

        case .radiation:
            shape.doseRate = "0.0"
            shape.background = "0.0"
            shape.shielding = "None"
            shape.radDoseUnit = "nSv/h"
            shape.radExposureUnit = "mR/h"
            let center = centroid(of: vertices)
            shape.radLatitude = center.latitude.formatted(.number.precision(.fractionLength(6)))
            shape.radLongitude = center.longitude.formatted(.number.precision(.fractionLength(6)))
        case .pH:
            shape.pH = pHValue ?? 7.0
        }

        do {
            let saved = try await repository.upsertShape(shape)
            var updated = shapesByScenarioID[scenarioID] ?? []
            updated.append(saved)
            shapesByScenarioID[scenarioID] = updated.sorted { $0.sortOrder < $1.sortOrder }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func addRadiationPinShape(
        to scenarioID: UUID,
        description: String,
        coordinate: CLLocationCoordinate2D,
        doseRate: String,
        doseUnit: String,
        background: String,
        exposureUnit: String,
        shielding: String
    ) async {
        let bucket = shapesByScenarioID[scenarioID] ?? []
        let nextSort = (bucket.map(\.sortOrder).max() ?? 0) + 1
        let title = description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? nextAvailableZoneName(in: bucket)
            : description

        var shape = GeoSimShape(
            scenarioID: scenarioID,
            description: title,
            shapeGeoJSON: pointGeoJSONString(coordinate: coordinate),
            sortOrder: nextSort,
            kind: .point
        )
        shape.doseRate = doseRate.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "0.0" : doseRate
        shape.radDoseUnit = doseUnit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "nSv/h" : doseUnit
        shape.background = background.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "0.0" : background
        shape.radExposureUnit = exposureUnit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "mR/h" : exposureUnit
        shape.shielding = shielding.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "None" : shielding
        shape.radLatitude = coordinate.latitude.formatted(.number.precision(.fractionLength(6)))
        shape.radLongitude = coordinate.longitude.formatted(.number.precision(.fractionLength(6)))

        do {
            let saved = try await repository.upsertShape(shape)
            var updated = shapesByScenarioID[scenarioID] ?? []
            updated.append(saved)
            shapesByScenarioID[scenarioID] = updated.sorted { $0.sortOrder < $1.sortOrder }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updatePolygonShape(
        id: UUID,
        description: String,
        vertices: [CLLocationCoordinate2D],
        variant: EditorVariant,
        displayColorHex: String? = nil,
        chemicalReadings: [ShapeChemicalReading] = [],
        pHValue: Double? = nil,
        oxygenHighSamplingMode: String? = nil,
        oxygenHighFeatherPercent: Double? = nil,
        oxygenLowSamplingMode: String? = nil,
        oxygenLowFeatherPercent: Double? = nil,
        lelHighSamplingMode: String? = nil,
        lelHighFeatherPercent: Double? = nil,
        lelLowSamplingMode: String? = nil,
        lelLowFeatherPercent: Double? = nil,
        carbonMonoxideHighSamplingMode: String? = nil,
        carbonMonoxideHighFeatherPercent: Double? = nil,
        carbonMonoxideLowSamplingMode: String? = nil,
        carbonMonoxideLowFeatherPercent: Double? = nil,
        hydrogenSulfideHighSamplingMode: String? = nil,
        hydrogenSulfideHighFeatherPercent: Double? = nil,
        hydrogenSulfideLowSamplingMode: String? = nil,
        hydrogenSulfideLowFeatherPercent: Double? = nil,
        pidHighSamplingMode: String? = nil,
        pidHighFeatherPercent: Double? = nil,
        pidLowSamplingMode: String? = nil,
        pidLowFeatherPercent: Double? = nil
    ) async {
        guard vertices.count >= 3 else {
            errorMessage = "Polygon needs at least 3 points."
            return
        }

        // Find the existing shape and its scenario bucket
        guard
            let scenarioID = shapesByScenarioID.first(where: { (_, bucket) in bucket.contains(where: { $0.id == id }) })?.key,
            var bucket = shapesByScenarioID[scenarioID],
            let index = bucket.firstIndex(where: { $0.id == id })
        else {
            errorMessage = "Shape not found."
            return
        }

        var shape = bucket[index]

        // Update basic fields
        let title = description.trimmingCharacters(in: .whitespacesAndNewlines)
        shape.description = title.isEmpty ? shape.description : title
        shape.shapeGeoJSON = polygonGeoJSONString(vertices: vertices)
        shape.displayColorHex = displayColorHex ?? shape.displayColorHex
        shape.kind = .polygon

        // Update fields based on variant
        switch variant {
        case .airMonitor:
            let cleanedReadings = chemicalReadings.filter { !$0.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            shape.chemicalReadings = cleanedReadings
            // Maintain legacy four-gas convenience values as mirrors of readings where applicable
            shape.oxygen = cleanedReadings.first(where: { $0.abbr == "O2" })?.value ?? shape.oxygen
            shape.lel = cleanedReadings.first(where: { $0.abbr == "LEL" })?.value ?? shape.lel
            shape.carbonMonoxide = cleanedReadings.first(where: { $0.abbr == "CO" })?.value ?? shape.carbonMonoxide
            shape.hydrogenSulfide = cleanedReadings.first(where: { $0.abbr == "H2S" })?.value ?? shape.hydrogenSulfide
            shape.oxygenHighSamplingMode = oxygenHighSamplingMode ?? shape.oxygenHighSamplingMode
            shape.oxygenHighFeatherPercent = oxygenHighFeatherPercent ?? shape.oxygenHighFeatherPercent
            shape.oxygenLowSamplingMode = oxygenLowSamplingMode ?? shape.oxygenLowSamplingMode
            shape.oxygenLowFeatherPercent = oxygenLowFeatherPercent ?? shape.oxygenLowFeatherPercent
            shape.lelHighSamplingMode = lelHighSamplingMode ?? shape.lelHighSamplingMode
            shape.lelHighFeatherPercent = lelHighFeatherPercent ?? shape.lelHighFeatherPercent
            shape.lelLowSamplingMode = lelLowSamplingMode ?? shape.lelLowSamplingMode
            shape.lelLowFeatherPercent = lelLowFeatherPercent ?? shape.lelLowFeatherPercent
            shape.carbonMonoxideHighSamplingMode = carbonMonoxideHighSamplingMode ?? shape.carbonMonoxideHighSamplingMode
            shape.carbonMonoxideHighFeatherPercent = carbonMonoxideHighFeatherPercent ?? shape.carbonMonoxideHighFeatherPercent
            shape.carbonMonoxideLowSamplingMode = carbonMonoxideLowSamplingMode ?? shape.carbonMonoxideLowSamplingMode
            shape.carbonMonoxideLowFeatherPercent = carbonMonoxideLowFeatherPercent ?? shape.carbonMonoxideLowFeatherPercent
            shape.hydrogenSulfideHighSamplingMode = hydrogenSulfideHighSamplingMode ?? shape.hydrogenSulfideHighSamplingMode
            shape.hydrogenSulfideHighFeatherPercent = hydrogenSulfideHighFeatherPercent ?? shape.hydrogenSulfideHighFeatherPercent
            shape.hydrogenSulfideLowSamplingMode = hydrogenSulfideLowSamplingMode ?? shape.hydrogenSulfideLowSamplingMode
            shape.hydrogenSulfideLowFeatherPercent = hydrogenSulfideLowFeatherPercent ?? shape.hydrogenSulfideLowFeatherPercent
            shape.pidHighSamplingMode = pidHighSamplingMode ?? shape.pidHighSamplingMode
            shape.pidHighFeatherPercent = pidHighFeatherPercent ?? shape.pidHighFeatherPercent
            shape.pidLowSamplingMode = pidLowSamplingMode ?? shape.pidLowSamplingMode
            shape.pidLowFeatherPercent = pidLowFeatherPercent ?? shape.pidLowFeatherPercent
        case .radiation:
            let center = centroid(of: vertices)
            shape.radLatitude = center.latitude.formatted(.number.precision(.fractionLength(6)))
            shape.radLongitude = center.longitude.formatted(.number.precision(.fractionLength(6)))
            shape.radDoseUnit = shape.radDoseUnit ?? "nSv/h"
            shape.radExposureUnit = shape.radExposureUnit ?? "mR/h"
        case .pH:
            if let pHValue {
                shape.pH = pHValue
            }
        }

        do {
            let saved = try await repository.upsertShape(shape)
            bucket[index] = saved
            shapesByScenarioID[scenarioID] = bucket.sorted { $0.sortOrder < $1.sortOrder }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateRadiationPinShape(
        id: UUID,
        description: String,
        coordinate: CLLocationCoordinate2D,
        doseRate: String,
        doseUnit: String,
        background: String,
        exposureUnit: String,
        shielding: String
    ) async {
        guard
            let scenarioID = shapesByScenarioID.first(where: { (_, bucket) in bucket.contains(where: { $0.id == id }) })?.key,
            var bucket = shapesByScenarioID[scenarioID],
            let index = bucket.firstIndex(where: { $0.id == id })
        else {
            errorMessage = "Shape not found."
            return
        }

        var shape = bucket[index]
        let title = description.trimmingCharacters(in: .whitespacesAndNewlines)
        if !title.isEmpty {
            shape.description = title
        }
        shape.kind = .point
        shape.shapeGeoJSON = pointGeoJSONString(coordinate: coordinate)
        shape.doseRate = doseRate.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "0.0" : doseRate
        shape.radDoseUnit = doseUnit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? shape.radDoseUnit ?? "nSv/h" : doseUnit
        shape.background = background.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "0.0" : background
        shape.radExposureUnit = exposureUnit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? shape.radExposureUnit ?? "mR/h" : exposureUnit
        shape.shielding = shielding.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "None" : shielding
        shape.radLatitude = coordinate.latitude.formatted(.number.precision(.fractionLength(6)))
        shape.radLongitude = coordinate.longitude.formatted(.number.precision(.fractionLength(6)))

        do {
            let saved = try await repository.upsertShape(shape)
            bucket[index] = saved
            shapesByScenarioID[scenarioID] = bucket.sorted { $0.sortOrder < $1.sortOrder }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteShape(_ shape: GeoSimShape) async {
        do {
            try await repository.deleteShape(shape.id, scenarioID: shape.scenarioID)
            shapesByScenarioID[shape.scenarioID]?.removeAll { $0.id == shape.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func clearError() {
        errorMessage = nil
    }

    private func polygonGeoJSONString(vertices: [CLLocationCoordinate2D]) -> String {
        let ring = closeRingIfNeeded(vertices)
        let coords = ring.map { [$0.longitude, $0.latitude] }
        let object: [String: Any] = [
            "type": "Polygon",
            "coordinates": [coords]
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted]),
              let text = String(data: data, encoding: .utf8) else {
            return "{ \"type\": \"Polygon\", \"coordinates\": [] }"
        }
        return text
    }

    private func pointGeoJSONString(coordinate: CLLocationCoordinate2D) -> String {
        let object: [String: Any] = [
            "type": "Point",
            "coordinates": [coordinate.longitude, coordinate.latitude]
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted]),
              let text = String(data: data, encoding: .utf8) else {
            return "{ \"type\": \"Point\", \"coordinates\": [0, 0] }"
        }
        return text
    }

    private func closeRingIfNeeded(_ vertices: [CLLocationCoordinate2D]) -> [CLLocationCoordinate2D] {
        guard let first = vertices.first, let last = vertices.last else { return vertices }
        if first.latitude == last.latitude && first.longitude == last.longitude {
            return vertices
        }
        return vertices + [first]
    }

    private func centroid(of vertices: [CLLocationCoordinate2D]) -> CLLocationCoordinate2D {
        let lat = vertices.map(\.latitude).reduce(0, +) / Double(vertices.count)
        let lon = vertices.map(\.longitude).reduce(0, +) / Double(vertices.count)
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    private func nextAvailableZoneName(in shapes: [GeoSimShape]) -> String {
        let usedZoneNumbers = Set(
            shapes.compactMap { shape in
                parseZoneNumber(from: shape.description)
            }
        )

        var candidate = 1
        while usedZoneNumbers.contains(candidate) {
            candidate += 1
        }
        return "Zone \(candidate)"
    }

    private func parseZoneNumber(from description: String) -> Int? {
        let trimmed = description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.lowercased().hasPrefix("zone ") else { return nil }
        let suffix = trimmed.dropFirst(5).trimmingCharacters(in: .whitespacesAndNewlines)
        return Int(suffix)
    }

    private static func makeRepositorySelectionFromConfiguration(
        tokenProvider: any HazmatAPIAccessTokenProvider
    ) -> (repository: any HazmatRepository, modeDescription: String) {
        let dataSource = configuredString(
            envKey: "HAZMAT_DATA_SOURCE",
            infoPlistKey: "HazmatDataSource"
        )?.lowercased()

        if dataSource == "api" {
            guard let baseURLString = configuredString(
                envKey: "HAZMAT_API_BASE_URL",
                infoPlistKey: "HazmatAPIBaseURL"
            ),
            let baseURL = URL(string: baseURLString) else {
                return (
                    repository: MockHazmatRepository(),
                    modeDescription: "mock (invalid/missing HazmatAPIBaseURL while HAZMAT_DATA_SOURCE=api)"
                )
            }

            let client = URLSessionHazmatAPIClient(
                config: HazmatAPIEnvironmentConfig(baseURL: baseURL),
                tokenProvider: tokenProvider,
                trainerRefHeaderValue: configuredString(
                    envKey: "HAZMAT_TRAINER_REF",
                    infoPlistKey: "HazmatTrainerRef"
                )
            )
            return (
                repository: APIHazmatRepository(client: client),
                modeDescription: "api (\(baseURL.absoluteString))"
            )
        }

        return (repository: MockHazmatRepository(), modeDescription: "mock (default)")
    }

    private static func configuredString(envKey: String, infoPlistKey: String) -> String? {
        if let value = ProcessInfo.processInfo.environment[envKey]?.trimmingCharacters(in: .whitespacesAndNewlines),
           !value.isEmpty {
            return value
        }

        if let value = Bundle.main.object(forInfoDictionaryKey: infoPlistKey) as? String {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                return trimmed
            }
        }

        return nil
    }

    private func mutateTrainingSessionLifecycle(for scenarioID: UUID, action: String) async {
        guard let state = sessionStateByScenarioID[scenarioID] else {
            errorMessage = "Create a session first."
            return
        }
        sessionActionInProgressByScenarioID[scenarioID] = true
        defer { sessionActionInProgressByScenarioID[scenarioID] = false }

        if repositoryModeDescription.hasPrefix("mock") {
            var updated = state
            if action == "start" {
                updated.status = "live"
                updated.isLive = true
                updated.startsAt = updated.startsAt ?? .now
                updated.endedAt = nil
            } else {
                updated.status = "closed"
                updated.isLive = false
                updated.endedAt = updated.endedAt ?? .now
            }
            sessionStateByScenarioID[scenarioID] = updated
            return
        }

        do {
            let baseURL = try requireAPIBaseURL()
            let url = baseURL.appendingPathComponent("v1/sessions/\(state.sessionID.uuidString)/\(action)")
            let request = try await makeJSONRequest(url: url, method: "POST", body: Optional<String>.none, trainerRef: currentTrainerEmail)
            let response: TrainerSessionLifecycleResponse = try await sendJSON(request, decode: TrainerSessionLifecycleResponse.self)
            var updated = state
            updated.status = response.status
            updated.joinCode = response.joinCode
            updated.joinCodeExpiresAt = response.joinCodeExpiresAt
            updated.startsAt = response.startsAt
            updated.endedAt = response.endedAt
            updated.isLive = response.isLive
            sessionStateByScenarioID[scenarioID] = updated
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func requireAPIBaseURL() throws -> URL {
        guard let base = Self.configuredString(envKey: "HAZMAT_API_BASE_URL", infoPlistKey: "HazmatAPIBaseURL"),
              let url = URL(string: base) else {
            throw URLError(.badURL)
        }
        return url
    }

    private func makeJSONRequest<T: Encodable>(
        url: URL,
        method: String,
        body: T?,
        trainerRef: String?
    ) async throws -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = try await authTokenProvider.accessToken(), !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let trainerRef {
            request.setValue(trainerRef, forHTTPHeaderField: "X-Trainer-Ref")
        }
        if let body {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            request.httpBody = try encoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return request
    }

    private func sendJSON<Response: Decodable>(_ request: URLRequest, decode type: Response.Type) async throws -> Response {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard (200..<300).contains(http.statusCode) else {
            let message = parsedErrorMessage(from: data) ?? String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            let method = request.httpMethod ?? "UNKNOWN"
            let urlString = request.url?.absoluteString ?? "<unknown-url>"
            throw NSError(domain: "TrainerSessionAPI", code: http.statusCode, userInfo: [
                NSLocalizedDescriptionKey: "API error (\(http.statusCode)) [\(method) \(urlString)]: \(message)"
            ])
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(type, from: data)
    }

    private func signInWithSupabaseBridge(email: String, password: String) async throws -> TrainerAuthEnvelopeResponse {
        let supabaseURL = try requireSupabaseURL()
        let supabaseAnonKey = try await requireSupabaseAnonKey()
        guard var components = URLComponents(url: supabaseURL, resolvingAgainstBaseURL: false) else {
            throw URLError(.badURL)
        }
        components.path = (components.path.isEmpty || components.path == "/")
            ? "/auth/v1/token"
            : "\(components.path)/auth/v1/token"
        components.queryItems = [URLQueryItem(name: "grant_type", value: "password")]
        guard let tokenURL = components.url else {
            throw URLError(.badURL)
        }

        var supabaseRequest = URLRequest(url: tokenURL)
        supabaseRequest.httpMethod = "POST"
        supabaseRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        supabaseRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        supabaseRequest.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        supabaseRequest.httpBody = try JSONEncoder().encode(SupabasePasswordSignInRequest(email: email, password: password))

        let supabaseSession: SupabasePasswordSessionResponse = try await sendJSON(supabaseRequest, decode: SupabasePasswordSessionResponse.self)
        guard let supabaseAccessToken = supabaseSession.accessToken, !supabaseAccessToken.isEmpty else {
            throw NSError(domain: "SupabaseAuth", code: -1, userInfo: [
                NSLocalizedDescriptionKey: "Supabase did not return an access token."
            ])
        }

        let baseURL = try requireAPIBaseURL()
        var authMeRequest = URLRequest(url: baseURL.appendingPathComponent("v1/auth/me"))
        authMeRequest.httpMethod = "GET"
        authMeRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        authMeRequest.setValue("Bearer \(supabaseAccessToken)", forHTTPHeaderField: "Authorization")
        return try await sendJSON(authMeRequest, decode: TrainerAuthEnvelopeResponse.self)
    }

    private func requireSupabaseURL() throws -> URL {
        guard
            let raw = Self.configuredString(envKey: "SUPABASE_URL", infoPlistKey: "SupabaseURL"),
            let url = URL(string: raw)
        else {
            throw NSError(domain: "SupabaseAuth", code: -1, userInfo: [
                NSLocalizedDescriptionKey: "Supabase URL is not configured."
            ])
        }
        return url
    }

    private func requireSupabaseAnonKey() async throws -> String {
        if let configured = Self.configuredString(envKey: "SUPABASE_ANON_KEY", infoPlistKey: "SupabaseAnonKey"),
           !configured.isEmpty {
            return configured
        }
        let baseURL = try requireAPIBaseURL()
        let request = try await makeJSONRequest(
            url: baseURL.appendingPathComponent("v1/ics-collab/meta"),
            method: "GET",
            body: Optional<String>.none,
            trainerRef: nil
        )
        let meta: IcsCollabMetaResponse = try await sendJSON(request, decode: IcsCollabMetaResponse.self)
        if let key = meta.runtimeConfig?.supabaseAnonKey?.trimmingCharacters(in: .whitespacesAndNewlines),
           !key.isEmpty {
            return key
        }
        throw NSError(domain: "SupabaseAuth", code: -1, userInfo: [
            NSLocalizedDescriptionKey: "Supabase anon key is not available from app config or backend meta."
        ])
    }

    private func parsedErrorMessage(from data: Data) -> String? {
        guard
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        if let message = object["msg"] as? String, !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return message
        }
        if let message = object["message"] as? String, !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return message
        }
        if let error = object["error_description"] as? String, !error.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return error
        }
        if let error = object["error"] as? String, !error.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return error
        }
        return nil
    }

    private func applyAuthEnvelope(_ envelope: TrainerAuthEnvelopeResponse, fallbackEmail: String) async {
        let trainerEmail = envelope.trainer.email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        currentTrainerEmail = trainerEmail.isEmpty ? fallbackEmail : trainerEmail
        await authTokenProvider.setToken(envelope.accessToken)
        Self.persistTrainerAuth(email: currentTrainerEmail, accessToken: envelope.accessToken)
    }

    private static func persistTrainerAuth(email: String, accessToken: String) {
        let payload = PersistedTrainerAuth(email: email, accessToken: accessToken)
        if let data = try? JSONEncoder().encode(payload) {
            UserDefaults.standard.set(data, forKey: trainerAuthStorageKey)
        }
    }

    private static func loadPersistedTrainerAuth() -> PersistedTrainerAuth? {
        guard let data = UserDefaults.standard.data(forKey: trainerAuthStorageKey) else { return nil }
        return try? JSONDecoder().decode(PersistedTrainerAuth.self, from: data)
    }

    private static func clearPersistedTrainerAuth() {
        UserDefaults.standard.removeObject(forKey: trainerAuthStorageKey)
    }

    private static func generateMockJoinCode() -> String {
        let chars = Array("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
        return String((0..<6).map { _ in chars.randomElement()! })
    }

    private static func isCancellationLikeError(_ error: Error) -> Bool {
        if error is CancellationError { return true }
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
            return true
        }
        return nsError.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "cancelled"
    }
}

actor AppStoreAccessTokenProvider: HazmatAPIAccessTokenProvider {
    private var token: String?

    func accessToken() async throws -> String? {
        token
    }

    func setToken(_ value: String) {
        token = value
    }

    func clearToken() {
        token = nil
    }
}

private struct PersistedTrainerAuth: Codable {
    let email: String
    let accessToken: String
}

private struct TrainerAuthSignInRequest: Encodable {
    let email: String
    let password: String
}

private struct SupabasePasswordSignInRequest: Encodable {
    let email: String
    let password: String
}

private struct SupabasePasswordSessionResponse: Decodable {
    let accessToken: String?
}

private struct IcsCollabMetaResponse: Decodable {
    struct RuntimeConfig: Decodable {
        let supabaseAnonKey: String?
    }
    let runtimeConfig: RuntimeConfig?
}

private struct TrainerAuthSignUpRequest: Encodable {
    let email: String
    let password: String
    let displayName: String
    let organizationName: String?
}

private struct TrainerAuthResetPasswordRequest: Encodable {
    let email: String
    let password: String
}

private struct TrainerPasswordResetResponse: Decodable {
    let message: String
    let email: String
}

private struct TrainerAuthEnvelopeResponse: Decodable {
    struct Trainer: Decodable {
        let email: String
    }

    struct CurrentOrganization: Decodable {
        let id: String?
    }

    let accessToken: String
    let trainer: Trainer
    let currentOrganization: CurrentOrganization?
}

private struct TrainerCreateSessionRequest: Encodable {
    var scenarioID: UUID
    var sessionName: String?
    var joinCodeTTLMinutes: Int

    private enum CodingKeys: String, CodingKey {
        case scenarioID = "scenarioId"
        case sessionName
        case joinCodeTTLMinutes = "joinCodeTtlMinutes"
    }
}

private struct TrainerCreateSessionResponse: Decodable {
    struct Session: Decodable {
        var id: UUID
        var scenarioID: UUID
        var status: String
        var joinCode: String
        var joinCodeExpiresAt: Date
        var startsAt: Date?
        var endedAt: Date?
        var isLive: Bool

        private enum CodingKeys: String, CodingKey {
            case id
            case scenarioID = "scenarioId"
            case status
            case joinCode
            case joinCodeExpiresAt
            case startsAt
            case endedAt
            case isLive
        }
    }
    struct JoinCode: Decodable {
        var joinCode: String
        var joinCodeExpiresAt: Date
    }

    var session: Session
    var joinCode: JoinCode
    var qrPayload: String?

    func toControlState() -> AppStore.ScenarioSessionControlState {
        .init(
            sessionID: session.id,
            status: session.status,
            joinCode: joinCode.joinCode,
            joinCodeExpiresAt: joinCode.joinCodeExpiresAt,
            startsAt: session.startsAt,
            endedAt: session.endedAt,
            isLive: session.isLive,
            qrPayload: qrPayload
        )
    }
}

private struct TrainerJoinCodeInfoResponse: Decodable {
    var joinCode: String
    var joinCodeExpiresAt: Date
}

private struct TrainerSessionLifecycleResponse: Decodable {
    var id: UUID
    var scenarioID: UUID
    var status: String
    var joinCode: String
    var joinCodeExpiresAt: Date
    var startsAt: Date?
    var endedAt: Date?
    var isLive: Bool

    private enum CodingKeys: String, CodingKey {
        case id
        case scenarioID = "scenarioId"
        case status
        case joinCode
        case joinCodeExpiresAt
        case startsAt
        case endedAt
        case isLive
    }
}
