import Foundation

enum AirMonitorSamplingBand: String, Codable, Hashable {
    case low
    case normal
    case high
}

enum AirMonitorSamplingAdjustmentMode: String, Codable, Hashable {
    case normal
    case lower
}

struct AirMonitorSamplingBandAdjustment: Codable, Hashable {
    var mode: AirMonitorSamplingAdjustmentMode
    var featherPercent: Double

    static let unchanged = AirMonitorSamplingBandAdjustment(mode: .normal, featherPercent: 0)
}

struct AirMonitorSamplingChannelAdjustment: Codable, Hashable {
    var high: AirMonitorSamplingBandAdjustment
    var low: AirMonitorSamplingBandAdjustment

    static let unchanged = AirMonitorSamplingChannelAdjustment(high: .unchanged, low: .unchanged)
}

struct ScenarioZoneAirMonitorSampling: Codable, Hashable {
    var oxygen: AirMonitorSamplingChannelAdjustment?
    var lel: AirMonitorSamplingChannelAdjustment?
    var co: AirMonitorSamplingChannelAdjustment?
    var h2s: AirMonitorSamplingChannelAdjustment?
    var pid: AirMonitorSamplingChannelAdjustment?

    func adjustment(for channel: String) -> AirMonitorSamplingChannelAdjustment {
        switch channel.uppercased() {
        case "O2":
            return oxygen ?? .unchanged
        case "LEL":
            return lel ?? .unchanged
        case "CO":
            return co ?? .unchanged
        case "H2S":
            return h2s ?? .unchanged
        case "VOC", "PID":
            return pid ?? .unchanged
        default:
            return .unchanged
        }
    }
}

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
    let airMonitorSampling: ScenarioZoneAirMonitorSampling?

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

    var isAirMonitor: Bool {
        switch self {
        case .fourGasPID, .fourGas:
            return true
        case .radiation, .phPaper:
            return false
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
    case airMonitorBuilder
    case gasSimulator
    case radiationSimulator
    case phSimulator
}

struct TraineeAirMonitorSensorSlot: Identifiable, Hashable, Codable {
    var id = UUID()
    var catalogAbbr: String
    var unit: String
}

struct TraineeAirMonitorProfile: Identifiable, Hashable, Codable {
    var id = UUID()
    var name: String
    var baseMonitor: MonitorType
    var sensors: [TraineeAirMonitorSensorSlot]
}

enum AirMonitorAlarmState: Hashable {
    case normal
    case low
    case high
}
