import Foundation

// DTOs for the Postgres/PostGIS-backed Hazmat API. These map transport payloads
// to the existing domain models used by HazmatToolkitIOS views/store.

enum APIDeviceType: String, Codable, Sendable {
    case airMonitor = "air_monitor"
    case radiationDetection = "radiation_detection"
    case phPaper = "ph_paper"

    init?(domain: DetectionDevice) {
        switch domain {
        case .airMonitor: self = .airMonitor
        case .radiationDetection: self = .radiationDetection
        case .phPaper: self = .phPaper
        default: return nil
        }
    }

    var domainValue: DetectionDevice {
        switch self {
        case .airMonitor: return .airMonitor
        case .radiationDetection: return .radiationDetection
        case .phPaper: return .phPaper
        }
    }
}

enum APIShapeKind: String, Codable, Sendable {
    case polygon
    case circle
    case point

    init(domain: GeoSimShape.ShapeKind) {
        switch domain {
        case .polygon: self = .polygon
        case .circle: self = .circle
        case .point: self = .point
        }
    }

    var domainValue: GeoSimShape.ShapeKind {
        switch self {
        case .polygon: return .polygon
        case .circle: return .circle
        case .point: return .point
        }
    }
}

enum APISessionStatus: String, Codable, Sendable {
    case scheduled
    case live
    case ended
    case cancelled
}

struct APIScenarioDTO: Codable, Hashable, Sendable, Identifiable {
    var id: UUID
    var scenarioName: String
    var trainerName: String
    var scenarioDate: Date
    var latitude: Double?
    var longitude: Double?
    var detectionDevice: APIDeviceType
    var version: Int?
    var createdAt: Date
    var updatedAt: Date?

    func toDomain() -> Scenario {
        Scenario(
            id: id,
            scenarioName: scenarioName,
            trainerName: trainerName,
            scenarioDate: scenarioDate,
            latitude: latitude,
            longitude: longitude,
            detectionDevice: detectionDevice.domainValue,
            createdAt: createdAt
        )
    }
}

struct APICreateScenarioRequest: Codable, Sendable {
    var scenarioName: String
    var trainerName: String
    var scenarioDate: Date
    var latitude: Double?
    var longitude: Double?
    var detectionDevice: APIDeviceType
    var notes: String?

    init(domain: Scenario, notes: String? = nil) throws {
        guard let apiDevice = APIDeviceType(domain: domain.detectionDevice) else {
            throw HazmatAPIRepositoryError.unsupportedDevice(domain.detectionDevice.rawValue)
        }
        self.scenarioName = domain.scenarioName
        self.trainerName = domain.trainerName
        self.scenarioDate = domain.scenarioDate
        self.latitude = domain.latitude
        self.longitude = domain.longitude
        self.detectionDevice = apiDevice
        self.notes = notes
    }
}

struct APIUpdateScenarioRequest: Codable, Sendable {
    var scenarioName: String
    var trainerName: String
    var scenarioDate: Date
    var latitude: Double?
    var longitude: Double?
    var detectionDevice: APIDeviceType

    init(domain: Scenario) throws {
        guard let apiDevice = APIDeviceType(domain: domain.detectionDevice) else {
            throw HazmatAPIRepositoryError.unsupportedDevice(domain.detectionDevice.rawValue)
        }
        self.scenarioName = domain.scenarioName
        self.trainerName = domain.trainerName
        self.scenarioDate = domain.scenarioDate
        self.latitude = domain.latitude
        self.longitude = domain.longitude
        self.detectionDevice = apiDevice
    }
}

struct APIShapeDTO: Codable, Hashable, Sendable, Identifiable {
    var id: UUID
    var scenarioID: UUID
    var description: String
    var kind: APIShapeKind
    var sortOrder: Int
    var displayColorHex: String?
    var shapeGeoJSON: String
    var radiusM: Double?

    var oxygen: String?
    var lel: String?
    var carbonMonoxide: String?
    var hydrogenSulfide: String?
    var pid: String?
    var chemicalReadings: [ShapeChemicalReading]

    var doseRate: String?
    var background: String?
    var shielding: String?
    var radLatitude: String?
    var radLongitude: String?
    var radDoseUnit: String?
    var radExposureUnit: String?

    var pH: Double?

    private enum CodingKeys: String, CodingKey {
        case id
        case scenarioID = "scenarioId"
        case description
        case kind
        case sortOrder
        case displayColorHex
        case shapeGeoJSON
        case radiusM
        case oxygen
        case lel
        case carbonMonoxide
        case hydrogenSulfide
        case pid
        case chemicalReadings
        case doseRate
        case background
        case shielding
        case radLatitude
        case radLongitude
        case radDoseUnit
        case radExposureUnit
        case pH
    }

