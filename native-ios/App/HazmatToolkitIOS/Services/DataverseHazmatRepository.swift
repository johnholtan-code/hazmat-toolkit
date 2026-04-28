import Foundation

struct DataverseHazmatRepository: HazmatRepository {
    let client: DataverseClient

    func fetchScenarios() async throws -> [Scenario] {
        throw RepositoryError.notImplemented("Dataverse fetchScenarios")
    }

    func createScenario(_ scenario: Scenario) async throws -> Scenario {
        throw RepositoryError.notImplemented("Dataverse createScenario")
    }

    func updateScenario(_ scenario: Scenario) async throws -> Scenario {
        throw RepositoryError.notImplemented("Dataverse updateScenario")
    }

    func deleteScenario(_ scenarioID: UUID) async throws {
        throw RepositoryError.notImplemented("Dataverse deleteScenario")
    }

    func fetchShapes(for scenarioID: UUID) async throws -> [GeoSimShape] {
        throw RepositoryError.notImplemented("Dataverse fetchShapes")
    }

    func upsertShape(_ shape: GeoSimShape) async throws -> GeoSimShape {
        throw RepositoryError.notImplemented("Dataverse upsertShape")
    }

    func deleteShape(_ shapeID: UUID, scenarioID: UUID) async throws {
        throw RepositoryError.notImplemented("Dataverse deleteShape")
    }

    func fetchTrackingPoints(for scenarioName: String) async throws -> [GeoTrackingPoint] {
        throw RepositoryError.notImplemented("Dataverse fetchTrackingPoints")
    }

    func fetchTrackingReview(for sessionID: UUID) async throws -> SessionTrackingReview {
        throw RepositoryError.notImplemented("Dataverse fetchTrackingReview")
    }
}
