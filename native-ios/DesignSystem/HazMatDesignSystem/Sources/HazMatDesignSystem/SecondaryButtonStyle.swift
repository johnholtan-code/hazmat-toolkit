import SwiftUI

public struct SecondaryButtonStyle: ButtonStyle {
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        StyledButtonBody(configuration: configuration)
    }

    private struct StyledButtonBody: View {
        @Environment(\.colorScheme) private var colorScheme
        let configuration: Configuration

        private var fillColor: Color {
            if colorScheme == .dark {
                return Color.white.opacity(configuration.isPressed ? 0.12 : 0.08)
            } else {
                return Color.black.opacity(configuration.isPressed ? 0.12 : 0.06)
            }
        }

        private var strokeColor: Color {
            if colorScheme == .dark {
                return Color.white.opacity(0.14)
            } else {
                return Color.black.opacity(0.12)
            }
        }

        private var textColor: Color {
            colorScheme == .dark ? Color.white.opacity(0.94) : Color.black.opacity(0.82)
        }

        var body: some View {
            configuration.label
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(textColor)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(fillColor)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(strokeColor, lineWidth: 1)
                )
                .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
                .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
        }
    }
}

