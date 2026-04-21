import Foundation

struct GeoTrackingPoint: Identifiable, Codable, Hashable {
    var id: UUID
    var scenarioName: String
    var traineeID: String
    var latitude: Double
    var longitude: Double
    var detectionDevice: DetectionDevice?
    var createdAt: Date

    init(
        id: UUID = UUID(),
        scenarioName: String,
        traineeID: String,
        latitude: Double,
        longitude: Double,
        detectionDevice: DetectionDevice? = nil,
        createdAt: Date = .now
    ) {
        self.id = id
        self.scenarioName = scenarioName
        self.traineeID = traineeID
        self.latitude = latitude
        self.longitude = longitude
        self.detectionDevice = detectionDevice
        self.createdAt = createdAt
    }
}
