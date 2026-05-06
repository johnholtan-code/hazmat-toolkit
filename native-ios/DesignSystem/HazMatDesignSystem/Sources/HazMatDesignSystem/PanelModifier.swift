import SwiftUI

public struct PanelModifier: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    public init() {}

    public func body(content: Content) -> some View {
        content
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(panelFill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(panelStroke, lineWidth: 1)
            )
            .shadow(
                color: colorScheme == .dark ? Color.black.opacity(0.18) : Color.black.opacity(0.06),
                radius: colorScheme == .dark ? 14 : 8,
                y: 2
            )
    }

    private var panelFill: Color {
        colorScheme == .dark ? ThemeColors.panel : Color.white
    }

    private var panelStroke: Color {
        colorScheme == .dark ? ThemeColors.panelStroke : Color.black.opacity(0.08)
    }
}

public extension View {
    func hazmatPanel() -> some View {
        modifier(PanelModifier())
    }
}
