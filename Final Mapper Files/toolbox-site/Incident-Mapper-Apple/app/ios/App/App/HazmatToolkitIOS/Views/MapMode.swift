import SwiftUI
import MapKit

public enum MapMode: String, CaseIterable, Identifiable {
    case standard
    case satellite
    case hybrid

    public var id: String { rawValue }

    /// Preferred SwiftUI MapStyle for this mode (iOS 17+ only)
    @available(iOS 17.0, *)
    var mapStyle: MapStyle {
        switch self {
        case .standard:
            return .standard(elevation: .realistic)
        case .satellite:
            return .imagery
        case .hybrid:
            return .hybrid(elevation: .realistic)
        }
    }

    var mkMapType: MKMapType {
        switch self {
        case .standard:
            return .standard
        case .satellite:
            return .satellite
        case .hybrid:
            return .hybrid
        }
    }

    // Unified configuration to avoid availability checks at call sites
    enum MapConfigurationMK {
        case mkType(MKMapType)
    }

    @available(iOS 17.0, *)
    enum MapConfigurationStyle {
        case style(MapStyle)
    }

    /// Returns MK-based map configuration (always available)
    var mapConfigurationMK: MapConfigurationMK {
        return .mkType(self.mkMapType)
    }

    /// Returns SwiftUI MapStyle-based configuration (iOS 17+)
    @available(iOS 17.0, *)
    var mapConfigurationStyle: MapConfigurationStyle {
        return .style(self.mapStyle)
    }
}
