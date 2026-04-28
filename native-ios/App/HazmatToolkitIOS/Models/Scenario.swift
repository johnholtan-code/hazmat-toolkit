import Foundation

struct Scenario: Identifiable, Codable, Hashable {
    var id: UUID
    var scenarioName: String
    var trainerName: String
    var scenarioDate: Date
    var latitude: Double?
    var longitude: Double?
    var detectionDevice: DetectionDevice
    var createdAt: Date

    init(
        id: UUID = UUID(),
        scenarioName: String,
        trainerName: String,
        scenarioDate: Date,
        latitude: Double? = nil,
        longitude: Double? = nil,
        detectionDevice: DetectionDevice,
        createdAt: Date = .now
    ) {
        self.id = id
        self.scenarioName = scenarioName
        self.trainerName = trainerName
        self.scenarioDate = scenarioDate
        self.latitude = latitude
        self.longitude = longitude
        self.detectionDevice = detectionDevice
        self.createdAt = createdAt
    }
}
