import SwiftUI
import MapKit
import CoreLocation

struct MapPinItem: Identifiable {
    let id: UUID
    var title: String
    var coordinate: CLLocationCoordinate2D
    var tint: Color = .red
    var linkedShapeID: UUID?

    init(id: UUID = UUID(), title: String, coordinate: CLLocationCoordinate2D, tint: Color = .red, linkedShapeID: UUID? = nil) {
        self.id = id
        self.title = title
        self.coordinate = coordinate
        self.tint = tint
        self.linkedShapeID = linkedShapeID
    }
}

@available(iOS 17.0, *)
struct MapKitPanel: View {
    let title: String
    let subtitle: String
    let pins: [MapPinItem]
    let fallbackCenter: CLLocationCoordinate2D?

    @State private var position: MapCameraPosition = .automatic
    @State private var selectedMapMode: Int = 0 // 0 standard, 1 satellite, 2 hybrid
    @StateObject private var myLocationProvider = CurrentLocationProvider()

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ZStack(alignment: .topTrailing) {
                Map(position: $position) {
                    ForEach(pins) { pin in
                        Marker(pin.title, coordinate: pin.coordinate)
                            .tint(pin.tint)
                    }
                }
                .mapStyle(mapStyleForSelection(selectedMapMode))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .frame(minHeight: 220)

                VStack(alignment: .trailing, spacing: 8) {
                    // Map mode picker
                    Picker("Map Mode", selection: $selectedMapMode) {
                        Text("Std").tag(0)
                        Text("Sat").tag(1)
                        Text("Hyb").tag(2)
                    }
                    .pickerStyle(.segmented)
                    .tint(.blue)
                    .labelsHidden()
                    .padding(8)
                    .background(.ultraThinMaterial, in: Capsule())

                    // Snap to my location button
                    Button {
                        myLocationProvider.requestCurrentLocation()
                        if let coord = myLocationProvider.currentCoordinate {
                            recenter(to: coord, span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01))
                        }
                    } label: {
                        Image(systemName: "location")
                            .imageScale(.medium)
                            .padding(10)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.blue)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .padding(.trailing, 8)
                }
                .padding(.top, 8)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .onAppear {
            recenter()
        }
        .onChange(of: pins.map(\.coordinate.latitude)) { _, _ in
            recenter()
        }
        .onChange(of: pins.map(\.coordinate.longitude)) { _, _ in
            recenter()
        }
        .onChange(of: myLocationProvider.currentCoordinate?.latitude) { _, _ in
            if let coord = myLocationProvider.currentCoordinate {
                recenter(to: coord, span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01))
            }
        }
        .onChange(of: myLocationProvider.currentCoordinate?.longitude) { _, _ in
            if let coord = myLocationProvider.currentCoordinate {
                recenter(to: coord, span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01))
            }
        }
    }

    private func recenter() {
        let center = pins.first?.coordinate ?? fallbackCenter ?? CLLocationCoordinate2D(latitude: 39.8283, longitude: -98.5795)
        let span = MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)
        recenter(to: center, span: span)
    }

    private func recenter(to center: CLLocationCoordinate2D, span: MKCoordinateSpan) {
        position = .region(MKCoordinateRegion(center: center, span: span))
    }

    private func mapStyleForSelection(_ selection: Int) -> MapStyle {
        switch selection {
        case 1:
            return .imagery
        case 2:
            return .hybrid(elevation: .realistic)
        default:
            return .standard(elevation: .realistic)
        }
    }
}

@MainActor
final class CurrentLocationProvider: NSObject, ObservableObject, @preconcurrency CLLocationManagerDelegate {
    @Published var currentCoordinate: CLLocationCoordinate2D?
    @Published var authorizationStatus: CLAuthorizationStatus

    private let manager = CLLocationManager()

    override init() {
        self.authorizationStatus = manager.authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
    }

