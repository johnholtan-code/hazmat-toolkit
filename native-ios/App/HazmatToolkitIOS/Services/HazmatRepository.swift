import Foundation

protocol HazmatRepository: Sendable {
    func fetchScenarios() async throws -> [Scenario]
    func createScenario(_ scenario: Scenario) async throws -> Scenario
    func updateScenario(_ scenario: Scenario) async throws -> Scenario
    func deleteScenario(_ scenarioID: UUID) async throws

    func fetchShapes(for scenarioID: UUID) async throws -> [GeoSimShape]
    func upsertShape(_ shape: GeoSimShape) async throws -> GeoSimShape
    func deleteShape(_ shapeID: UUID, scenarioID: UUID) async throws

    func fetchTrackingPoints(for scenarioName: String) async throws -> [GeoTrackingPoint]
    func fetchTrackingReview(for sessionID: UUID) async throws -> SessionTrackingReview
}
