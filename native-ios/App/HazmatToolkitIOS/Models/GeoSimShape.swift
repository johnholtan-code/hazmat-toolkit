import Foundation

struct GeoSimShape: Identifiable, Codable, Hashable {
    enum ShapeKind: String, Codable, Hashable, CaseIterable {
        case polygon
        case circle
        case point
    }

    var id: UUID
    var scenarioID: UUID
    var description: String
    var shapeGeoJSON: String
    var displayColorHex: String?
    var sortOrder: Int
    var kind: ShapeKind

    // Air monitor readings
    var oxygen: String?
    var lel: String?
    var carbonMonoxide: String?
    var hydrogenSulfide: String?
    var pid: String?
    var chemicalReadings: [ShapeChemicalReading]

    // Oxygen sampling modes and feather percentages
    var oxygenHighSamplingMode: String?
    var oxygenHighFeatherPercent: Double?
    var oxygenLowSamplingMode: String?
    var oxygenLowFeatherPercent: Double?

    // LEL sampling modes and feather percentages
    var lelHighSamplingMode: String?
    var lelHighFeatherPercent: Double?
    var lelLowSamplingMode: String?
    var lelLowFeatherPercent: Double?

    // Carbon monoxide sampling modes and feather percentages
    var carbonMonoxideHighSamplingMode: String?
    var carbonMonoxideHighFeatherPercent: Double?
    var carbonMonoxideLowSamplingMode: String?
    var carbonMonoxideLowFeatherPercent: Double?

    // Hydrogen sulfide sampling modes and feather percentages
    var hydrogenSulfideHighSamplingMode: String?
    var hydrogenSulfideHighFeatherPercent: Double?
    var hydrogenSulfideLowSamplingMode: String?
    var hydrogenSulfideLowFeatherPercent: Double?

    // PID sampling modes and feather percentages
    var pidHighSamplingMode: String?
    var pidHighFeatherPercent: Double?
    var pidLowSamplingMode: String?
    var pidLowFeatherPercent: Double?

    // Radiation readings
    var doseRate: String?
    var background: String?
    var shielding: String?
    var radLatitude: String?
    var radLongitude: String?
    var radDoseUnit: String?
    var radExposureUnit: String?

    // pH readings
    var pH: Double?

