import Foundation

struct ChemicalCatalogItem: Identifiable, Codable, Hashable {
    var id: String { abbr }
    let name: String
    let abbr: String
    let units: [String]
}

enum ChemicalCatalog {
    static let all: [ChemicalCatalogItem] = [
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

    static let defaultsForFourGas: [ChemicalCatalogItem] = ["O2", "CO", "H2S", "LEL"].compactMap { abbr in
        all.first(where: { $0.abbr == abbr })
    }
}
