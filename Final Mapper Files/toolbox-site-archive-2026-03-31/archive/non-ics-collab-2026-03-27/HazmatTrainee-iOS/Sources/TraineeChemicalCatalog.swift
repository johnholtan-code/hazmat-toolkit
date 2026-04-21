import Foundation

struct TraineeChemicalCatalogItem: Identifiable, Codable, Hashable {
    var id: String { abbr }
    let name: String
    let abbr: String
    let units: [String]
}

struct AlarmSet: Codable, Hashable {
    var low: Double?
    var high: Double?
    var stel: Double?
    var twa: Double?
}

struct UnitAlarmMap: Codable, Hashable {
    var byUnit: [String: AlarmSet]
}

enum TraineeChemicalCatalog {
    static let all: [TraineeChemicalCatalogItem] = [
        .init(name: "Oxygen", abbr: "O2", units: ["%vol"]),
        .init(name: "Lower Explosive Limit", abbr: "LEL", units: ["%LEL"]),
        .init(name: "Methane", abbr: "CH4", units: ["%LEL", "%vol"]),
        .init(name: "Hydrogen Sulfide", abbr: "H2S", units: ["ppm"]),
        .init(name: "Carbon Monoxide", abbr: "CO", units: ["ppm"]),
        .init(name: "Carbon Dioxide", abbr: "CO2", units: ["ppm", "%vol"]),
        .init(name: "Propane", abbr: "C3H8", units: ["%LEL"]),
        .init(name: "Butane", abbr: "C4H10", units: ["%LEL"]),
        .init(name: "Hydrogen", abbr: "H2", units: ["%LEL", "ppm"]),
        .init(name: "Acetylene", abbr: "C2H2", units: ["%LEL"]),
        .init(name: "Ethylene", abbr: "C2H4", units: ["%LEL"]),
        .init(name: "Natural Gas (primarily Methane blend)", abbr: "NG/CH4", units: ["%LEL", "%vol"]),
        .init(name: "Chlorine", abbr: "Cl2", units: ["ppm"]),
        .init(name: "Ammonia", abbr: "NH3", units: ["ppm"]),
        .init(name: "Sulfur Dioxide", abbr: "SO2", units: ["ppm"]),
        .init(name: "Hydrogen Cyanide", abbr: "HCN", units: ["ppm"]),
        .init(name: "Nitrogen Dioxide", abbr: "NO2", units: ["ppm"]),
        .init(name: "Nitric Oxide", abbr: "NO", units: ["ppm"]),
        .init(name: "Phosphine", abbr: "PH3", units: ["ppm"]),
        .init(name: "Hydrogen Chloride", abbr: "HCl", units: ["ppm"]),
        .init(name: "Ozone", abbr: "O3", units: ["ppm"]),
        .init(name: "Volatile Organic Compounds", abbr: "VOC", units: ["ppm"]),
        .init(name: "Benzene", abbr: "C6H6", units: ["ppm"]),
        .init(name: "Toluene", abbr: "C7H8", units: ["ppm"]),
        .init(name: "Xylene", abbr: "C8H10", units: ["ppm"]),
        .init(name: "Styrene", abbr: "C8H8", units: ["ppm"]),
        .init(name: "Formaldehyde", abbr: "CH2O", units: ["ppm"]),
        .init(name: "Arsine", abbr: "AsH3", units: ["ppm"]),
        .init(name: "Silane", abbr: "SiH4", units: ["ppm", "%LEL"]),
        .init(name: "Chlorine Dioxide", abbr: "ClO2", units: ["ppm"]),
        .init(name: "Ethylene Oxide", abbr: "EtO (C2H4O)", units: ["ppm"]),
        .init(name: "Mercury Vapor", abbr: "Hg", units: ["mg/m3", "ug/m3"])
    ]

    static let defaultsForFourGas: [TraineeChemicalCatalogItem] = ["O2", "CO", "H2S", "LEL"].compactMap { abbr in
        all.first(where: { $0.abbr == abbr })
    }
}

