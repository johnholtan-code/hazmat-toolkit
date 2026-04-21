import Foundation

actor MockHazmatRepository: HazmatRepository {
    private var scenarios: [Scenario]
    private var shapes: [UUID: [GeoSimShape]]
    private var trackingPoints: [String: [GeoTrackingPoint]]

    init() {
        let air = Scenario(
            scenarioName: "Warehouse Leak Alpha",
            trainerName: "trainer@example.com",
            scenarioDate: .now,
            latitude: 29.7604,
            longitude: -95.3698,
            detectionDevice: .airMonitor
        )
        let rad = Scenario(
            scenarioName: "Radiation Yard Bravo",
            trainerName: "trainer@example.com",
            scenarioDate: .now.addingTimeInterval(86400),
            latitude: 32.7767,
            longitude: -96.7970,
            detectionDevice: .radiationDetection
        )
        let ph = Scenario(
            scenarioName: "Runoff Check Charlie",
            trainerName: "trainer@example.com",
            scenarioDate: .now.addingTimeInterval(172800),
            latitude: 30.2672,
            longitude: -97.7431,
            detectionDevice: .phPaper
        )

        self.scenarios = [air, rad, ph]

        self.shapes = [
            air.id: [
                GeoSimShape(
                    scenarioID: air.id,
                    description: "Hot Zone",
                    shapeGeoJSON: "{ \"type\": \"Polygon\", \"coordinates\": [] }",
                    sortOrder: 1,
                    oxygen: "20.8",
                    lel: "0",
                    carbonMonoxide: "12",
                    hydrogenSulfide: "0",
                    pid: "5"
                )
            ],
            rad.id: [
                GeoSimShape(
                    scenarioID: rad.id,
                    description: "Source Area",
                    shapeGeoJSON: "{ \"type\": \"Polygon\", \"coordinates\": [] }",
                    sortOrder: 1,
                    doseRate: "1.4 mR/h",
                    background: "0.2",
                    shielding: "Concrete",
                    radLatitude: "32.7767",
                    radLongitude: "-96.7970"
                )
            ],
            ph.id: [
                GeoSimShape(
                    scenarioID: ph.id,
                    description: "Drain Inlet",
                    shapeGeoJSON: "{ \"type\": \"Point\", \"coordinates\": [] }",
                    sortOrder: 1,
                    pH: 5.5
                )
            ]
        ]

        self.trackingPoints = [
            air.scenarioName: [
                GeoTrackingPoint(scenarioName: air.scenarioName, traineeID: "Trainee-01", latitude: 29.7601, longitude: -95.3694, detectionDevice: .airMonitor, createdAt: .now.addingTimeInterval(-300)),
                GeoTrackingPoint(scenarioName: air.scenarioName, traineeID: "Trainee-01", latitude: 29.7607, longitude: -95.3691, detectionDevice: .airMonitor, createdAt: .now.addingTimeInterval(-120)),
                GeoTrackingPoint(scenarioName: air.scenarioName, traineeID: "Trainee-02", latitude: 29.7609, longitude: -95.3700, detectionDevice: .airMonitor, createdAt: .now.addingTimeInterval(-90))
            ],
            rad.scenarioName: [
                GeoTrackingPoint(scenarioName: rad.scenarioName, traineeID: "Trainee-03", latitude: 32.7768, longitude: -96.7969, detectionDevice: .radiationDetection, createdAt: .now.addingTimeInterval(-60))
            ]
        ]
    }

    func fetchScenarios() async throws -> [Scenario] {
        scenarios.sorted { $0.scenarioName.localizedCaseInsensitiveCompare($1.scenarioName) == .orderedAscending }
    }

    func createScenario(_ scenario: Scenario) async throws -> Scenario {
        scenarios.append(scenario)
        return scenario
    }

    func updateScenario(_ scenario: Scenario) async throws -> Scenario {
        guard let index = scenarios.firstIndex(where: { $0.id == scenario.id }) else {
            throw RepositoryError.notFound
        }
        scenarios[index] = scenario
        return scenario
    }

    func deleteScenario(_ scenarioID: UUID) async throws {
        guard let scenario = scenarios.first(where: { $0.id == scenarioID }) else {
            throw RepositoryError.notFound
        }
        scenarios.removeAll { $0.id == scenarioID }
        shapes[scenarioID] = nil
        trackingPoints[scenario.scenarioName] = nil
    }

    func fetchShapes(for scenarioID: UUID) async throws -> [GeoSimShape] {
        (shapes[scenarioID] ?? []).sorted { $0.sortOrder < $1.sortOrder }
    }

    func upsertShape(_ shape: GeoSimShape) async throws -> GeoSimShape {
        var bucket = shapes[shape.scenarioID] ?? []
        if let index = bucket.firstIndex(where: { $0.id == shape.id }) {
            bucket[index] = shape
        } else {
            bucket.append(shape)
        }
        shapes[shape.scenarioID] = bucket.sorted { $0.sortOrder < $1.sortOrder }
        return shape
    }

    func deleteShape(_ shapeID: UUID, scenarioID: UUID) async throws {
        guard var bucket = shapes[scenarioID] else { return }
        bucket.removeAll { $0.id == shapeID }
        shapes[scenarioID] = bucket
    }

    func fetchTrackingPoints(for scenarioName: String) async throws -> [GeoTrackingPoint] {
        let existing = trackingPoints[scenarioName] ?? []

        // Simulate new live points so watch mode has visible refresh behavior.
        if let seed = existing.last {
            let jitterLat = seed.latitude + Double.random(in: -0.0003...0.0003)
            let jitterLon = seed.longitude + Double.random(in: -0.0003...0.0003)
            let next = GeoTrackingPoint(
                scenarioName: seed.scenarioName,
                traineeID: seed.traineeID,
                latitude: jitterLat,
                longitude: jitterLon,
                detectionDevice: seed.detectionDevice,
                createdAt: .now
            )
            trackingPoints[scenarioName, default: []].append(next)
        }

        return (trackingPoints[scenarioName] ?? []).sorted { $0.createdAt < $1.createdAt }
    }
}

enum RepositoryError: LocalizedError {
    case notFound
    case duplicateScenarioName
    case notImplemented(String)

    var errorDescription: String? {
        switch self {
        case .notFound:
            return "Record not found."
        case .duplicateScenarioName:
            return "A scenario with that name already exists for this trainer."
        case .notImplemented(let area):
            return "Not implemented: \(area)"
        }
    }
}
