import SwiftUI
import MapKit
import CoreLocation
import UIKit

struct NamedPolygon {
    let id: UUID
    let name: String
    let coordinates: [CLLocationCoordinate2D]
    let colorHex: String?
    let isSelected: Bool
}

struct PolygonDrawingMapView: UIViewRepresentable {
    @Binding var draftVertices: [CLLocationCoordinate2D]

    let centerCoordinate: CLLocationCoordinate2D?
    let scenarioTitle: String
    let existingPolygons: [NamedPolygon]
    let onClosedLoop: (([CLLocationCoordinate2D]) -> Void)?

    var selectedPolygonCenter: CLLocationCoordinate2D? = nil
    var selectedPolygonCoordinates: [CLLocationCoordinate2D]? = nil
    var selectedPolygonSelectionKey: String? = nil
    var onExistingPolygonSelected: ((Int) -> Void)? = nil

    // Map controls
    var showsUserLocation: Bool = false
    var isDrawingEnabled: Bool = false

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView(frame: .zero)
        mapView.delegate = context.coordinator
        mapView.mapType = .standard
        mapView.showsCompass = false
        mapView.isPitchEnabled = false
        mapView.isRotateEnabled = false
        mapView.isScrollEnabled = !isDrawingEnabled
        mapView.isZoomEnabled = !isDrawingEnabled
        mapView.showsUserLocation = showsUserLocation
        mapView.userTrackingMode = .none

