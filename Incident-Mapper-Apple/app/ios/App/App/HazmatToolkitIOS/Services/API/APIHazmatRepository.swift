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
