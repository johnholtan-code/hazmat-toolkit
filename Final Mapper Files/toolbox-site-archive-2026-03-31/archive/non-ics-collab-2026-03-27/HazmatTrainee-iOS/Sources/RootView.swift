import SwiftUI
import HazMatDesignSystem

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
                            case .airMonitorBuilder:
                                AirMonitorBuilderView()
                                    .environmentObject(model)
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
        VStack(spacing: 18) {
            Text("Hazmat ToolK.I.T.")
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
            Text("Trainee App")
                .font(.title2.weight(.semibold))
                .foregroundStyle(ThemeColors.accent)
            Image("THMGDiamond")
                .resizable()
                .scaledToFit()
                .frame(maxWidth: 260)
                .shadow(color: .black.opacity(0.35), radius: 10, y: 8)
        }
        .padding(24)
        .hazmatPanel()
        .padding(24)
        .hazmatBackground()
        .task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            guard !Task.isCancelled else { return }
            model.finishSplash()
        }
    }
}
