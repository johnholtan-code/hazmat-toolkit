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

struct SessionTrackingParticipant: Identifiable, Codable, Hashable {
    struct LatestPoint: Codable, Hashable {
        var recordedAt: Date
        var receivedAt: Date?
        var latitude: Double
        var longitude: Double
        var accuracyM: Double?
        var isBackfilled: Bool
    }

    var id: UUID
    var traineeName: String
    var deviceType: DetectionDevice?
    var joinedAt: Date
    var lastSeenAt: Date?
    var latestPoint: LatestPoint?
}

struct SessionZoneEvent: Identifiable, Codable, Hashable {
    var id: UUID
    var participantID: UUID
    var traineeName: String
    var deviceType: DetectionDevice?
    var shapeID: UUID?
    var shapeSortOrder: Int?
    var zoneName: String
    var enteredAt: Date
    var exitedAt: Date
    var durationSeconds: TimeInterval
    var receivedAt: Date?
}

struct SessionTrackingReview: Codable, Hashable {
    var sessionID: UUID
    var participants: [SessionTrackingParticipant]
    var points: [GeoTrackingPoint]
    var zoneEvents: [SessionZoneEvent]
}
