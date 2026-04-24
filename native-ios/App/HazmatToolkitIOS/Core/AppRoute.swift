import Foundation

enum AppRoute: Hashable {
    case scenarioList(DetectionDevice)
    case createScenario(DetectionDevice)
    case editScenario(UUID)
    case watchScenario(UUID)
}
