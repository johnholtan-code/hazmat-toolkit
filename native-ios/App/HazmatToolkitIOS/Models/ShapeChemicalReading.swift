import Foundation

public struct ShapeChemicalReading: Identifiable, Codable, Hashable {
    public var id: UUID
    public var name: String
    public var abbr: String
    public var value: String
    public var unit: String

    public init(
        id: UUID = UUID(),
        name: String,
        abbr: String,
        value: String,
        unit: String
    ) {
        self.id = id
        self.name = name
        self.abbr = abbr
        self.value = value
        self.unit = unit
    }
}
