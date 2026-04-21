import Foundation

struct Scenario: Identifiable, Codable, Hashable {
    struct RadiationSource: Codable, Hashable {
        var doseAt1mRph: Double
        var backgroundRph: Double
        var shielding: Double
    }

    let id: String
    let name: String
    let date: Date
    let notes: String
    let radiationSource: RadiationSource
    let zones: [ScenarioZone]
}

struct ScenarioZone: Identifiable, Codable, Hashable {
    let name: String
    let oxygen: Double
    let lel: Double
    let co: Double
    let h2s: Double
    let pid: Double
    let ph: Double

    var id: String { name }
}

enum MonitorType: String, CaseIterable, Identifiable, Codable {
    case fourGasPID = "4 Gas + PID"
    case fourGas = "4 Gas"
    case radiation = "Radiation Monitor"
    case phPaper = "pH Paper"

    var id: String { rawValue }

    var displayDescription: String {
        switch self {
        case .fourGasPID: return "O2, LEL, CO, H2S, VOC/PID"
        case .fourGas: return "O2, LEL, CO, H2S"
        case .radiation: return "Dose-rate search trainer"
        case .phPaper: return "pH color strip trainer"
        }
    }
}

struct GasReadings: Hashable {
    var oxygen: Double
    var lel: Double
    var co: Double
    var h2s: Double
    var pid: Double

    static let baseline = GasReadings(oxygen: 20.8, lel: 0, co: 0, h2s: 0, pid: 0)
}

enum AppScreen: Hashable {
    case scenarios
    case tools
    case gasSimulator
    case radiationSimulator
    case phSimulator
}
