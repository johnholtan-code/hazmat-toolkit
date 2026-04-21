import SwiftUI

struct RootView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Group {
            if model.didFinishSplash {
                NavigationStack(path: $model.navPath) {
                    HomeView()
                        .navigationDestination(for: AppScreen.self) { screen in
                            switch screen {
                            case .scenarios:
                                ScenarioListView()
                            case .tools:
                                ToolListView()
                            case .gasSimulator:
                                GasSimulatorView()
                            case .radiationSimulator:
                                RadiationSimulatorView()
                            case .phSimulator:
                                PHSimulatorView()
                            }
                        }
                }
            } else {
                SplashView()
            }
        }
    }
}

private struct SplashView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [THMGTheme.thmgYellow, THMGTheme.accentYellow, .white],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 18) {
                Text("Hazmat ToolK.I.T.")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                Text("Trainee App")
                    .font(.title2.weight(.semibold))
                Image("THMGDiamond")
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 260)
                    .shadow(radius: 10, y: 8)
                PoweredByBadge()
                    .padding(.top, 8)
            }
            .padding(24)
        }
        .task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            guard !Task.isCancelled else { return }
            model.didFinishSplash = true
        }
    }
}
