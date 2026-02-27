import Foundation
import Combine
import CoreLocation

@MainActor
final class AppStore: ObservableObject {
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
    @Published var errorMessage: String?
    @Published var sessionStateByScenarioID: [UUID: ScenarioSessionControlState] = [:]
    @Published var sessionActionInProgressByScenarioID: [UUID: Bool] = [:]

    @Published private(set) var scenarios: [Scenario] = []
    @Published private(set) var shapesByScenarioID: [UUID: [GeoSimShape]] = [:]
    @Published private(set) var trackingByScenarioName: [String: [GeoTrackingPoint]] = [:]

    let allTools = DetectionDevice.allCases
    let currentTrainerEmail = "trainer@example.com"
    let repositoryModeDescription: String

    private let repository: any HazmatRepository

    init(repository: (any HazmatRepository)? = nil) {
        if let repository {
            self.repository = repository
            self.repositoryModeDescription = "custom:\(String(describing: type(of: repository)))"
        } else {
            let selection = Self.makeRepositorySelectionFromConfiguration()
            self.repository = selection.repository
            self.repositoryModeDescription = selection.modeDescription
        }
        print("[HazmatToolkitIOS] Repository mode: \(repositoryModeDescription)")
    }

    var filteredTools: [DetectionDevice] {
        guard !toolSearchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return allTools
        }
        return allTools.filter { $0.rawValue.localizedCaseInsensitiveContains(toolSearchText) }
    }

    func scenarios(for device: DetectionDevice) -> [Scenario] {
        scenarios
            .filter { $0.detectionDevice == device }
            .filter { scenarioSearchText.isEmpty || $0.scenarioName.localizedCaseInsensitiveContains(scenarioSearchText) }
            .sorted { $0.scenarioName.localizedCaseInsensitiveCompare($1.scenarioName) == .orderedAscending }
    }

    func bootstrap() async {
        do {
            scenarios = try await repository.fetchScenarios()
        } catch {
            errorMessage = error.localizedDescription
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
        path.append(.scenarioList(device))
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
            let request = try makeJSONRequest(
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
            let request = try makeJSONRequest(url: url, method: "POST", body: Optional<String>.none, trainerRef: currentTrainerEmail)
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
        pHValue: Double? = nil
    ) async {
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
        pHValue: Double? = nil
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

    private static func makeRepositorySelectionFromConfiguration() -> (repository: any HazmatRepository, modeDescription: String) {
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
                tokenProvider: nil,
                trainerRefHeaderValue: configuredString(
                    envKey: "HAZMAT_TRAINER_REF",
                    infoPlistKey: "HazmatTrainerRef"
                ) ?? "trainer@example.com"
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
            let request = try makeJSONRequest(url: url, method: "POST", body: Optional<String>.none, trainerRef: currentTrainerEmail)
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
    ) throws -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
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
            throw NSError(domain: "TrainerSessionAPI", code: http.statusCode, userInfo: [
                NSLocalizedDescriptionKey: String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            ])
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(type, from: data)
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
