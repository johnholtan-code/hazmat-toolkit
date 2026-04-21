import SwiftUI

@main
struct Flaminator9000App: App {
    @StateObject private var simulation = FlameSimulationStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(simulation)
        }
    }
}