        // Add draw gesture recognizer (kept as-is)
        let drawPan = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleDrawPan(_:)))
        drawPan.maximumNumberOfTouches = 1
        if #available(iOS 13.4, *) {
            // Simulator input arrives as an indirect pointer, so include it for trainer testing.
            drawPan.allowedTouchTypes = [
                NSNumber(value: UITouch.TouchType.direct.rawValue),
                NSNumber(value: UITouch.TouchType.pencil.rawValue),
                NSNumber(value: UITouch.TouchType.indirectPointer.rawValue)
            ]
        } else {
            drawPan.allowedTouchTypes = [
                NSNumber(value: UITouch.TouchType.direct.rawValue),
                NSNumber(value: UITouch.TouchType.pencil.rawValue)
            ]
        }
        mapView.addGestureRecognizer(drawPan)
        drawPan.isEnabled = isDrawingEnabled
        context.coordinator.drawPanGesture = drawPan

        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        mapView.addGestureRecognizer(tap)

        context.coordinator.mapView = mapView

        // Overlay container for controls
        let controlsContainer = UIStackView()
        controlsContainer.axis = .vertical
        controlsContainer.alignment = .trailing
        controlsContainer.spacing = 8
        controlsContainer.translatesAutoresizingMaskIntoConstraints = false

        // Segmented control for map modes
        let modeControl = UISegmentedControl(items: ["Std", "Sat", "Hyb"])
        modeControl.selectedSegmentIndex = 0
        modeControl.addTarget(context.coordinator, action: #selector(Coordinator.mapModeChanged(_:)), for: .valueChanged)
        modeControl.translatesAutoresizingMaskIntoConstraints = false

        // Snap to my location / tracking button
        let trackingButton = MKUserTrackingButton(mapView: mapView)
        trackingButton.translatesAutoresizingMaskIntoConstraints = false

        // Style controls
        modeControl.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.6)
        modeControl.selectedSegmentTintColor = UIColor.systemBlue
        trackingButton.layer.cornerRadius = 22
        trackingButton.clipsToBounds = true
        trackingButton.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.6)

        // Embed controls
        controlsContainer.addArrangedSubview(modeControl)
        controlsContainer.addArrangedSubview(trackingButton)
        mapView.addSubview(controlsContainer)

        // Layout constraints: top-right with some padding
        NSLayoutConstraint.activate([
            controlsContainer.topAnchor.constraint(equalTo: mapView.safeAreaLayoutGuide.topAnchor, constant: 8),
            controlsContainer.trailingAnchor.constraint(equalTo: mapView.trailingAnchor, constant: -8)
        ])

        if let centerCoordinate {
            let region = MKCoordinateRegion(
                center: centerCoordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
            )
            mapView.setRegion(region, animated: false)
            context.coordinator.hasSetInitialRegion = true
        }

        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        context.coordinator.parent = self
        mapView.showsUserLocation = showsUserLocation
        mapView.isScrollEnabled = !isDrawingEnabled
        mapView.isZoomEnabled = !isDrawingEnabled
        context.coordinator.drawPanGesture?.isEnabled = isDrawingEnabled
        context.coordinator.render(on: mapView)
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        var parent: PolygonDrawingMapView
        weak var mapView: MKMapView?
        weak var drawPanGesture: UIPanGestureRecognizer?
        private var strokePoints: [CGPoint] = []
        private var overlayIndexMap: [MKPolygon: Int] = [:]
        private var annotationSelectionMap: [ObjectIdentifier: Bool] = [:]
        var hasSetInitialRegion: Bool = false
        private var lastSnappedCenter: CLLocationCoordinate2D?
        private var lastSnappedSelectionKey: String?

        init(_ parent: PolygonDrawingMapView) {
            self.parent = parent
        }

        @objc func handleDrawPan(_ gesture: UIPanGestureRecognizer) {
            guard parent.isDrawingEnabled else { return }
            guard let mapView else { return }
            let point = gesture.location(in: mapView)

            switch gesture.state {
            case .began:
                strokePoints = [point]
                parent.draftVertices = [mapView.convert(point, toCoordinateFrom: mapView)]
                render(on: mapView)

            case .changed:
                appendStrokePointIfNeeded(point, on: mapView)
                render(on: mapView)

            case .ended, .cancelled, .failed:
                appendStrokePointIfNeeded(point, on: mapView)
                if parent.draftVertices.count >= 3 {
                    parent.onClosedLoop?(parent.draftVertices)
                }
                render(on: mapView)

            default:
                break
            }
        }

        private func appendStrokePointIfNeeded(_ point: CGPoint, on mapView: MKMapView) {
            // Downsample screen points so the polygon remains usable and not overly dense.
            if let last = strokePoints.last {
                let dx = point.x - last.x
                let dy = point.y - last.y
                let distance = sqrt((dx * dx) + (dy * dy))
                if distance < 8 { return }
            }

            strokePoints.append(point)
            let coordinate = mapView.convert(point, toCoordinateFrom: mapView)

            if let lastCoord = parent.draftVertices.last {
                let latDelta = abs(lastCoord.latitude - coordinate.latitude)
                let lonDelta = abs(lastCoord.longitude - coordinate.longitude)
                if latDelta < 0.000001 && lonDelta < 0.000001 { return }
            }

            parent.draftVertices.append(coordinate)
        }

        func render(on mapView: MKMapView) {
            mapView.removeAnnotations(mapView.annotations)
            mapView.removeOverlays(mapView.overlays)
            overlayIndexMap.removeAll()
            annotationSelectionMap.removeAll()

            for (idx, named) in parent.existingPolygons.enumerated() where named.coordinates.count >= 3 {
                let overlay = MKPolygon(coordinates: named.coordinates, count: named.coordinates.count)
                overlay.title = "existing_\(idx)"
                overlayIndexMap[overlay] = idx
                mapView.addOverlay(overlay)

                if !named.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    let annotation = PolygonNameAnnotation(
                        coordinate: centroid(of: named.coordinates),
                        title: named.name,
                        isSelected: named.isSelected
                    )
                    annotationSelectionMap[ObjectIdentifier(annotation)] = named.isSelected
                    mapView.addAnnotation(annotation)
                }
            }

            if parent.draftVertices.count >= 2 {
                let line = MKPolyline(coordinates: parent.draftVertices, count: parent.draftVertices.count)
                mapView.addOverlay(line)
            }

            if parent.draftVertices.count >= 3 {
                let polygon = MKPolygon(coordinates: parent.draftVertices, count: parent.draftVertices.count)
                mapView.addOverlay(polygon)
            }

            if !hasSetInitialRegion, let center = parent.centerCoordinate {
                let region = MKCoordinateRegion(
                    center: center,
                    span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
                )
                mapView.setRegion(region, animated: false)
                hasSetInitialRegion = true
            }

            if parent.selectedPolygonSelectionKey == nil {
                lastSnappedSelectionKey = nil
            }

            if let key = parent.selectedPolygonSelectionKey,
               key != lastSnappedSelectionKey {
                if let coords = parent.selectedPolygonCoordinates, coords.count >= 3 {
                    snapToPolygon(coords, on: mapView)
                    lastSnappedSelectionKey = key
                } else if let center = parent.selectedPolygonCenter {
                    if shouldSnap(to: center) {
                        let region = MKCoordinateRegion(
                            center: center,
                            span: MKCoordinateSpan(latitudeDelta: 0.004, longitudeDelta: 0.004)
                        )
                        mapView.setRegion(region, animated: true)
                        lastSnappedCenter = center
                    }
                    lastSnappedSelectionKey = key
                }
            }
        }

        private func snapToPolygon(_ coordinates: [CLLocationCoordinate2D], on mapView: MKMapView) {
            let polygon = MKPolygon(coordinates: coordinates, count: coordinates.count)
            let rect = polygon.boundingMapRect
            let padded = mapView.mapRectThatFits(
                rect,
                edgePadding: UIEdgeInsets(top: 60, left: 40, bottom: 60, right: 40)
            )
            mapView.setVisibleMapRect(padded, animated: true)
        }

        private func centroid(of coords: [CLLocationCoordinate2D]) -> CLLocationCoordinate2D {
            let lat = coords.map(\.latitude).reduce(0, +) / Double(coords.count)
            let lon = coords.map(\.longitude).reduce(0, +) / Double(coords.count)
            return CLLocationCoordinate2D(latitude: lat, longitude: lon)
        }

        private func shouldSnap(to center: CLLocationCoordinate2D) -> Bool {
            guard let previous = lastSnappedCenter else { return true }
            let latDelta = abs(previous.latitude - center.latitude)
            let lonDelta = abs(previous.longitude - center.longitude)
            return latDelta > 0.000001 || lonDelta > 0.000001
        }

        @objc func mapModeChanged(_ sender: UISegmentedControl) {
            guard let mapView else { return }
            switch sender.selectedSegmentIndex {
            case 1:
                mapView.mapType = .satellite
            case 2:
                mapView.mapType = .hybrid
            default:
                mapView.mapType = .standard
            }
        }

        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let polygon = overlay as? MKPolygon {
                let renderer = MKPolygonRenderer(polygon: polygon)
                let isDraft = polygon.pointCount == parent.draftVertices.count && parent.draftVertices.count >= 3
                if isDraft {
                    renderer.fillColor = UIColor.systemYellow.withAlphaComponent(0.25)
                    renderer.strokeColor = UIColor.systemYellow
                    renderer.lineWidth = 3
                    return renderer
                }

                let style = styleForExistingPolygon(polygon)
                renderer.fillColor = style.fill
                renderer.strokeColor = style.stroke
                renderer.lineWidth = style.lineWidth
                return renderer
            }

            if let polyline = overlay as? MKPolyline {
                let renderer = MKPolylineRenderer(polyline: polyline)
                renderer.strokeColor = UIColor.systemBlue
                renderer.lineWidth = 2
                renderer.lineDashPattern = [6, 4]
                return renderer
            }

            return MKOverlayRenderer(overlay: overlay)
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            if annotation is MKUserLocation { return nil }

            let identifier = "PolygonNameLabel"
            let view = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) ?? MKAnnotationView(annotation: annotation, reuseIdentifier: identifier)
            view.annotation = annotation
            view.canShowCallout = false
            view.image = nil

            view.subviews.forEach { $0.removeFromSuperview() }

            let label = PaddingLabel()
            label.text = annotation.title ?? ""
            label.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
            let isSelectedLabel = annotationSelectionMap[ObjectIdentifier(annotation)] ?? false
            label.textColor = isSelectedLabel ? UIColor.white : UIColor.label
            label.backgroundColor = isSelectedLabel
                ? UIColor.systemBlue.withAlphaComponent(0.9)
                : UIColor.systemBackground.withAlphaComponent(0.82)
            label.layer.cornerRadius = 10
            label.layer.masksToBounds = true
            label.layer.borderWidth = 1
            label.layer.borderColor = (isSelectedLabel
                ? UIColor.systemBlue
                : UIColor.separator.withAlphaComponent(0.35)).cgColor
            label.sizeToFit()

            label.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(label)
            NSLayoutConstraint.activate([
                label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
                label.centerYAnchor.constraint(equalTo: view.centerYAnchor)
            ])

            // Give the annotation view a frame so the label can be hit-tested/laid out.
            let size = label.intrinsicContentSize
            view.frame = CGRect(x: 0, y: 0, width: size.width, height: size.height)
            view.centerOffset = CGPoint(x: 0, y: 0)
            return view
        }
        @objc func handleTap(_ gesture: UITapGestureRecognizer) {
            guard let mapView else { return }
            let point = gesture.location(in: mapView)
            let mapPoint = MKMapPoint(mapView.convert(point, toCoordinateFrom: mapView))
            // Hit-test polygons by checking renderer path contains point
            for overlay in mapView.overlays {
                guard let polygon = overlay as? MKPolygon else { continue }
                guard let renderer = mapView.renderer(for: polygon) as? MKPolygonRenderer else { continue }
                _ = renderer.path
                let cgPoint = renderer.point(for: mapPoint)
                if renderer.path?.contains(cgPoint) == true {
                    if let title = polygon.title, title.hasPrefix("existing_"), let idxString = title.split(separator: "_").last, let idx = Int(idxString) {
                        parent.onExistingPolygonSelected?(idx)
                    } else if polygon.pointCount == parent.draftVertices.count && parent.draftVertices.count >= 3 {
                        // Ignore draft polygon selection
                    }
                    break
                }
            }
        }

        private func styleForExistingPolygon(_ polygon: MKPolygon) -> (fill: UIColor, stroke: UIColor, lineWidth: CGFloat) {
            guard let idx = overlayIndexMap[polygon], parent.existingPolygons.indices.contains(idx) else {
                return (
                    fill: UIColor.systemOrange.withAlphaComponent(0.18),
                    stroke: UIColor.systemOrange,
                    lineWidth: 2
                )
            }

            let named = parent.existingPolygons[idx]
            let base = UIColor(shapeHex: named.colorHex) ?? UIColor.systemOrange
            if named.isSelected {
                return (
                    fill: base.withAlphaComponent(0.30),
                    stroke: base,
                    lineWidth: 4
                )
            }
            return (
                fill: base.withAlphaComponent(0.18),
                stroke: base,
                lineWidth: 2
            )
        }
    }
}

