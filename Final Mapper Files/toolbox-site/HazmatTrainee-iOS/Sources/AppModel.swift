import Foundation
import SwiftUI

@MainActor
final class AppModel: ObservableObject {
    @Published var didFinishSplash = false
    @Published var traineeName = ""
    @Published var scenarios: [Scenario] = []
    @Published var selectedScenario: Scenario?
    @Published var selectedMonitor: MonitorType?
    @Published var selectedZoneName: String = "OUT"

    @Published var gasReadings: GasReadings = .baseline
    @Published var doseRateRph: Double = 0
    @Published var doseAt1mRph: Double = 0.025
    @Published var backgroundRph: Double = 0.000015
    @Published var shielding: Double = 1.0
    @Published var minRadiusM: Double = 0.5

    @Published var phDisplay: Double = 7
    @Published var phTarget: Double = 7

    @Published var navPath = NavigationPath()

    let phFacts: [Int: String] = [
        0: "Hydrochloric acid - highly corrosive",
        1: "Battery acid - extremely acidic and dangerous",
        2: "Gastric acid - found in the human stomach",
        3: "Vinegar - used in cooking and cleaning",
        4: "Tomato juice - mildly acidic",
        5: "Black coffee - acidic beverage",
        6: "Urine or milk - slightly acidic",
        7: "Pure water - neutral substance",
        8: "Egg whites - slightly alkaline",
        9: "Baking soda - commonly used alkaline",
        10: "Great for cleaning - mild alkali",
        11: "Ammonia solution - strong cleaning agent",
        12: "Soapy water - moderately alkaline",
        13: "Bleach - highly alkaline and corrosive",
        14: "Sodium hydroxide - caustic soda (lye)"
    ]

    init() {
        loadSampleScenarios()
        resetSimulatorDefaults()
    }

    func loadSampleScenarios() {
        guard let url = Bundle.main.url(forResource: "SampleScenarios", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            scenarios = []
            return
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .formatted(Self.dateFormatter)
        scenarios = (try? decoder.decode([Scenario].self, from: data)) ?? []
        scenarios.sort { $0.date > $1.date }
    }

    func resetSimulatorDefaults() {
        gasReadings = .baseline
        doseRateRph = 0
        doseAt1mRph = 0.025
        backgroundRph = 0.000015
        shielding = 1.0
        minRadiusM = 0.5
        phDisplay = 7
        phTarget = 7
        selectedZoneName = "OUT"
    }

    func chooseScenario(_ scenario: Scenario) {
        selectedScenario = scenario
        selectedZoneName = scenario.zones.first?.name ?? "OUT"
        gasReadings = .baseline
        doseAt1mRph = scenario.radiationSource.doseAt1mRph
        backgroundRph = scenario.radiationSource.backgroundRph
        shielding = scenario.radiationSource.shielding
        minRadiusM = 0.5
        applyZoneToSimulators(zoneName: selectedZoneName)
    }

    func chooseMonitor(_ monitor: MonitorType) {
        selectedMonitor = monitor
    }

    func applyZoneToSimulators(zoneName: String) {
        selectedZoneName = zoneName
        guard let zone = currentZone else { return }
        gasReadings = GasReadings(
            oxygen: zone.oxygen,
            lel: zone.lel,
            co: zone.co,
            h2s: zone.h2s,
            pid: zone.pid
        )
        phTarget = zone.ph
        phDisplay = zone.ph
    }

    var currentZone: ScenarioZone? {
        selectedScenario?.zones.first { $0.name == selectedZoneName } ?? selectedScenario?.zones.first
    }

    var gasAlarms: [String: Bool] {
        [
            "O2": gasReadings.oxygen < 19.5 || gasReadings.oxygen > 23.4,
            "LEL": gasReadings.lel > 10,
            "CO": gasReadings.co > 35,
            "H2S": gasReadings.h2s > 10,
            "VOC": gasReadings.pid > 50
        ]
    }

    var roundedPHFact: String {
        phFacts[Int(phTarget.rounded())] ?? ""
    }

    func routeForSelectedMonitor() -> AppScreen {
        switch selectedMonitor {
        case .radiation:
            return .radiationSimulator
        case .phPaper:
            return .phSimulator
        default:
            return .gasSimulator
        }
    }

    func simulateGasDrift() {
        guard let zone = currentZone else { return }
        gasReadings.oxygen = drift(from: gasReadings.oxygen, target: zone.oxygen, spread: 0.15, clamp: 0...30)
        gasReadings.lel = drift(from: gasReadings.lel, target: zone.lel, spread: 1.2, clamp: 0...100)
        gasReadings.co = drift(from: gasReadings.co, target: zone.co, spread: 3.0, clamp: 0...500)
        gasReadings.h2s = drift(from: gasReadings.h2s, target: zone.h2s, spread: 1.0, clamp: 0...200)
        gasReadings.pid = drift(from: gasReadings.pid, target: zone.pid, spread: 6.0, clamp: 0...2000)
    }

    func updateRadiation(distanceMeters: Double, guideBias: Double = 1.0) {
        let effectiveDistance = max(distanceMeters, minRadiusM)
        let raw = backgroundRph + ((doseAt1mRph * shielding) / (effectiveDistance * effectiveDistance))
        let noise = raw * Double.random(in: -0.05...0.05) * guideBias
        let sample = max(0, raw + noise)
        doseRateRph = (doseRateRph == 0) ? sample : (doseRateRph * 0.7 + sample * 0.3)
    }

    func syncPHDisplayTowardTarget() {
        let delta = phTarget - phDisplay
        guard abs(delta) > 0.01 else {
            phDisplay = phTarget
            return
        }
        phDisplay += delta * 0.2
    }

    private func drift(from current: Double, target: Double, spread: Double, clamp: ClosedRange<Double>) -> Double {
        let noise = Double.random(in: -spread...spread)
        let nudged = current + (target - current) * 0.3 + noise
        return min(max(nudged, clamp.lowerBound), clamp.upperBound)
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()
}
