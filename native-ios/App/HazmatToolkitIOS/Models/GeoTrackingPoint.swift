import Foundation

struct GeoTrackingPoint: Identifiable, Codable, Hashable {
    var id: UUID
    var scenarioName: String
    var traineeID: String
    var latitude: Double
    var longitude: Double
    var detectionDevice: DetectionDevice?
    var createdAt: Date
    var monitorType: String?
    var monitorProfileID: String?
    var monitorDeviceName: String?
    var monitorSensorLayout: [String]
    var samplingBand: String?
    var samplingBandLabel: String?
    var secondsInCurrentBand: Double?

    init(
        id: UUID = UUID(),
        scenarioName: String,
        traineeID: String,
        latitude: Double,
        longitude: Double,
        detectionDevice: DetectionDevice? = nil,
        createdAt: Date = .now,
        monitorType: String? = nil,
        monitorProfileID: String? = nil,
        monitorDeviceName: String? = nil,
        monitorSensorLayout: [String] = [],
        samplingBand: String? = nil,
        samplingBandLabel: String? = nil,
        secondsInCurrentBand: Double? = nil
    ) {
        self.id = id
        self.scenarioName = scenarioName
        self.traineeID = traineeID
        self.latitude = latitude
        self.longitude = longitude
        self.detectionDevice = detectionDevice
        self.createdAt = createdAt
        self.monitorType = monitorType
        self.monitorProfileID = monitorProfileID
        self.monitorDeviceName = monitorDeviceName
        self.monitorSensorLayout = monitorSensorLayout
        self.samplingBand = samplingBand
        self.samplingBandLabel = samplingBandLabel
        self.secondsInCurrentBand = secondsInCurrentBand
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