    func requestCurrentLocation() {
        guard CLLocationManager.locationServicesEnabled() else { return }

        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            if let location = manager.location {
                currentCoordinate = location.coordinate
            }
            manager.requestLocation()
        case .denied, .restricted:
            break
        @unknown default:
            break
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus
        if authorizationStatus == .authorizedAlways || authorizationStatus == .authorizedWhenInUse {
            if let location = manager.location {
                currentCoordinate = location.coordinate
            }
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        currentCoordinate = locations.last?.coordinate
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: any Error) {
        // No-op: create flow can still proceed by tapping any visible location on the map.
    }
}

@available(iOS 17.0, *)
struct LocationPickerMapPanel: View {
    let title: String
    let subtitle: String
    let selectedPinTitle: String
    let selectedCoordinate: CLLocationCoordinate2D?
    let currentLocationCoordinate: CLLocationCoordinate2D?
    let fallbackCenter: CLLocationCoordinate2D?
    let onCoordinateSelected: (CLLocationCoordinate2D) -> Void

    @State private var position: MapCameraPosition = .automatic
    @State private var selectedMapMode: Int = 0
    @StateObject private var myLocationProvider = CurrentLocationProvider()

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            MapReader { proxy in
                ZStack(alignment: .topTrailing) {
                    Map(position: $position) {
                        if let current = currentLocationCoordinate ?? myLocationProvider.currentCoordinate {
                            Marker("Current Location", coordinate: current)
                                .tint(.blue)
                        }

                        if let selected = selectedCoordinate {
                            Marker(selectedPinTitle, coordinate: selected)
                                .tint(.yellow)
                        }
                    }
                    .mapStyle(mapStyleForSelection(selectedMapMode))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .frame(height: 780)
                    .onTapGesture { point in
                        if let coordinate = proxy.convert(point, from: .local) {
                            onCoordinateSelected(coordinate)
                        }
                    }

                    VStack(alignment: .trailing, spacing: 8) {
                        Picker("Map Mode", selection: $selectedMapMode) {
                            Text("Std").tag(0)
                            Text("Sat").tag(1)
                            Text("Hyb").tag(2)
                        }
                        .pickerStyle(.segmented)
                        .tint(.blue)
                        .labelsHidden()
                        .padding(8)
                        .background(.ultraThinMaterial, in: Capsule())

                        Button {
                            myLocationProvider.requestCurrentLocation()
                            if let coord = myLocationProvider.currentCoordinate {
                                onCoordinateSelected(coord)
                                recenter(to: coord, span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01))
                            }
                        } label: {
                            Image(systemName: "location")
                                .imageScale(.medium)
                                .padding(10)
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(.blue)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .padding(.trailing, 8)
                    }
                    .padding(.top, 8)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .onAppear {
            recenter()
        }
        .onChange(of: currentLocationCoordinate?.latitude) { _, _ in
            recenter()
        }
        .onChange(of: currentLocationCoordinate?.longitude) { _, _ in
            recenter()
        }
        .onChange(of: myLocationProvider.currentCoordinate?.latitude) { _, _ in
            if let coord = myLocationProvider.currentCoordinate {
                recenter(to: coord, span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01))
            }
        }
        .onChange(of: myLocationProvider.currentCoordinate?.longitude) { _, _ in
            if let coord = myLocationProvider.currentCoordinate {
                recenter(to: coord, span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01))
            }
        }
    }

    private func recenter() {
        let center = selectedCoordinate ?? currentLocationCoordinate ?? myLocationProvider.currentCoordinate ?? fallbackCenter ?? CLLocationCoordinate2D(latitude: 39.8283, longitude: -98.5795)
        let span = MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
        recenter(to: center, span: span)
    }

    private func recenter(to center: CLLocationCoordinate2D, span: MKCoordinateSpan) {
        position = .region(MKCoordinateRegion(center: center, span: span))
    }

    private func mapStyleForSelection(_ selection: Int) -> MapStyle {
        switch selection {
        case 1:
            return .imagery
        case 2:
            return .hybrid(elevation: .realistic)
        default:
            return .standard(elevation: .realistic)
        }
    }
}