    func toDomain() -> GeoSimShape {
        GeoSimShape(
            id: id,
            scenarioID: scenarioID,
            description: description,
            shapeGeoJSON: shapeGeoJSON,
            displayColorHex: displayColorHex,
            sortOrder: sortOrder,
            kind: kind.domainValue,
            oxygen: oxygen,
            lel: lel,
            carbonMonoxide: carbonMonoxide,
            hydrogenSulfide: hydrogenSulfide,
            pid: pid,
            chemicalReadings: chemicalReadings,
            doseRate: doseRate,
            background: background,
            shielding: shielding,
            radLatitude: radLatitude,
            radLongitude: radLongitude,
            radDoseUnit: radDoseUnit,
            radExposureUnit: radExposureUnit,
            pH: pH
        )
    }
}

struct APIUpsertShapeRequest: Codable, Sendable {
    var description: String
    var kind: APIShapeKind
    var sortOrder: Int
    var displayColorHex: String?
    var shapeGeoJSON: String
    var radiusM: Double?

    var oxygen: String?
    var lel: String?
    var carbonMonoxide: String?
    var hydrogenSulfide: String?
    var pid: String?
    var chemicalReadings: [ShapeChemicalReading]

    var doseRate: String?
    var background: String?
    var shielding: String?
    var radLatitude: String?
    var radLongitude: String?
    var radDoseUnit: String?
    var radExposureUnit: String?

    var pH: Double?

    init(domain: GeoSimShape) {
        self.description = domain.description
        self.kind = APIShapeKind(domain: domain.kind)
        self.sortOrder = domain.sortOrder
        self.displayColorHex = domain.displayColorHex
        self.shapeGeoJSON = domain.shapeGeoJSON
        self.radiusM = nil // For circles, embed center point in GeoJSON + set radius in future UI/API.

        self.oxygen = domain.oxygen
        self.lel = domain.lel
        self.carbonMonoxide = domain.carbonMonoxide
        self.hydrogenSulfide = domain.hydrogenSulfide
        self.pid = domain.pid
        self.chemicalReadings = domain.chemicalReadings

        self.doseRate = domain.doseRate
        self.background = domain.background
        self.shielding = domain.shielding
        self.radLatitude = domain.radLatitude
        self.radLongitude = domain.radLongitude
        self.radDoseUnit = domain.radDoseUnit
        self.radExposureUnit = domain.radExposureUnit

        self.pH = domain.pH
    }
}

struct APITrackingPointDTO: Codable, Hashable, Sendable, Identifiable {
    var id: UUID
    var scenarioName: String
    var traineeID: String
    var latitude: Double
    var longitude: Double
    var detectionDevice: APIDeviceType?
    var createdAt: Date
    var monitorType: String?
    var monitorProfileID: String?
    var monitorDeviceName: String?
    var monitorSensorLayout: [String]?
    var samplingBand: String?
    var samplingBandLabel: String?
    var secondsInCurrentBand: Double?

    func toDomain() -> GeoTrackingPoint {
        GeoTrackingPoint(
            id: id,
            scenarioName: scenarioName,
            traineeID: traineeID,
            latitude: latitude,
            longitude: longitude,
            detectionDevice: detectionDevice?.domainValue,
            createdAt: createdAt,
            monitorType: monitorType,
            monitorProfileID: monitorProfileID,
            monitorDeviceName: monitorDeviceName,
            monitorSensorLayout: monitorSensorLayout ?? [],
            samplingBand: samplingBand,
            samplingBandLabel: samplingBandLabel,
            secondsInCurrentBand: secondsInCurrentBand
        )
    }
}

struct APIWatchParticipantDTO: Codable, Hashable, Sendable, Identifiable {
    struct LatestPoint: Codable, Hashable, Sendable {
        var participantID: UUID
        var recordedAt: Date
        var receivedAt: Date?
        var lat: Double
        var lon: Double
        var accuracyM: Double?
        var activeShapeID: UUID?
        var activeShapeSortOrder: Int?
        var isBackfilled: Bool

        private enum CodingKeys: String, CodingKey {
            case participantID = "participantId"
            case recordedAt
            case receivedAt
            case lat
            case lon
            case accuracyM
            case activeShapeID = "activeShapeId"
            case activeShapeSortOrder
            case isBackfilled
        }
    }

    var id: UUID
    var traineeName: String
    var deviceType: APIDeviceType?
    var joinedAt: Date
    var lastSeenAt: Date?
    var latestPoint: LatestPoint?

    private enum CodingKeys: String, CodingKey {
        case id = "participantId"
        case traineeName
        case deviceType
        case joinedAt
        case lastSeenAt
        case latestPoint
    }