enum AlarmPreset {
    // Training defaults: override per company/site.
    static let defaults: [String: UnitAlarmMap] = [
        "O2": .init(byUnit: ["%vol": .init(low: 19.5, high: 23.5, stel: nil, twa: nil)]),
        "LEL": .init(byUnit: ["%LEL": .init(low: 10, high: 20, stel: nil, twa: nil)]),
        "CH4": .init(byUnit: [
            "%LEL": .init(low: 10, high: 20, stel: nil, twa: nil),
            "%vol": .init(low: 1.0, high: 2.0, stel: nil, twa: nil)
        ]),
        "NG/CH4": .init(byUnit: [
            "%LEL": .init(low: 10, high: 20, stel: nil, twa: nil),
            "%vol": .init(low: 1.0, high: 2.0, stel: nil, twa: nil)
        ]),
        "H2S": .init(byUnit: ["ppm": .init(low: 10, high: 15, stel: 15, twa: 10)]),
        "CO": .init(byUnit: ["ppm": .init(low: 35, high: 200, stel: 200, twa: 35)]),
        "CO2": .init(byUnit: [
            "ppm": .init(low: 5000, high: 30000, stel: 30000, twa: 5000),
            "%vol": .init(low: 0.5, high: 3.0, stel: 3.0, twa: 0.5)
        ]),
        "C3H8": .init(byUnit: ["%LEL": .init(low: 10, high: 20, stel: nil, twa: nil)]),
        "C4H10": .init(byUnit: ["%LEL": .init(low: 10, high: 20, stel: nil, twa: nil)]),
        "H2": .init(byUnit: [
            "%LEL": .init(low: 10, high: 20, stel: nil, twa: nil),
            "ppm": .init(low: 100, high: 500, stel: nil, twa: nil)
        ]),
        "C2H2": .init(byUnit: ["%LEL": .init(low: 10, high: 20, stel: nil, twa: nil)]),
        "C2H4": .init(byUnit: ["%LEL": .init(low: 10, high: 20, stel: nil, twa: nil)]),
        "Cl2": .init(byUnit: ["ppm": .init(low: 0.5, high: 1.0, stel: 1.0, twa: 0.5)]),
        "NH3": .init(byUnit: ["ppm": .init(low: 25, high: 50, stel: 35, twa: 25)]),
        "SO2": .init(byUnit: ["ppm": .init(low: 2, high: 5, stel: 5, twa: 2)]),
        "HCN": .init(byUnit: ["ppm": .init(low: 4.7, high: 10, stel: 10, twa: 4.7)]),
        "NO2": .init(byUnit: ["ppm": .init(low: 3, high: 5, stel: 5, twa: 3)]),
        "NO": .init(byUnit: ["ppm": .init(low: 25, high: 50, stel: 50, twa: 25)]),
        "PH3": .init(byUnit: ["ppm": .init(low: 0.3, high: 1.0, stel: 1.0, twa: 0.3)]),
        "HCl": .init(byUnit: ["ppm": .init(low: 2, high: 5, stel: 5, twa: 2)]),
        "O3": .init(byUnit: ["ppm": .init(low: 0.1, high: 0.3, stel: 0.3, twa: 0.1)]),
        "VOC": .init(byUnit: ["ppm": .init(low: 50, high: 100, stel: nil, twa: nil)]),
        "C6H6": .init(byUnit: ["ppm": .init(low: 0.5, high: 1.0, stel: 1.0, twa: 0.5)]),
        "C7H8": .init(byUnit: ["ppm": .init(low: 20, high: 50, stel: 50, twa: 20)]),
        "C8H10": .init(byUnit: ["ppm": .init(low: 100, high: 150, stel: 150, twa: 100)]),
        "C8H8": .init(byUnit: ["ppm": .init(low: 20, high: 50, stel: 50, twa: 20)]),
        "CH2O": .init(byUnit: ["ppm": .init(low: 0.3, high: 1.0, stel: 1.0, twa: 0.3)]),
        "AsH3": .init(byUnit: ["ppm": .init(low: 0.05, high: 0.2, stel: 0.2, twa: 0.05)]),
        "SiH4": .init(byUnit: [
            "ppm": .init(low: 5, high: 10, stel: nil, twa: nil),
            "%LEL": .init(low: 10, high: 20, stel: nil, twa: nil)
        ]),
        "ClO2": .init(byUnit: ["ppm": .init(low: 0.1, high: 0.3, stel: 0.3, twa: 0.1)]),
        "EtO (C2H4O)": .init(byUnit: ["ppm": .init(low: 0.5, high: 1.0, stel: 1.0, twa: 0.5)]),
        "Hg": .init(byUnit: [
            "mg/m3": .init(low: 0.025, high: 0.05, stel: 0.05, twa: 0.025),
            "ug/m3": .init(low: 25, high: 50, stel: 50, twa: 25)
        ])
    ]
}