@available(iOS 17.0, *)
struct RadiationPinPlacementMapPanel: View {
    let pins: [MapPinItem]
    let fallbackCenter: CLLocationCoordinate2D?
    let onCoordinateSelected: (CLLocationCoordinate2D) -> Void
    var onExistingPinSelected: ((UUID) -> Void)? = nil
    var selectedCoordinate: CLLocationCoordinate2D? = nil
    var selectedSelectionKey: String? = nil
    var isPlacementEnabled: Bool = false

    @State private var position: MapCameraPosition = .automatic
    @State private var selectedMapMode: Int = 0
    @StateObject private var myLocationProvider = CurrentLocationProvider()
    @State private var lastSnappedSelectionKey: String?

    var body: some View {
        MapReader { proxy in
            ZStack(alignment: .topTrailing) {
                Map(position: $position) {
                    if let current = myLocationProvider.currentCoordinate {
                        Marker("Current Location", coordinate: current)
                            .tint(.blue)
                    }
                    ForEach(pins) { pin in
                        Annotation(pin.title, coordinate: pin.coordinate) {
                            Button {
                                if let shapeID = pin.linkedShapeID {
                                    onExistingPinSelected?(shapeID)
                                }
                            } label: {
                                VStack(spacing: 2) {
                                    Image(systemName: "mappin.circle.fill")
                                        .font(.system(size: 28))
                                        .foregroundStyle(pin.tint)
                                    if !pin.title.isEmpty {
                                        Text(pin.title)
                                            .font(.caption2.weight(.semibold))
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(.ultraThinMaterial, in: Capsule())
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .mapStyle(mapStyleForSelection(selectedMapMode))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .frame(minHeight: 260)
                .onTapGesture { point in
                    guard isPlacementEnabled else { return }
                    if let coordinate = proxy.convert(point, from: .local) {
                        onCoordinateSelected(coordinate)
                    }
                }

                VStack(alignment: .trailing, spacing: 8) {
                    Picker("Map Mode", selection: $selectedMapMode) {
                        Text("Std").tag(0)
                        Text("Sat").tag(1)
                        Text("Hyb").tag(2)
                    }
                    .pickerStyle(.segmented)
                    .tint(.blue)
                    .labelsHidden()
                    .padding(8)
                    .background(.ultraThinMaterial, in: Capsule())

                    Button {
                        myLocationProvider.requestCurrentLocation()
                        if let coord = myLocationProvider.currentCoordinate {
                            recenter(to: coord, span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01))
                        }
                    } label: {
                        Image(systemName: "location")
                            .imageScale(.medium)
                            .padding(10)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.blue)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .padding(.trailing, 8)
                }
                .padding(.top, 8)
            }
        }
        .onAppear {
            myLocationProvider.requestCurrentLocation()
            recenter()
        }
        .onChange(of: pins.map(\.coordinate.latitude)) { _, _ in
            recenter()
        }
        .onChange(of: pins.map(\.coordinate.longitude)) { _, _ in
            recenter()
        }
        .onChange(of: selectedSelectionKey) { _, newValue in
            guard let newValue else {
                lastSnappedSelectionKey = nil
                return
            }
            guard newValue != lastSnappedSelectionKey else { return }
            guard let selectedCoordinate else { return }
            recenter(to: selectedCoordinate, span: MKCoordinateSpan(latitudeDelta: 0.004, longitudeDelta: 0.004))
            lastSnappedSelectionKey = newValue
        }
    }

    private func recenter() {
        let center = pins.last?.coordinate ?? myLocationProvider.currentCoordinate ?? fallbackCenter ?? CLLocationCoordinate2D(latitude: 39.8283, longitude: -98.5795)
        let span = MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
        recenter(to: center, span: span)
    }

    private func recenter(to center: CLLocationCoordinate2D, span: MKCoordinateSpan) {
        position = .region(MKCoordinateRegion(center: center, span: span))
    }

    private func mapStyleForSelection(_ selection: Int) -> MapStyle {
        switch selection {
        case 1:
            return .imagery
        case 2:
            return .hybrid(elevation: .realistic)
        default:
            return .standard(elevation: .realistic)
        }
    }
}