    func toDomain() -> SessionTrackingParticipant {
        SessionTrackingParticipant(
            id: id,
            traineeName: traineeName,
            deviceType: deviceType?.domainValue,
            joinedAt: joinedAt,
            lastSeenAt: lastSeenAt,
            latestPoint: latestPoint.map {
                SessionTrackingParticipant.LatestPoint(
                    recordedAt: $0.recordedAt,
                    receivedAt: $0.receivedAt,
                    latitude: $0.lat,
                    longitude: $0.lon,
                    accuracyM: $0.accuracyM,
                    isBackfilled: $0.isBackfilled
                )
            }
        )
    }
}

struct APIWatchTrackingPointDTO: Codable, Hashable, Sendable {
    var participantID: UUID
    var recordedAt: Date
    var receivedAt: Date?
    var lat: Double
    var lon: Double
    var accuracyM: Double?
    var activeShapeID: UUID?
    var activeShapeSortOrder: Int?
    var isBackfilled: Bool

    private enum CodingKeys: String, CodingKey {
        case participantID = "participantId"
        case recordedAt
        case receivedAt
        case lat
        case lon
        case accuracyM
        case activeShapeID = "activeShapeId"
        case activeShapeSortOrder
        case isBackfilled
    }

    func toDomain(participantNamesByID: [UUID: String]) -> GeoTrackingPoint {
        GeoTrackingPoint(
            scenarioName: "",
            traineeID: participantNamesByID[participantID] ?? participantID.uuidString,
            latitude: lat,
            longitude: lon,
            createdAt: recordedAt
        )
    }
}

struct APIWatchTrackingEnvelopeDTO: Codable, Hashable, Sendable {
    var items: [APIWatchTrackingPointDTO]
    var nextCursor: Date?
}

struct APIWatchZoneEventDTO: Codable, Hashable, Sendable, Identifiable {
    var id: UUID
    var participantID: UUID
    var traineeName: String
    var deviceType: APIDeviceType?
    var shapeID: UUID?
    var shapeSortOrder: Int?
    var zoneName: String
    var enteredAt: Date
    var exitedAt: Date
    var durationSeconds: Double
    var receivedAt: Date?

    private enum CodingKeys: String, CodingKey {
        case id = "clientEventId"
        case participantID = "participantId"
        case traineeName
        case deviceType
        case shapeID = "shapeId"
        case shapeSortOrder
        case zoneName
        case enteredAt
        case exitedAt
        case durationSeconds
        case receivedAt
    }

    func toDomain() -> SessionZoneEvent {
        SessionZoneEvent(
            id: id,
            participantID: participantID,
            traineeName: traineeName,
            deviceType: deviceType?.domainValue,
            shapeID: shapeID,
            shapeSortOrder: shapeSortOrder,
            zoneName: zoneName,
            enteredAt: enteredAt,
            exitedAt: exitedAt,
            durationSeconds: durationSeconds,
            receivedAt: receivedAt
        )
    }
}

struct APIWatchZoneEventEnvelopeDTO: Codable, Hashable, Sendable {
    var items: [APIWatchZoneEventDTO]
    var nextCursor: Date?
}

// Trainee session join and tracking upload DTOs (for later integration in HazmatTrainee app).
struct APIJoinSessionRequest: Codable, Sendable {
    var joinCode: String
    var traineeName: String
    var deviceType: APIDeviceType
}

struct APIJoinSessionResponse: Codable, Sendable {
    struct SessionInfo: Codable, Sendable {
        var id: UUID
        var status: APISessionStatus
        var startsAt: Date?
    }

    struct ParticipantInfo: Codable, Sendable {
        var id: UUID
        var traineeName: String
        var deviceType: APIDeviceType
    }

    struct TokenInfo: Codable, Sendable {
        var accessToken: String
        var expiresAt: Date
    }

    var session: SessionInfo
    var participant: ParticipantInfo
    var token: TokenInfo
    var snapshot: APISessionSnapshotDTO
}

struct APISessionSnapshotDTO: Codable, Sendable {
    struct Rules: Codable, Sendable {
        var overlapPriority: String
    }

    var sessionID: UUID
    var scenario: APIScenarioDTO
    var shapes: [APIShapeDTO]
    var rules: Rules

    private enum CodingKeys: String, CodingKey {
        case sessionID = "sessionId"
        case scenario
        case shapes
        case rules
    }
}

struct APITrackingBatchRequest: Codable, Sendable {
    struct Point: Codable, Sendable {
        var clientPointID: UUID
        var recordedAt: Date
        var lat: Double
        var lon: Double
        var accuracyM: Double?
        var speedMps: Double?
        var headingDeg: Double?
        var activeShapeID: UUID?
        var activeShapeSortOrder: Int?
    }

    var batchID: UUID
    var points: [Point]
}

struct APITrackingBatchResponse: Codable, Sendable {
    var accepted: Int
    var duplicates: Int
    var serverTime: Date
}
