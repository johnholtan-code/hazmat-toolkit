import SwiftUI
import HazMatDesignSystem

struct RootView: View {
    @ObservedObject var store: AppStore
    
    var body: some View {
        if store.showingSplash {
            SplashView(store: store)
                .onAppear {
                    Task {
                        if store.scenarios.isEmpty {
                            await store.bootstrap()
                        }
                        store.showingSplash = false
                    }
                }
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
                .alert("Error", isPresented: .init(get: { store.errorMessage != nil }, set: { if !$0 { store.clearError() } })) {
                    Button("OK") { store.clearError() }
                } message: {
                    Text(store.errorMessage ?? "Unknown error")
                }
            } else {
                NavigationView {
                    HomeView(store: store)
                }
                .hazmatBackground()
                .alert("Error", isPresented: .init(get: { store.errorMessage != nil }, set: { if !$0 { store.clearError() } })) {
                    Button("OK") { store.clearError() }
                } message: {
                    Text(store.errorMessage ?? "Unknown error")
                }
            }
        }
    }
}