private final class PolygonNameAnnotation: NSObject, MKAnnotation {
    dynamic var coordinate: CLLocationCoordinate2D
    var title: String?
    let isSelected: Bool

    init(coordinate: CLLocationCoordinate2D, title: String, isSelected: Bool) {
        self.coordinate = coordinate
        self.title = title
        self.isSelected = isSelected
        super.init()
    }
}

private final class PaddingLabel: UILabel {
    private let insets = UIEdgeInsets(top: 4, left: 8, bottom: 4, right: 8)

    override func drawText(in rect: CGRect) {
        super.drawText(in: rect.inset(by: insets))
    }

    override var intrinsicContentSize: CGSize {
        let size = super.intrinsicContentSize
        return CGSize(width: size.width + insets.left + insets.right,
                      height: size.height + insets.top + insets.bottom)
    }
}

private extension UIColor {
    convenience init?(shapeHex: String?) {
        guard let shapeHex else { return nil }
        var hex = shapeHex.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !hex.isEmpty else { return nil }
        if hex.hasPrefix("#") { hex.removeFirst() }
        guard hex.count == 6 || hex.count == 8 else { return nil }

        var value: UInt64 = 0
        guard Scanner(string: hex).scanHexInt64(&value) else { return nil }

        let r, g, b, a: CGFloat
        if hex.count == 8 {
            r = CGFloat((value & 0xFF00_0000) >> 24) / 255
            g = CGFloat((value & 0x00FF_0000) >> 16) / 255
            b = CGFloat((value & 0x0000_FF00) >> 8) / 255
            a = CGFloat(value & 0x0000_00FF) / 255
        } else {
            r = CGFloat((value & 0xFF00_00) >> 16) / 255
            g = CGFloat((value & 0x00FF_00) >> 8) / 255
            b = CGFloat(value & 0x0000_FF) / 255
            a = 1
        }

        self.init(red: r, green: g, blue: b, alpha: a)
    }
}
