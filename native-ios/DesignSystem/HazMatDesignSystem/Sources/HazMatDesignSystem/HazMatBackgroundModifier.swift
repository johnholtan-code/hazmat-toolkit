import SwiftUI

public struct HazMatBackgroundModifier: ViewModifier {
    public init() {}

    public func body(content: Content) -> some View {
        content
            .background(
                LinearGradient(
                    colors: [ThemeColors.backgroundTop, ThemeColors.backgroundBottom],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
            )
    }
}

public extension View {
    func hazmatBackground() -> some View {
        modifier(HazMatBackgroundModifier())
    }
}