    init(
        id: UUID = UUID(),
        scenarioID: UUID,
        description: String,
        shapeGeoJSON: String,
        displayColorHex: String? = nil,
        sortOrder: Int,
        kind: ShapeKind = .polygon,
        oxygen: String? = nil,
        lel: String? = nil,
        carbonMonoxide: String? = nil,
        hydrogenSulfide: String? = nil,
        pid: String? = nil,
        chemicalReadings: [ShapeChemicalReading] = [],
        oxygenHighSamplingMode: String? = nil,
        oxygenHighFeatherPercent: Double? = nil,
        oxygenLowSamplingMode: String? = nil,
        oxygenLowFeatherPercent: Double? = nil,
        lelHighSamplingMode: String? = nil,
        lelHighFeatherPercent: Double? = nil,
        lelLowSamplingMode: String? = nil,
        lelLowFeatherPercent: Double? = nil,
        carbonMonoxideHighSamplingMode: String? = nil,
        carbonMonoxideHighFeatherPercent: Double? = nil,
        carbonMonoxideLowSamplingMode: String? = nil,
        carbonMonoxideLowFeatherPercent: Double? = nil,
        hydrogenSulfideHighSamplingMode: String? = nil,
        hydrogenSulfideHighFeatherPercent: Double? = nil,
        hydrogenSulfideLowSamplingMode: String? = nil,
        hydrogenSulfideLowFeatherPercent: Double? = nil,
        pidHighSamplingMode: String? = nil,
        pidHighFeatherPercent: Double? = nil,
        pidLowSamplingMode: String? = nil,
        pidLowFeatherPercent: Double? = nil,
        doseRate: String? = nil,
        background: String? = nil,
        shielding: String? = nil,
        radLatitude: String? = nil,
        radLongitude: String? = nil,
        radDoseUnit: String? = nil,
        radExposureUnit: String? = nil,
        pH: Double? = nil
    ) {
        self.id = id
        self.scenarioID = scenarioID
        self.description = description
        self.shapeGeoJSON = shapeGeoJSON
        self.displayColorHex = displayColorHex
        self.sortOrder = sortOrder
        self.kind = kind
        self.oxygen = oxygen
        self.lel = lel
        self.carbonMonoxide = carbonMonoxide
        self.hydrogenSulfide = hydrogenSulfide
        self.pid = pid
        self.chemicalReadings = chemicalReadings
        self.oxygenHighSamplingMode = oxygenHighSamplingMode
        self.oxygenHighFeatherPercent = oxygenHighFeatherPercent
        self.oxygenLowSamplingMode = oxygenLowSamplingMode
        self.oxygenLowFeatherPercent = oxygenLowFeatherPercent
        self.lelHighSamplingMode = lelHighSamplingMode
        self.lelHighFeatherPercent = lelHighFeatherPercent
        self.lelLowSamplingMode = lelLowSamplingMode
        self.lelLowFeatherPercent = lelLowFeatherPercent
        self.carbonMonoxideHighSamplingMode = carbonMonoxideHighSamplingMode
        self.carbonMonoxideHighFeatherPercent = carbonMonoxideHighFeatherPercent
        self.carbonMonoxideLowSamplingMode = carbonMonoxideLowSamplingMode
        self.carbonMonoxideLowFeatherPercent = carbonMonoxideLowFeatherPercent
        self.hydrogenSulfideHighSamplingMode = hydrogenSulfideHighSamplingMode
        self.hydrogenSulfideHighFeatherPercent = hydrogenSulfideHighFeatherPercent
        self.hydrogenSulfideLowSamplingMode = hydrogenSulfideLowSamplingMode
        self.hydrogenSulfideLowFeatherPercent = hydrogenSulfideLowFeatherPercent
        self.pidHighSamplingMode = pidHighSamplingMode
        self.pidHighFeatherPercent = pidHighFeatherPercent
        self.pidLowSamplingMode = pidLowSamplingMode
        self.pidLowFeatherPercent = pidLowFeatherPercent
        self.doseRate = doseRate
        self.background = background
        self.shielding = shielding
        self.radLatitude = radLatitude
        self.radLongitude = radLongitude
        self.radDoseUnit = radDoseUnit
        self.radExposureUnit = radExposureUnit
        self.pH = pH
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case scenarioID
        case description
        case shapeGeoJSON
        case displayColorHex
        case sortOrder
        case kind
        case oxygen
        case lel
        case carbonMonoxide
        case hydrogenSulfide
        case pid
        case chemicalReadings
        case oxygenHighSamplingMode
        case oxygenHighFeatherPercent
        case oxygenLowSamplingMode
        case oxygenLowFeatherPercent
        case lelHighSamplingMode
        case lelHighFeatherPercent
        case lelLowSamplingMode
        case lelLowFeatherPercent
        case carbonMonoxideHighSamplingMode
        case carbonMonoxideHighFeatherPercent
        case carbonMonoxideLowSamplingMode
        case carbonMonoxideLowFeatherPercent
        case hydrogenSulfideHighSamplingMode
        case hydrogenSulfideHighFeatherPercent
        case hydrogenSulfideLowSamplingMode
        case hydrogenSulfideLowFeatherPercent
        case pidHighSamplingMode
        case pidHighFeatherPercent
        case pidLowSamplingMode
        case pidLowFeatherPercent
        case doseRate
        case background
        case shielding
        case radLatitude
        case radLongitude
        case radDoseUnit
        case radExposureUnit
        case pH
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Required fields with sensible fallbacks if absent/corrupt
        self.id = try container.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        self.scenarioID = try container.decode(UUID.self, forKey: .scenarioID)
        self.description = try container.decodeIfPresent(String.self, forKey: .description) ?? ""
        self.shapeGeoJSON = try container.decodeIfPresent(String.self, forKey: .shapeGeoJSON) ?? ""
        self.displayColorHex = try container.decodeIfPresent(String.self, forKey: .displayColorHex)
        self.sortOrder = try container.decodeIfPresent(Int.self, forKey: .sortOrder) ?? 0
        self.kind = try container.decodeIfPresent(ShapeKind.self, forKey: .kind) ?? .polygon

        // Optionals
        self.oxygen = try container.decodeIfPresent(String.self, forKey: .oxygen)
        self.lel = try container.decodeIfPresent(String.self, forKey: .lel)
        self.carbonMonoxide = try container.decodeIfPresent(String.self, forKey: .carbonMonoxide)
        self.hydrogenSulfide = try container.decodeIfPresent(String.self, forKey: .hydrogenSulfide)
        self.pid = try container.decodeIfPresent(String.self, forKey: .pid)

        // Attempt to decode chemicalReadings; default to empty array if missing
        self.chemicalReadings = (try container.decodeIfPresent([ShapeChemicalReading].self, forKey: .chemicalReadings)) ?? []

        // Oxygen sampling modes and feather percentages
        self.oxygenHighSamplingMode = try container.decodeIfPresent(String.self, forKey: .oxygenHighSamplingMode)
        self.oxygenHighFeatherPercent = try container.decodeIfPresent(Double.self, forKey: .oxygenHighFeatherPercent)
        self.oxygenLowSamplingMode = try container.decodeIfPresent(String.self, forKey: .oxygenLowSamplingMode)
        self.oxygenLowFeatherPercent = try container.decodeIfPresent(Double.self, forKey: .oxygenLowFeatherPercent)

        // LEL sampling modes and feather percentages
        self.lelHighSamplingMode = try container.decodeIfPresent(String.self, forKey: .lelHighSamplingMode)
        self.lelHighFeatherPercent = try container.decodeIfPresent(Double.self, forKey: .lelHighFeatherPercent)
        self.lelLowSamplingMode = try container.decodeIfPresent(String.self, forKey: .lelLowSamplingMode)
        self.lelLowFeatherPercent = try container.decodeIfPresent(Double.self, forKey: .lelLowFeatherPercent)

        // Carbon monoxide sampling modes and feather percentages
        self.carbonMonoxideHighSamplingMode = try container.decodeIfPresent(String.self, forKey: .carbonMonoxideHighSamplingMode)
        self.carbonMonoxideHighFeatherPercent = try container.decodeIfPresent(Double.self, forKey: .carbonMonoxideHighFeatherPercent)
        self.carbonMonoxideLowSamplingMode = try container.decodeIfPresent(String.self, forKey: .carbonMonoxideLowSamplingMode)
        self.carbonMonoxideLowFeatherPercent = try container.decodeIfPresent(Double.self, forKey: .carbonMonoxideLowFeatherPercent)

        // Hydrogen sulfide sampling modes and feather percentages
        self.hydrogenSulfideHighSamplingMode = try container.decodeIfPresent(String.self, forKey: .hydrogenSulfideHighSamplingMode)
        self.hydrogenSulfideHighFeatherPercent = try container.decodeIfPresent(Double.self, forKey: .hydrogenSulfideHighFeatherPercent)
        self.hydrogenSulfideLowSamplingMode = try container.decodeIfPresent(String.self, forKey: .hydrogenSulfideLowSamplingMode)
        self.hydrogenSulfideLowFeatherPercent = try container.decodeIfPresent(Double.self, forKey: .hydrogenSulfideLowFeatherPercent)

        // PID sampling modes and feather percentages
        self.pidHighSamplingMode = try container.decodeIfPresent(String.self, forKey: .pidHighSamplingMode)
        self.pidHighFeatherPercent = try container.decodeIfPresent(Double.self, forKey: .pidHighFeatherPercent)
        self.pidLowSamplingMode = try container.decodeIfPresent(String.self, forKey: .pidLowSamplingMode)
        self.pidLowFeatherPercent = try container.decodeIfPresent(Double.self, forKey: .pidLowFeatherPercent)

        // Radiation readings
        self.doseRate = try container.decodeIfPresent(String.self, forKey: .doseRate)
        self.background = try container.decodeIfPresent(String.self, forKey: .background)
        self.shielding = try container.decodeIfPresent(String.self, forKey: .shielding)
        self.radLatitude = try container.decodeIfPresent(String.self, forKey: .radLatitude)
        self.radLongitude = try container.decodeIfPresent(String.self, forKey: .radLongitude)
        self.radDoseUnit = try container.decodeIfPresent(String.self, forKey: .radDoseUnit)
        self.radExposureUnit = try container.decodeIfPresent(String.self, forKey: .radExposureUnit)

        // pH
        self.pH = try container.decodeIfPresent(Double.self, forKey: .pH)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(scenarioID, forKey: .scenarioID)
        try container.encode(description, forKey: .description)
        try container.encode(shapeGeoJSON, forKey: .shapeGeoJSON)
        try container.encodeIfPresent(displayColorHex, forKey: .displayColorHex)
        try container.encode(sortOrder, forKey: .sortOrder)
        try container.encode(kind, forKey: .kind)
        try container.encodeIfPresent(oxygen, forKey: .oxygen)
        try container.encodeIfPresent(lel, forKey: .lel)
        try container.encodeIfPresent(carbonMonoxide, forKey: .carbonMonoxide)
        try container.encodeIfPresent(hydrogenSulfide, forKey: .hydrogenSulfide)
        try container.encodeIfPresent(pid, forKey: .pid)
        try container.encode(chemicalReadings, forKey: .chemicalReadings)
        try container.encodeIfPresent(oxygenHighSamplingMode, forKey: .oxygenHighSamplingMode)
        try container.encodeIfPresent(oxygenHighFeatherPercent, forKey: .oxygenHighFeatherPercent)
        try container.encodeIfPresent(oxygenLowSamplingMode, forKey: .oxygenLowSamplingMode)
        try container.encodeIfPresent(oxygenLowFeatherPercent, forKey: .oxygenLowFeatherPercent)
        try container.encodeIfPresent(lelHighSamplingMode, forKey: .lelHighSamplingMode)
        try container.encodeIfPresent(lelHighFeatherPercent, forKey: .lelHighFeatherPercent)
        try container.encodeIfPresent(lelLowSamplingMode, forKey: .lelLowSamplingMode)
        try container.encodeIfPresent(lelLowFeatherPercent, forKey: .lelLowFeatherPercent)
        try container.encodeIfPresent(carbonMonoxideHighSamplingMode, forKey: .carbonMonoxideHighSamplingMode)
        try container.encodeIfPresent(carbonMonoxideHighFeatherPercent, forKey: .carbonMonoxideHighFeatherPercent)
        try container.encodeIfPresent(carbonMonoxideLowSamplingMode, forKey: .carbonMonoxideLowSamplingMode)
        try container.encodeIfPresent(carbonMonoxideLowFeatherPercent, forKey: .carbonMonoxideLowFeatherPercent)
        try container.encodeIfPresent(hydrogenSulfideHighSamplingMode, forKey: .hydrogenSulfideHighSamplingMode)
        try container.encodeIfPresent(hydrogenSulfideHighFeatherPercent, forKey: .hydrogenSulfideHighFeatherPercent)
        try container.encodeIfPresent(hydrogenSulfideLowSamplingMode, forKey: .hydrogenSulfideLowSamplingMode)
        try container.encodeIfPresent(hydrogenSulfideLowFeatherPercent, forKey: .hydrogenSulfideLowFeatherPercent)
        try container.encodeIfPresent(pidHighSamplingMode, forKey: .pidHighSamplingMode)
        try container.encodeIfPresent(pidHighFeatherPercent, forKey: .pidHighFeatherPercent)
        try container.encodeIfPresent(pidLowSamplingMode, forKey: .pidLowSamplingMode)
        try container.encodeIfPresent(pidLowFeatherPercent, forKey: .pidLowFeatherPercent)
        try container.encodeIfPresent(doseRate, forKey: .doseRate)
        try container.encodeIfPresent(background, forKey: .background)
        try container.encodeIfPresent(shielding, forKey: .shielding)
        try container.encodeIfPresent(radLatitude, forKey: .radLatitude)
        try container.encodeIfPresent(radLongitude, forKey: .radLongitude)
        try container.encodeIfPresent(radDoseUnit, forKey: .radDoseUnit)
        try container.encodeIfPresent(radExposureUnit, forKey: .radExposureUnit)
        try container.encodeIfPresent(pH, forKey: .pH)
    }
}
extension GeoSimShape: Equatable {
    static func == (lhs: GeoSimShape, rhs: GeoSimShape) -> Bool {
        lhs.id == rhs.id
    }
}
