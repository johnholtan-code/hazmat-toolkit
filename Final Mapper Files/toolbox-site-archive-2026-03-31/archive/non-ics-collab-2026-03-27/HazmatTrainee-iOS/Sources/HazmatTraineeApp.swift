import SwiftUI
import AppIntents

@main
struct HazmatTraineeApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .preferredColorScheme(.dark)
        }
    }
}

struct OpenContinueSessionIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Continue Session"
    static let description = IntentDescription("Opens THMG Trainee directly to the last downloaded or live training session.")
    static let openAppWhenRun = true

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard UserDefaults.standard.data(forKey: AppIntentBridge.persistedScenarioKey) != nil else {
            return .result(dialog: "No downloaded session is available yet.")
        }

        UserDefaults.standard.set(
            ExternalAppRoute.continueSession.rawValue,
            forKey: AppIntentBridge.pendingRouteKey
        )

        return .result(dialog: "Opening your session in THMG Trainee.")
    }
}

struct THMGTraineeShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenContinueSessionIntent(),
            phrases: [
                "Continue session in \(.applicationName)",
                "Open my session in \(.applicationName)",
                "Continue my session in \(.applicationName)"
            ],
            shortTitle: "Continue Session",
            systemImageName: "play.circle"
        )
    }
}
