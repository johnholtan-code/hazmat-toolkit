import Foundation

struct APIHazmatRepository: HazmatRepository {
    let client: any HazmatAPIClient

    func fetchScenarios() async throws -> [Scenario] {
        try await client.listScenarios().map { $0.toDomain() }
    }

    func createScenario(_ scenario: Scenario) async throws -> Scenario {
        let request = try APICreateScenarioRequest(domain: scenario)
        return try await client.createScenario(request).toDomain()
    }

    func updateScenario(_ scenario: Scenario) async throws -> Scenario {
        let request = try APIUpdateScenarioRequest(domain: scenario)
        return try await client.updateScenario(id: scenario.id, request).toDomain()
    }

    func deleteScenario(_ scenarioID: UUID) async throws {
        try await client.deleteScenario(id: scenarioID)
    }

    func fetchShapes(for scenarioID: UUID) async throws -> [GeoSimShape] {
        try await client.listShapes(scenarioID: scenarioID).map { $0.toDomain() }
    }

    func upsertShape(_ shape: GeoSimShape) async throws -> GeoSimShape {
        let request = APIUpsertShapeRequest(domain: shape)
        return try await client.upsertShape(scenarioID: shape.scenarioID, shapeID: shape.id, request).toDomain()
    }

    func deleteShape(_ shapeID: UUID, scenarioID: UUID) async throws {
        try await client.deleteShape(scenarioID: scenarioID, shapeID: shapeID)
    }

    func fetchTrackingPoints(for scenarioName: String) async throws -> [GeoTrackingPoint] {
        try await client.listTrackingPoints(scenarioName: scenarioName).map { $0.toDomain() }
    }

    func fetchTrackingReview(for sessionID: UUID) async throws -> SessionTrackingReview {
        async let participantsTask = client.listSessionParticipants(sessionID: sessionID)
        async let trackingTask = client.listSessionTracking(sessionID: sessionID, since: nil, limit: nil)

        let participants = try await participantsTask
        let tracking = try await trackingTask
        let zoneEvents: APIWatchZoneEventEnvelopeDTO
        do {
            zoneEvents = try await client.listSessionZoneEvents(sessionID: sessionID, since: nil, limit: nil)
        } catch let error as HazmatAPIError {
            switch error {
            case .httpStatus(let code, _) where code == 404:
                zoneEvents = APIWatchZoneEventEnvelopeDTO(items: [], nextCursor: nil)
            default:
                throw error
            }
        } catch {
            throw error
        }

        let participantNamesByID = Dictionary(uniqueKeysWithValues: participants.map { ($0.id, $0.traineeName) })

        return SessionTrackingReview(
            sessionID: sessionID,
            participants: participants.map { $0.toDomain() },
            points: tracking.items.map { $0.toDomain(participantNamesByID: participantNamesByID) },
            zoneEvents: zoneEvents.items.map { $0.toDomain() }
        )
    }

    func fetchSessions(for scenarioID: UUID) async throws -> [ScenarioSessionSummary] {
        do {
            return try await client.listSessions(scenarioID: scenarioID)
                .map { $0.toDomain() }
                .sorted {
                    let left = $0.startsAt ?? $0.createdAt ?? .distantPast
                    let right = $1.startsAt ?? $1.createdAt ?? .distantPast
                    return left > right
                }
        } catch let error as HazmatAPIError {
            switch error {
            case .httpStatus(let code, let body) where code == 404 && body.contains("Route GET:/v1/sessions"):
                do {
                    let latest = try await client.latestSession(scenarioID: scenarioID).session
                    return [
                        ScenarioSessionSummary(
                            id: latest.id,
                            scenarioID: latest.scenarioId,
                            status: latest.status,
                            joinCode: latest.joinCode,
                            joinCodeExpiresAt: latest.joinCodeExpiresAt,
                            startsAt: latest.startsAt,
                            endedAt: latest.endedAt,
                            isLive: latest.isLive,
                            sessionName: nil,
                            createdAt: nil
                        )
                    ]
                } catch let latestError as HazmatAPIError {
                    switch latestError {
                    case .httpStatus(let latestCode, _) where latestCode == 404:
                        return []
                    default:
                        throw latestError
                    }
                }
            default:
                throw error
            }
        }
    }
}

enum HazmatAPIRepositoryError: LocalizedError {
    case unsupportedDevice(String)

    var errorDescription: String? {
        switch self {
        case .unsupportedDevice(let raw):
            return "Device not yet supported by the backend API contract: \(raw)"
        }
    }
}
