import SwiftUI
import HazMatDesignSystem

struct RootView: View {
    @ObservedObject var store: AppStore

    var body: some View {
        if store.showingSplash {
            SplashView(store: store)
        } else {
            if #available(iOS 16.0, *) {
                NavigationStack(path: $store.path) {
                    HomeView(store: store)
                        .navigationDestination(for: AppRoute.self) { route in
                            switch route {
                            case .scenarioList(let device):
                                ScenarioListView(store: store, device: device)
                            case .createScenario(let device):
                                CreateScenarioView(store: store, device: device)
                            case .editScenario(let scenarioID):
                                EditScenarioView(store: store, scenarioID: scenarioID)
                            case .watchScenario(let scenarioID):
                                WatchScenarioView(store: store, scenarioID: scenarioID)
                            }
                        }
                }
                .hazmatBackground()
                .task {
                    if store.scenarios.isEmpty {
                        await store.bootstrap()
                    }
                }
                .alert(
                    "Error",
                    isPresented: Binding(
                        get: { store.errorMessage != nil },
                        set: { if !$0 { store.clearError() } }
                    )
                ) {
                    Button("OK") { store.clearError() }
                } message: {
                    Text(store.errorMessage ?? "Unknown error")
                }
            } else {
                // Fallback for iOS 15 and earlier
                NavigationView {
                    HomeView(store: store)
                }
                .hazmatBackground()
                .task {
                    if store.scenarios.isEmpty {
                        await store.bootstrap()
                    }
                }
                .alert(
                    "Error",
                    isPresented: Binding(
                        get: { store.errorMessage != nil },
                        set: { if !$0 { store.clearError() } }
                    )
                ) {
                    Button("OK") { store.clearError() }
                } message: {
                    Text(store.errorMessage ?? "Unknown error")
                }
            }
        }
    }
}

