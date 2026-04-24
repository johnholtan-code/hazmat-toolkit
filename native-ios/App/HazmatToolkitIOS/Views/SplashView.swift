import SwiftUI
import HazMatDesignSystem

struct SplashView: View {
    @ObservedObject var store: AppStore

    var body: some View {
        ZStack {
            VStack(spacing: 28) {
                Spacer()

                VStack(spacing: 24) {
                    Text("Knowledge In Training")
                        .font(.system(size: 22, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.9))
                        .multilineTextAlignment(.center)

                    ZStack {
                        VStack(spacing: 18) {
                            Image("ToolKIT_AppIcon_1024x1024")
                                .resizable()
                                .scaledToFit()
                                .frame(width: 128, height: 128)
                                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                                .shadow(color: .black.opacity(0.35), radius: 18, y: 8)

                            VStack(spacing: 8) {
                                Text("HAZMAT TOOLK.I.T.")
                                    .font(.system(size: 36, weight: .heavy, design: .rounded))
                                    .foregroundStyle(.white)
                                    .multilineTextAlignment(.center)

                                Text("The Hazmat Guys - Hazmat ToolK.I.T.")
                                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                                    .foregroundStyle(.white.opacity(0.82))
                                    .multilineTextAlignment(.center)
                            }
                        }
                        .padding(.vertical, 28)
                        .padding(.horizontal, 22)
                    }
                    .frame(maxWidth: 560)
                    .hazmatPanel()
                }

                Spacer()
                Spacer()
            }
            .padding(.horizontal, 28)
        }
        .hazmatBackground()
        .task {
            store.dismissSplashAfterDelay()
        }
    }
}
