import SwiftUI

public enum ThemeTypography {
    public static func title() -> Font { .system(.title2, design: .rounded).weight(.bold) }
    public static func body() -> Font { .system(.body, design: .rounded) }
    public static func caption() -> Font { .system(.caption, design: .rounded) }
}
