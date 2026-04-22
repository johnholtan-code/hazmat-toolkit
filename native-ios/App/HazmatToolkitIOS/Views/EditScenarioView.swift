import SwiftUI
import CoreLocation
import UIKit
import HazMatDesignSystem

enum EditorVariant: String {
    case airMonitor = "Air Monitor"
    case radiation = "Radiation Detection"
    case pH = "pH Paper"

    init(device: DetectionDevice) {
        switch device {
        case .airMonitor:
            self = .airMonitor
        case .radiationDetection:
            self = .radiation
        case .phPaper:
            self = .pH
        default:
            self = .airMonitor
        }
    }
}

struct EditScenarioView: View {
    @ObservedObject var store: AppStore
    let scenarioID: UUID

    @State private var newShapeName = ""
    @State private var draftPolygonVertices: [CLLocationCoordinate2D] = []
    @State private var pendingClosedLoopVertices: [CLLocationCoordinate2D] = []
    @State private var showAirMonitorPolygonConfig = false
    @State private var showPHPaperPolygonConfig = false
    @State private var showRadiationPinConfig = false
    @State private var polygonChemicalEntries: [PolygonChemicalEntry] = PolygonChemicalEntry.defaultFourGasEntries()
    @State private var polygonShapeColor: Color = .orange

    // Oxygen sampling modes and feather percentages
    @State private var oxygenHighEnabled = false
    @State private var oxygenHighFeatherPercent = "0"
    @State private var oxygenLowEnabled = false
    @State private var oxygenLowFeatherPercent = "0"

    // LEL sampling modes and feather percentages
    @State private var lelHighEnabled = false
    @State private var lelHighFeatherPercent = "0"
    @State private var lelLowEnabled = false
    @State private var lelLowFeatherPercent = "0"

    // Carbon monoxide sampling modes and feather percentages
    @State private var carbonMonoxideHighEnabled = false
    @State private var carbonMonoxideHighFeatherPercent = "0"
    @State private var carbonMonoxideLowEnabled = false
    @State private var carbonMonoxideLowFeatherPercent = "0"

    // Hydrogen sulfide sampling modes and feather percentages
    @State private var hydrogenSulfideHighEnabled = false
    @State private var hydrogenSulfideHighFeatherPercent = "0"
    @State private var hydrogenSulfideLowEnabled = false
    @State private var hydrogenSulfideLowFeatherPercent = "0"

    // PID sampling modes and feather percentages
    @State private var pidHighEnabled = false
    @State private var pidHighFeatherPercent = "0"
    @State private var pidLowEnabled = false
    @State private var pidLowFeatherPercent = "0"
    @State private var pHValueText = "7.0"
    @State private var isDrawingShape = false
    @State private var isPlacingRadiationPin = false
    @State private var pendingRadiationCoordinate: CLLocationCoordinate2D?
    @State private var radiationDoseRate = "0.0"
    @State private var radiationBackground = "0.0"
    @State private var radiationBackgroundWasEdited = false
    @State private var radiationShielding = "None"
    @State private var radiationDoseUnit = "nSv/h"
    @State private var radiationExposureUnit = "mR/h"
    @State private var isMovingSelectedRadiationPin = false

    @State private var selectedShapeID: GeoSimShape.ID? = nil
    @State private var showShapeDetail: Bool = false
    @State private var selectedShapeDetailText: String = ""

    @State private var editingShapeID: GeoSimShape.ID? = nil

    private var scenario: Scenario? {
        let s = store.scenario(by: scenarioID)
        return s
    }
    private var shapes: [GeoSimShape] { store.shapesByScenarioID[scenarioID] ?? [] }
    private var variant: EditorVariant {
        if let scenario = scenario {
            return EditorVariant(device: scenario.detectionDevice)
        } else {
            return .airMonitor
        }
    }

    var body: some View {
        Group {
            if let scenario = scenario {
                scenarioList(for: scenario)
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.title2)
                    Text("Scenario not found")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .hazmatPanel()
            }
        }
        .sheet(isPresented: $showAirMonitorPolygonConfig) {
            airMonitorPolygonSheet()
        }
        .sheet(isPresented: $showPHPaperPolygonConfig) {
            pHPolygonSheet()
        }
        .sheet(isPresented: $showRadiationPinConfig) {
            radiationPinSheet()
        }
    }

    @ViewBuilder
    private func shapeRow(for shape: GeoSimShape) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(shape.description)
                .font(.headline)
            Text("Sort: \(shape.sortOrder)")
                .font(.caption)
                .foregroundStyle(.secondary)

            switch variant {
            case .airMonitor:
                Text(airMonitorSummary(for: shape))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            case .radiation:
                Text("Dose Eq \(shape.doseRate ?? "-") \(shape.radDoseUnit ?? "nSv/h") | Exposure \(shape.background ?? "-") \(shape.radExposureUnit ?? "mR/h") | Shielding \(shape.shielding ?? "-")")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            case .pH:
                Text("pH \(shape.pH.map { String(format: "%.1f", $0) } ?? "-")")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func scenarioList(for scenario: Scenario) -> some View {
        let existingNamedPolys: [NamedPolygon] = shapes.compactMap { shape in
            guard shape.kind == .polygon, let coords = parsePolygonCoordinates(from: shape.shapeGeoJSON) else { return nil }
            return NamedPolygon(
                id: shape.id,
                name: shape.description,
                coordinates: coords,
                colorHex: shape.displayColorHex,
                isSelected: selectedShapeID == shape.id
            )
        }
        let polygonBackedShapes: [GeoSimShape] = shapes.filter { $0.kind == .polygon && parsePolygonCoordinates(from: $0.shapeGeoJSON) != nil }
        let selectedPolygonCenter = polygonCenterForSelectedShape(in: polygonBackedShapes)
        let selectedPolygonCoordinates = polygonCoordinatesForSelectedShape(in: polygonBackedShapes)
        let selectedRadiationCoordinate = radiationCoordinateForSelectedShape()

        List {
            Section("Scenario") {
                HStack(alignment: .top, spacing: 16) {
                    scenarioDetailCell(
                        title: "Name",
                        value: scenario.scenarioName,
                        alignment: .leading
                    )
                    Divider()
                    scenarioDetailCell(
                        title: "Device",
                        value: scenario.detectionDevice.rawValue,
                        alignment: .center
                    )
                    Divider()
                    scenarioDetailCell(
                        title: "Date",
                        value: scenario.scenarioDate.formatted(date: .abbreviated, time: .omitted),
                        alignment: .trailing
                    )
                }
                .padding(.vertical, 4)
            }

            Section("Map / Shape Editing") {
                if variant == .radiation {
                    HStack {
                        Button {
                            isMovingSelectedRadiationPin = false
                            isPlacingRadiationPin.toggle()
                        } label: {
                            Label(isPlacingRadiationPin ? "Done Placing" : "Place Pin", systemImage: isPlacingRadiationPin ? "mappin.slash" : "mappin.and.ellipse")
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .tint(isPlacingRadiationPin ? .orange : .blue)

                        if selectedRadiationShape != nil {
                            Button {
                                isPlacingRadiationPin = false
                                isMovingSelectedRadiationPin.toggle()
                            } label: {
                                Label(isMovingSelectedRadiationPin ? "Tap New Location" : "Move", systemImage: isMovingSelectedRadiationPin ? "dot.scope" : "arrow.up.and.down.and.arrow.left.and.right")
                            }
                            .buttonStyle(SecondaryButtonStyle())
                            .tint(isMovingSelectedRadiationPin ? .orange : .blue)

                            Button {
                                isPlacingRadiationPin = false
                                isMovingSelectedRadiationPin = false
                                showRadiationPinConfig = true
                            } label: {
                                Label("Edit", systemImage: "pencil")
                            }
                            .buttonStyle(SecondaryButtonStyle())
                            .tint(.blue)
                        }

                        Spacer()

                        if !isPlacingRadiationPin {
                            Text("Pan / Zoom Map")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    radiationPinEditingSection(
                        scenario: scenario,
                        selectedCoordinate: selectedRadiationCoordinate,
                        selectedSelectionKey: selectedShapeID?.uuidString,
                        isPlacementEnabled: isPlacingRadiationPin
                    )
                    Text(isPlacingRadiationPin
                         ? "Tap the map to place a radiation pin. The Radiation sheet opens so you can set dose, background, and shielding."
                         : (isMovingSelectedRadiationPin && selectedRadiationShape != nil
                            ? "Tap a new map location to move the selected pin. Then tap Edit to save the updated location and rates."
                            : (selectedRadiationShape != nil
                               ? "Select Move to reposition the selected pin, or Edit to change dose/background/shielding."
                               : "Move the map to the area you want, then tap Place Pin.")))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                } else {
                    HStack {
                        Button {
                            isDrawingShape.toggle()
                            if isDrawingShape {
                                draftPolygonVertices.removeAll()
                            }
                        } label: {
                            Label(isDrawingShape ? "Done Drawing" : "Add Shape", systemImage: isDrawingShape ? "hand.draw" : "pencil.tip.crop.circle.badge.plus")
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .tint(isDrawingShape ? .orange : .blue)

                        Spacer()

                        if !isDrawingShape {
                            Text("Pan / Zoom Map")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    polygonDrawingSection(
                        scenario: scenario,
                        existingNamedPolys: existingNamedPolys,
                        polygonBackedShapes: polygonBackedShapes,
                        selectedPolygonCenter: selectedPolygonCenter,
                        selectedPolygonCoordinates: selectedPolygonCoordinates
                    )

                    Text(isDrawingShape
                         ? "Draw the polygon with your finger or Apple Pencil. When you lift, the loop becomes the shape. For Air Monitor, this opens the configuration pop-up."
                         : "Move the map to the area you want, then tap Add Shape to start drawing.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    HStack {
                        Spacer()
                        Button("Undo") {
                            _ = draftPolygonVertices.popLast()
                        }
                        .disabled(draftPolygonVertices.isEmpty || !isDrawingShape)
                        Button("Clear") {
                            draftPolygonVertices.removeAll()
                        }
                        .disabled(draftPolygonVertices.isEmpty)
                    }
                }
            }

            if variant == .airMonitor {
                Section("Add / Save Shape") {
                    TextField("Shape Name", text: $newShapeName)
                    Button("Save Polygon") {
                        Task {
                            let shapeName = newShapeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nextZoneName : newShapeName
                            await store.addPolygonShape(
                                to: scenarioID,
                                description: shapeName,
                                vertices: draftPolygonVertices,
                                variant: variant
                            )
                            if store.errorMessage == nil {
                                draftPolygonVertices.removeAll()
                                newShapeName = nextZoneName
                            } else {
                                newShapeName = shapeName
                            }
                        }
                    }
                    .disabled(draftPolygonVertices.count < 3)

                    Button("Add Placeholder Shape (No Geometry)") {
                        Task {
                            let shapeName = newShapeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nextZoneName : newShapeName
                            await store.addShape(to: scenarioID, description: shapeName, variant: variant)
                            if store.errorMessage == nil {
                                newShapeName = nextZoneName
                            } else {
                                newShapeName = shapeName
                            }
                        }
                    }
                }
            }

            Section("Shapes (\(shapes.count))") {
                if shapes.isEmpty {
                    Text("No shapes yet")
                        .foregroundStyle(.secondary)
                }
                ForEach(shapes) { shape in
                    VStack(alignment: .leading, spacing: 6) {
                        shapeRow(for: shape)
                        if selectedShapeID == shape.id {
                            HStack(spacing: 12) {
                                Button {
                                    if variant == .airMonitor {
                                        beginEditingShapeFromMap(shape)
                                    } else if variant == .pH {
                                        beginEditingShapeFromMap(shape)
                                    } else if variant == .radiation {
                                        beginEditingRadiationPin(shape)
                                    } else {
                                        selectedShapeDetailText = detailText(for: shape)
                                        showShapeDetail = true
                                    }
                                } label: {
                                    Label("Edit", systemImage: "pencil")
                                }
                                .buttonStyle(SecondaryButtonStyle())
                                .tint(.blue)

                                Button(role: .destructive) {
                                    Task { await store.deleteShape(shape) }
                                    if selectedShapeID == shape.id { selectedShapeID = nil }
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                                .buttonStyle(SecondaryButtonStyle())
                                .tint(.red)
                            }
                            .buttonStyle(.borderless)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                        }
                    }
                    .padding(.vertical, 4)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selectedShapeID = (selectedShapeID == shape.id) ? nil : shape.id
                        }
                    }
                    .listRowBackground(
                        (selectedShapeID == shape.id) ? Color.yellow.opacity(0.15) : Color.clear
                    )
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Setup Scenario Details")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: scenarioID) {
            await store.loadShapes(for: scenarioID)
        }
        .onAppear {
            applyDefaultZoneNameIfNeeded()
        }
        .onChange(of: shapes.count) { _ in
            applyDefaultZoneNameIfNeeded()
        }
        .alert("Shape Details", isPresented: $showShapeDetail) {
            Button("OK", role: .cancel) { showShapeDetail = false }
        } message: {
            Text(selectedShapeDetailText)
        }
    }

    @ViewBuilder
    private func polygonDrawingSection(
        scenario: Scenario,
        existingNamedPolys: [NamedPolygon],
        polygonBackedShapes: [GeoSimShape],
        selectedPolygonCenter: CLLocationCoordinate2D?,
        selectedPolygonCoordinates: [CLLocationCoordinate2D]?
    ) -> some View {
        PolygonDrawingMapView(
            draftVertices: $draftPolygonVertices,
            centerCoordinate: scenarioCoordinate(for: scenario),
            scenarioTitle: scenario.scenarioName,
            existingPolygons: existingNamedPolys,
            onClosedLoop: { vertices in
                guard vertices.count >= 3 else { return }
                if variant == .airMonitor {
                    applyDefaultZoneNameIfNeeded()
                    resetChemicalEntriesForNewPolygonIfNeeded()
                    resetSamplingModesForNewPolygon()
                    polygonShapeColor = .orange
                    editingShapeID = nil
                    pendingClosedLoopVertices = vertices
                    isDrawingShape = false
                    showAirMonitorPolygonConfig = true
                } else if variant == .pH {
                    applyDefaultZoneNameIfNeeded()
                    polygonShapeColor = .orange
                    pHValueText = "7.0"
                    editingShapeID = nil
                    pendingClosedLoopVertices = vertices
                    isDrawingShape = false
                    showPHPaperPolygonConfig = true
                }
            },
            selectedPolygonCenter: selectedPolygonCenter,
            selectedPolygonCoordinates: selectedPolygonCoordinates,
            selectedPolygonSelectionKey: selectedShapeID?.uuidString,
            onExistingPolygonSelected: { index in
                guard (variant == .airMonitor || variant == .pH), polygonBackedShapes.indices.contains(index) else { return }
                beginEditingShapeFromMap(polygonBackedShapes[index])
            },
            isDrawingEnabled: isDrawingShape
        )
        .frame(height: 780)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .hazmatPanel()
    }

    @ViewBuilder
    private func radiationPinEditingSection(scenario: Scenario, isPlacementEnabled: Bool = false) -> some View {
        radiationPinEditingSection(
            scenario: scenario,
            selectedCoordinate: nil,
            selectedSelectionKey: nil,
            isPlacementEnabled: isPlacementEnabled
        )
    }

    @ViewBuilder
    private func radiationPinEditingSection(
        scenario: Scenario,
        selectedCoordinate: CLLocationCoordinate2D?,
        selectedSelectionKey: String?,
        isPlacementEnabled: Bool
    ) -> some View {
        Group {
            if #available(iOS 17.0, *) {
                RadiationPinPlacementMapPanel(
                    pins: radiationEditorPins,
                    fallbackCenter: scenarioCoordinate(for: scenario)
                    ,
                    onCoordinateSelected: { coordinate in
                        if isMovingSelectedRadiationPin,
                           let shapeID = editingShapeID ?? selectedShapeID,
                           let shape = shapes.first(where: { $0.id == shapeID }) {
                            moveSelectedRadiationPin(shape, to: coordinate)
                        } else if isPlacingRadiationPin {
                            beginCreatingRadiationPin(at: coordinate)
                        } else {
                            // Ignore taps unless the trainer explicitly chose Move or Place Pin.
                        }
                    },
                    onExistingPinSelected: { shapeID in
                        guard let shape = shapes.first(where: { $0.id == shapeID }) else { return }
                        selectRadiationPinForMove(shape)
                    },
                    selectedCoordinate: selectedCoordinate,
                    selectedSelectionKey: selectedSelectionKey,
                    isPlacementEnabled: isPlacementEnabled
                )
                .frame(height: 780)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .hazmatPanel()
            } else {
                Text("Radiation pin map editor requires iOS 17 or newer.")
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func airMonitorPolygonSheet(scenario: Scenario) -> some View {
        NavigationView {
            Form {
                Section("Polygon") {
                    TextField("Shape Name", text: $newShapeName)
                }

                Section("Air Monitor Configuration") {
                    ForEach($polygonChemicalEntries) { $entry in
                        chemicalEntryRow(entry: $entry)
                    }
                    .onDelete(perform: deleteChemicalRows)

                    Button {
                        addChemicalEntry()
                    } label: {
                        Label("Add Chemical", systemImage: "plus")
                    }
                }
            }
            .navigationTitle("Air Monitor Polygon")
        }
        .frame(minWidth: 520, minHeight: 700)
        .hazmatBackground()
    }

    @ViewBuilder
    private func radiationPinSheet() -> some View {
        NavigationView {
            Form {
                Section("Radiation Pin") {
                    TextField("Pin Name", text: $newShapeName)
                    if let coordinate = pendingRadiationCoordinate {
                        HStack(alignment: .firstTextBaseline) {
                            Text("Location")
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text("\(coordinate.latitude.formatted(.number.precision(.fractionLength(6)))), \(coordinate.longitude.formatted(.number.precision(.fractionLength(6))))")
                                .multilineTextAlignment(.trailing)
                                .font(.subheadline)
                        }
                    }
                }

                Section("Radiation Configuration") {
                    HStack {
                        Text("Dose Equivalent")
                        Spacer()
                        TextField("", text: $radiationDoseRate)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 120)
                    }
                    Picker("Dose Unit", selection: $radiationDoseUnit) {
                        ForEach(radiationDoseUnitOptions, id: \.self) { unit in
                            Text(unit).tag(unit)
                        }
                    }
                    HStack {
                        Text("Exposure Rate")
                        Spacer()
                        TextField("", text: $radiationBackground)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 120)
                            .onChange(of: radiationBackground) { _ in
                                radiationBackgroundWasEdited = true
                            }
                    }
                    Picker("Exposure Unit", selection: $radiationExposureUnit) {
                        ForEach(radiationExposureUnitOptions, id: \.self) { unit in
                            Text(unit).tag(unit)
                        }
                    }
                    HStack {
                        Text("Shielding")
                        Spacer()
                        Picker("Shielding", selection: $radiationShielding) {
                            ForEach(radiationShieldingOptions, id: \.self) { option in
                                Text(option).tag(option)
                            }
                        }
                        .labelsHidden()
                    }
                }
            }
            .navigationTitle("Radiation Pin")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        showRadiationPinConfig = false
                        if editingShapeID == nil {
                            pendingRadiationCoordinate = nil
                        }
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        guard let coordinate = pendingRadiationCoordinate else { return }
                        Task {
                            let shapeName = newShapeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nextZoneName : newShapeName
                            let normalizedBackground: String = {
                                if editingShapeID == nil && !radiationBackgroundWasEdited {
                                    // New radiation pins default to zero background unless trainer explicitly edits it.
                                    return "0.0"
                                }
                                return radiationBackground
                            }()
                            if let editingID = editingShapeID {
                                await store.updateRadiationPinShape(
                                    id: editingID,
                                    description: shapeName,
                                    coordinate: coordinate,
                                    doseRate: radiationDoseRate,
                                    doseUnit: radiationDoseUnit,
                                    background: normalizedBackground,
                                    exposureUnit: radiationExposureUnit,
                                    shielding: radiationShielding
                                )
                            } else {
                                await store.addRadiationPinShape(
                                    to: scenarioID,
                                    description: shapeName,
                                    coordinate: coordinate,
                                    doseRate: radiationDoseRate,
                                    doseUnit: radiationDoseUnit,
                                    background: normalizedBackground,
                                    exposureUnit: radiationExposureUnit,
                                    shielding: radiationShielding
                                )
                            }
                            if store.errorMessage == nil {
                                editingShapeID = nil
                                pendingRadiationCoordinate = nil
                                showRadiationPinConfig = false
                                newShapeName = nextZoneName
                                resetRadiationPinInputs()
                            } else {
                                newShapeName = shapeName
                            }
                        }
                    }
                    .disabled(pendingRadiationCoordinate == nil || !isValidNumericText(radiationDoseRate) || !isValidNumericText(radiationBackground))
                }
            }
        }
        .frame(minWidth: 520, minHeight: 520)
    }

    @ViewBuilder
    private func pHPolygonSheet() -> some View {
        NavigationView {
            Form {
                Section("Polygon") {
                    TextField("Shape Name", text: $newShapeName)
                    ColorPicker("Shape Color", selection: $polygonShapeColor, supportsOpacity: false)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("pH Color Presets")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 88), spacing: 8)], spacing: 8) {
                            ForEach(pHColorPresets) { preset in
                                Button {
                                    polygonShapeColor = preset.color
                                } label: {
                                    HStack(spacing: 6) {
                                        Circle()
                                            .fill(preset.color)
                                            .frame(width: 12, height: 12)
                                        Text(preset.name)
                                            .font(.caption)
                                            .lineLimit(1)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 6)
                                    .padding(.horizontal, 8)
                                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                Section("pH Configuration") {
                    HStack {
                        Text("pH")
                        Spacer()
                        TextField("", text: $pHValueText)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 120)
                    }
                    Text("Enter the pH value for this zone.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("pH Polygon")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        showPHPaperPolygonConfig = false
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        guard let pHValue = Double(pHValueText.trimmingCharacters(in: .whitespacesAndNewlines)) else { return }
                        Task {
                            let shapeName = newShapeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nextZoneName : newShapeName
                            if let editingID = editingShapeID {
                                await store.updatePolygonShape(
                                    id: editingID,
                                    description: shapeName,
                                    vertices: pendingClosedLoopVertices,
                                    variant: variant,
                                    displayColorHex: polygonShapeColor.hexRGBAString,
                                    pHValue: pHValue
                                )
                            } else {
                                await store.addPolygonShape(
                                    to: scenarioID,
                                    description: shapeName,
                                    vertices: pendingClosedLoopVertices,
                                    variant: variant,
                                    displayColorHex: polygonShapeColor.hexRGBAString,
                                    pHValue: pHValue
                                )
                            }
                            if store.errorMessage == nil {
                                draftPolygonVertices.removeAll()
                                pendingClosedLoopVertices.removeAll()
                                editingShapeID = nil
                                showPHPaperPolygonConfig = false
                                newShapeName = nextZoneName
                                pHValueText = "7.0"
                            } else {
                                newShapeName = shapeName
                            }
                        }
                    }
                    .disabled(pendingClosedLoopVertices.count < 3 || !isValidNumericText(pHValueText))
                }
            }
        }
        .frame(minWidth: 520, minHeight: 520)
        .hazmatBackground()
    }

    @ViewBuilder
    private func airMonitorPolygonSheet() -> some View {
        NavigationView {
            Form {
                Section("Polygon") {
                    TextField("Shape Name", text: $newShapeName)
                    ColorPicker("Shape Color", selection: $polygonShapeColor, supportsOpacity: false)
                }

                Section("Air Monitor Configuration") {
                    ForEach($polygonChemicalEntries) { $entry in
                        chemicalEntryRow(entry: $entry)
                    }
                    .onDelete(perform: deleteChemicalRows)

                    Button {
                        addChemicalEntry()
                    } label: {
                        Label("Add Chemical", systemImage: "plus")
                    }
                }

                Section("High Sampling") {
                    samplingModeSection(
                        channel: "Oxygen",
                        highEnabled: $oxygenHighEnabled,
                        highFeatherPercent: $oxygenHighFeatherPercent,
                        lowEnabled: $oxygenLowEnabled,
                        lowFeatherPercent: $oxygenLowFeatherPercent
                    )
                    samplingModeSection(
                        channel: "LEL",
                        highEnabled: $lelHighEnabled,
                        highFeatherPercent: $lelHighFeatherPercent,
                        lowEnabled: $lelLowEnabled,
                        lowFeatherPercent: $lelLowFeatherPercent
                    )
                    samplingModeSection(
                        channel: "CO",
                        highEnabled: $carbonMonoxideHighEnabled,
                        highFeatherPercent: $carbonMonoxideHighFeatherPercent,
                        lowEnabled: $carbonMonoxideLowEnabled,
                        lowFeatherPercent: $carbonMonoxideLowFeatherPercent
                    )
                    samplingModeSection(
                        channel: "H2S",
                        highEnabled: $hydrogenSulfideHighEnabled,
                        highFeatherPercent: $hydrogenSulfideHighFeatherPercent,
                        lowEnabled: $hydrogenSulfideLowEnabled,
                        lowFeatherPercent: $hydrogenSulfideLowFeatherPercent
                    )
                    samplingModeSection(
                        channel: "PID",
                        highEnabled: $pidHighEnabled,
                        highFeatherPercent: $pidHighFeatherPercent,
                        lowEnabled: $pidLowEnabled,
                        lowFeatherPercent: $pidLowFeatherPercent
                    )
                }
            }
            .navigationTitle("Air Monitor Polygon")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        showAirMonitorPolygonConfig = false
                        if editingShapeID == nil {
                            resetSamplingModesForNewPolygon()
                        }
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        Task {
                            let shapeName = newShapeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nextZoneName : newShapeName

                            if let editingID = editingShapeID {
                                await store.updatePolygonShape(
                                    id: editingID,
                                    description: shapeName,
                                    vertices: pendingClosedLoopVertices,
                                    variant: variant,
                                    displayColorHex: polygonShapeColor.hexRGBAString,
                                    chemicalReadings: polygonChemicalEntries.compactMap { $0.toShapeChemicalReading() },
                                    oxygenHighSamplingMode: oxygenHighEnabled ? "high" : nil,
                                    oxygenHighFeatherPercent: oxygenHighEnabled ? Double(oxygenHighFeatherPercent) : nil,
                                    oxygenLowSamplingMode: oxygenLowEnabled ? "low" : nil,
                                    oxygenLowFeatherPercent: oxygenLowEnabled ? Double(oxygenLowFeatherPercent) : nil,
                                    lelHighSamplingMode: lelHighEnabled ? "high" : nil,
                                    lelHighFeatherPercent: lelHighEnabled ? Double(lelHighFeatherPercent) : nil,
                                    lelLowSamplingMode: lelLowEnabled ? "low" : nil,
                                    lelLowFeatherPercent: lelLowEnabled ? Double(lelLowFeatherPercent) : nil,
                                    carbonMonoxideHighSamplingMode: carbonMonoxideHighEnabled ? "high" : nil,
                                    carbonMonoxideHighFeatherPercent: carbonMonoxideHighEnabled ? Double(carbonMonoxideHighFeatherPercent) : nil,
                                    carbonMonoxideLowSamplingMode: carbonMonoxideLowEnabled ? "low" : nil,
                                    carbonMonoxideLowFeatherPercent: carbonMonoxideLowEnabled ? Double(carbonMonoxideLowFeatherPercent) : nil,
                                    hydrogenSulfideHighSamplingMode: hydrogenSulfideHighEnabled ? "high" : nil,
                                    hydrogenSulfideHighFeatherPercent: hydrogenSulfideHighEnabled ? Double(hydrogenSulfideHighFeatherPercent) : nil,
                                    hydrogenSulfideLowSamplingMode: hydrogenSulfideLowEnabled ? "low" : nil,
                                    hydrogenSulfideLowFeatherPercent: hydrogenSulfideLowEnabled ? Double(hydrogenSulfideLowFeatherPercent) : nil,
                                    pidHighSamplingMode: pidHighEnabled ? "high" : nil,
                                    pidHighFeatherPercent: pidHighEnabled ? Double(pidHighFeatherPercent) : nil,
                                    pidLowSamplingMode: pidLowEnabled ? "low" : nil,
                                    pidLowFeatherPercent: pidLowEnabled ? Double(pidLowFeatherPercent) : nil
                                )
                            } else {
                                await store.addPolygonShape(
                                    to: scenarioID,
                                    description: shapeName,
                                    vertices: pendingClosedLoopVertices,
                                    variant: variant,
                                    displayColorHex: polygonShapeColor.hexRGBAString,
                                    chemicalReadings: polygonChemicalEntries.compactMap { $0.toShapeChemicalReading() },
                                    oxygenHighSamplingMode: oxygenHighEnabled ? "high" : nil,
                                    oxygenHighFeatherPercent: oxygenHighEnabled ? Double(oxygenHighFeatherPercent) : nil,
                                    oxygenLowSamplingMode: oxygenLowEnabled ? "low" : nil,
                                    oxygenLowFeatherPercent: oxygenLowEnabled ? Double(oxygenLowFeatherPercent) : nil,
                                    lelHighSamplingMode: lelHighEnabled ? "high" : nil,
                                    lelHighFeatherPercent: lelHighEnabled ? Double(lelHighFeatherPercent) : nil,
                                    lelLowSamplingMode: lelLowEnabled ? "low" : nil,
                                    lelLowFeatherPercent: lelLowEnabled ? Double(lelLowFeatherPercent) : nil,
                                    carbonMonoxideHighSamplingMode: carbonMonoxideHighEnabled ? "high" : nil,
                                    carbonMonoxideHighFeatherPercent: carbonMonoxideHighEnabled ? Double(carbonMonoxideHighFeatherPercent) : nil,
                                    carbonMonoxideLowSamplingMode: carbonMonoxideLowEnabled ? "low" : nil,
                                    carbonMonoxideLowFeatherPercent: carbonMonoxideLowEnabled ? Double(carbonMonoxideLowFeatherPercent) : nil,
                                    hydrogenSulfideHighSamplingMode: hydrogenSulfideHighEnabled ? "high" : nil,
                                    hydrogenSulfideHighFeatherPercent: hydrogenSulfideHighEnabled ? Double(hydrogenSulfideHighFeatherPercent) : nil,
                                    hydrogenSulfideLowSamplingMode: hydrogenSulfideLowEnabled ? "low" : nil,
                                    hydrogenSulfideLowFeatherPercent: hydrogenSulfideLowEnabled ? Double(hydrogenSulfideLowFeatherPercent) : nil,
                                    pidHighSamplingMode: pidHighEnabled ? "high" : nil,
                                    pidHighFeatherPercent: pidHighEnabled ? Double(pidHighFeatherPercent) : nil,
                                    pidLowSamplingMode: pidLowEnabled ? "low" : nil,
                                    pidLowFeatherPercent: pidLowEnabled ? Double(pidLowFeatherPercent) : nil
                                )
                            }
                            if store.errorMessage == nil {
                                draftPolygonVertices.removeAll()
                                pendingClosedLoopVertices.removeAll()
                                editingShapeID = nil
                                showAirMonitorPolygonConfig = false
                                newShapeName = nextZoneName
                            } else {
                                newShapeName = shapeName
                            }
                        }
                    }
                    .disabled(pendingClosedLoopVertices.count < 3 || polygonChemicalEntries.contains { !$0.isNumericValueValid })
                }
            }
        }
        .frame(minWidth: 520, minHeight: 700)
        .hazmatBackground()
    }

    @ViewBuilder
    private func samplingModeSection(
        channel: String,
        highEnabled: Binding<Bool>,
        highFeatherPercent: Binding<String>,
        lowEnabled: Binding<Bool>,
        lowFeatherPercent: Binding<String>
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(channel)
                .font(.subheadline)
                .fontWeight(.semibold)

            HStack {
                Toggle("High Sampling", isOn: highEnabled)
                if highEnabled.wrappedValue {
                    TextField("Feather %", text: highFeatherPercent)
                        .keyboardType(.decimalPad)
                        .frame(maxWidth: 80)
                        .onChange(of: highFeatherPercent.wrappedValue) { newValue in
                            validateAndClampFeatherPercent(highFeatherPercent, newValue: newValue)
                        }
                }
            }

            HStack {
                Toggle("Low Sampling", isOn: lowEnabled)
                if lowEnabled.wrappedValue {
                    TextField("Feather %", text: lowFeatherPercent)
                        .keyboardType(.decimalPad)
                        .frame(maxWidth: 80)
                        .onChange(of: lowFeatherPercent.wrappedValue) { newValue in
                            validateAndClampFeatherPercent(lowFeatherPercent, newValue: newValue)
                        }
                }
            }
        }
    }

    private func validateAndClampFeatherPercent(_ binding: Binding<String>, newValue: String) {
        let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            binding.wrappedValue = ""
            return
        }
        guard let value = Double(trimmed), value >= 0, value <= 100 else {
            binding.wrappedValue = newValue.count > 0 ? String(newValue.dropLast()) : "0"
            return
        }
        binding.wrappedValue = trimmed
    }

    private func scenarioCoordinate(for scenario: Scenario) -> CLLocationCoordinate2D? {
        guard let lat = scenario.latitude, let lon = scenario.longitude else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    private func editPins(for scenario: Scenario, shapes: [GeoSimShape], variant: EditorVariant) -> [MapPinItem] {
        var pins: [MapPinItem] = []

        if let coord = scenarioCoordinate(for: scenario) {
            pins.append(MapPinItem(title: scenario.scenarioName, coordinate: coord, tint: .blue))
        }

        if variant == .radiation {
            let radiationPins = shapes.compactMap { shape -> MapPinItem? in
                guard let latText = shape.radLatitude,
                      let lonText = shape.radLongitude,
                      let lat = Double(latText),
                      let lon = Double(lonText) else {
                    return nil
                }
                return MapPinItem(
                    title: shape.description,
                    coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lon),
                    tint: .orange
                )
            }
            pins.append(contentsOf: radiationPins)
        }

        return pins
    }

    private func existingPolygonCoordinates(from shapes: [GeoSimShape]) -> [[CLLocationCoordinate2D]] {
        shapes.compactMap { shape in
            guard shape.kind == .polygon else { return nil }
            return parsePolygonCoordinates(from: shape.shapeGeoJSON)
        }
    }

    private func parsePolygonCoordinates(from geoJSON: String) -> [CLLocationCoordinate2D]? {
        guard let data = geoJSON.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = object["type"] as? String,
              type.caseInsensitiveCompare("Polygon") == .orderedSame,
              let coordinates = object["coordinates"] as? [[[Double]]],
              let firstRing = coordinates.first else {
            return nil
        }

        let points = firstRing.compactMap { pair -> CLLocationCoordinate2D? in
            guard pair.count >= 2 else { return nil }
            return CLLocationCoordinate2D(latitude: pair[1], longitude: pair[0])
        }

        if points.count >= 4 {
            let first = points.first!
            let last = points.last!
            if first.latitude == last.latitude && first.longitude == last.longitude {
                return Array(points.dropLast())
            }
        }

        return points.isEmpty ? nil : points
    }

    private var nextZoneName: String {
        let usedZoneNumbers = Set(shapes.compactMap { parseZoneNumber(from: $0.description) })
        var candidate = 1
        while usedZoneNumbers.contains(candidate) {
            candidate += 1
        }
        return "Zone \(candidate)"
    }

    private func applyDefaultZoneNameIfNeeded() {
        if newShapeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            newShapeName = nextZoneName
        }
    }

    private func parseZoneNumber(from description: String) -> Int? {
        let trimmed = description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.lowercased().hasPrefix("zone ") else { return nil }
        let suffix = trimmed.dropFirst(5).trimmingCharacters(in: .whitespacesAndNewlines)
        return Int(suffix)
    }

    @ViewBuilder
    private func scenarioDetailCell(title: String, value: String, alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.weight(.medium))
                .multilineTextAlignment(alignment == .leading ? .leading : alignment == .center ? .center : .trailing)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : alignment == .center ? .center : .trailing)
    }

    private func beginEditingShapeFromMap(_ shape: GeoSimShape) {
        selectedShapeID = shape.id
        editingShapeID = shape.id
        newShapeName = shape.description
        polygonShapeColor = Color(shapeHex: shape.displayColorHex) ?? .orange
        if let coords = parsePolygonCoordinates(from: shape.shapeGeoJSON) {
            pendingClosedLoopVertices = coords
        } else {
            pendingClosedLoopVertices = []
        }

        if variant == .airMonitor {
            if !shape.chemicalReadings.isEmpty {
                polygonChemicalEntries = shape.chemicalReadings.map { reading in
                    PolygonChemicalEntry(
                        catalogAbbr: reading.abbr,
                        name: reading.name,
                        unit: reading.unit,
                        value: reading.value
                    )
                }
            } else {
                resetChemicalEntriesForNewPolygonIfNeeded(force: true)
            }

            // Load oxygen sampling modes
            oxygenHighEnabled = shape.oxygenHighSamplingMode != nil
            oxygenHighFeatherPercent = shape.oxygenHighFeatherPercent.map { String(format: "%.0f", $0) } ?? "0"
            oxygenLowEnabled = shape.oxygenLowSamplingMode != nil
            oxygenLowFeatherPercent = shape.oxygenLowFeatherPercent.map { String(format: "%.0f", $0) } ?? "0"

            // Load LEL sampling modes
            lelHighEnabled = shape.lelHighSamplingMode != nil
            lelHighFeatherPercent = shape.lelHighFeatherPercent.map { String(format: "%.0f", $0) } ?? "0"
            lelLowEnabled = shape.lelLowSamplingMode != nil
            lelLowFeatherPercent = shape.lelLowFeatherPercent.map { String(format: "%.0f", $0) } ?? "0"

            // Load carbon monoxide sampling modes
            carbonMonoxideHighEnabled = shape.carbonMonoxideHighSamplingMode != nil
            carbonMonoxideHighFeatherPercent = shape.carbonMonoxideHighFeatherPercent.map { String(format: "%.0f", $0) } ?? "0"
            carbonMonoxideLowEnabled = shape.carbonMonoxideLowSamplingMode != nil
            carbonMonoxideLowFeatherPercent = shape.carbonMonoxideLowFeatherPercent.map { String(format: "%.0f", $0) } ?? "0"

            // Load hydrogen sulfide sampling modes
            hydrogenSulfideHighEnabled = shape.hydrogenSulfideHighSamplingMode != nil
            hydrogenSulfideHighFeatherPercent = shape.hydrogenSulfideHighFeatherPercent.map { String(format: "%.0f", $0) } ?? "0"
            hydrogenSulfideLowEnabled = shape.hydrogenSulfideLowSamplingMode != nil
            hydrogenSulfideLowFeatherPercent = shape.hydrogenSulfideLowFeatherPercent.map { String(format: "%.0f", $0) } ?? "0"

            // Load PID sampling modes
            pidHighEnabled = shape.pidHighSamplingMode != nil
            pidHighFeatherPercent = shape.pidHighFeatherPercent.map { String(format: "%.0f", $0) } ?? "0"
            pidLowEnabled = shape.pidLowSamplingMode != nil
            pidLowFeatherPercent = shape.pidLowFeatherPercent.map { String(format: "%.0f", $0) } ?? "0"

            showAirMonitorPolygonConfig = true
        } else if variant == .pH {
            pHValueText = shape.pH.map { String(format: "%.1f", $0) } ?? "7.0"
            showPHPaperPolygonConfig = true
        }
    }

    private var radiationShieldingOptions: [String] {
        ["None", "Light", "Moderate", "Heavy", "Concrete", "Lead", "Steel"]
    }

    private var pHColorPresets: [PHColorPreset] {
        [
            PHColorPreset(name: "Strong Acid", color: .red),
            PHColorPreset(name: "Acid", color: .orange),
            PHColorPreset(name: "Weak Acid", color: .yellow),
            PHColorPreset(name: "Neutral", color: .green),
            PHColorPreset(name: "Weak Base", color: .mint),
            PHColorPreset(name: "Base", color: .blue),
            PHColorPreset(name: "Strong Base", color: .purple)
        ]
    }

    private var radiationDoseUnitOptions: [String] {
        ["nSv/h", "uSv/h", "mSv/h", "Sv/h"]
    }

    private var radiationExposureUnitOptions: [String] {
        ["uR/h", "mR/h", "R/h"]
    }

    private var radiationEditorPins: [MapPinItem] {
        var pins: [MapPinItem] = shapes.compactMap { shape in
            let coordinate = (shape.id == editingShapeID ? pendingRadiationCoordinate : nil) ?? radiationCoordinate(for: shape)
            guard let coordinate else { return nil }
            let dose = shape.doseRate ?? "-"
            let title = "\(shape.description) (\(dose) \(shape.radDoseUnit ?? "nSv/h"))"
            return MapPinItem(
                id: shape.id,
                title: title,
                coordinate: coordinate,
                tint: selectedShapeID == shape.id ? .yellow : .red,
                linkedShapeID: shape.id
            )
        }

        if let pendingRadiationCoordinate, editingShapeID == nil {
            pins.append(
                MapPinItem(
                    title: editingShapeID == nil ? "New Radiation Pin" : (newShapeName.isEmpty ? "Edit Radiation Pin" : newShapeName),
                    coordinate: pendingRadiationCoordinate,
                    tint: .orange
                )
            )
        }

        return pins
    }

    private func radiationCoordinate(for shape: GeoSimShape) -> CLLocationCoordinate2D? {
        guard let latText = shape.radLatitude,
              let lonText = shape.radLongitude,
              let lat = Double(latText),
              let lon = Double(lonText) else {
            return nil
        }
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    private func beginCreatingRadiationPin(at coordinate: CLLocationCoordinate2D) {
        selectedShapeID = nil
        editingShapeID = nil
        isPlacingRadiationPin = false
        isMovingSelectedRadiationPin = false
        pendingRadiationCoordinate = coordinate
        newShapeName = nextZoneName
        resetRadiationPinInputs()
        showRadiationPinConfig = true
    }

    private func beginEditingRadiationPin(_ shape: GeoSimShape) {
        selectedShapeID = shape.id
        editingShapeID = shape.id
        isMovingSelectedRadiationPin = false
        newShapeName = shape.description
        pendingRadiationCoordinate = radiationCoordinate(for: shape)
        radiationDoseRate = shape.doseRate ?? "0.0"
        radiationBackground = shape.background ?? "0.0"
        radiationBackgroundWasEdited = false
        radiationShielding = shape.shielding ?? "None"
        radiationDoseUnit = shape.radDoseUnit ?? "nSv/h"
        radiationExposureUnit = shape.radExposureUnit ?? "mR/h"
        showRadiationPinConfig = true
    }

    private func selectRadiationPinForMove(_ shape: GeoSimShape) {
        selectedShapeID = shape.id
        editingShapeID = shape.id
        isMovingSelectedRadiationPin = false
        newShapeName = shape.description
        pendingRadiationCoordinate = radiationCoordinate(for: shape)
        radiationDoseRate = shape.doseRate ?? "0.0"
        radiationBackground = shape.background ?? "0.0"
        radiationBackgroundWasEdited = false
        radiationShielding = shape.shielding ?? "None"
        radiationDoseUnit = shape.radDoseUnit ?? "nSv/h"
        radiationExposureUnit = shape.radExposureUnit ?? "mR/h"
        showRadiationPinConfig = false
    }

    private func moveSelectedRadiationPin(_ shape: GeoSimShape, to coordinate: CLLocationCoordinate2D) {
        // Keep the existing radiation settings/name but let the trainer tap a new map location
        // without covering the map with the edit sheet.
        if editingShapeID != shape.id {
            selectRadiationPinForMove(shape)
        }
        selectedShapeID = shape.id
        editingShapeID = shape.id
        pendingRadiationCoordinate = coordinate
        isPlacingRadiationPin = false
        isMovingSelectedRadiationPin = false
        showRadiationPinConfig = false
    }

    private var selectedRadiationShape: GeoSimShape? {
        guard variant == .radiation, let selectedShapeID else { return nil }
        return shapes.first(where: { $0.id == selectedShapeID })
    }

    private func resetRadiationPinInputs() {
        radiationDoseRate = "0.0"
        radiationBackground = "0.0"
        radiationBackgroundWasEdited = false
        radiationShielding = "None"
        radiationDoseUnit = "nSv/h"
        radiationExposureUnit = "mR/h"
    }

    private func polygonCenterForSelectedShape(in polygonBackedShapes: [GeoSimShape]) -> CLLocationCoordinate2D? {
        guard let selectedShapeID else { return nil }
        guard let shape = polygonBackedShapes.first(where: { $0.id == selectedShapeID }) else { return nil }
        guard let coords = parsePolygonCoordinates(from: shape.shapeGeoJSON), !coords.isEmpty else { return nil }
        let lat = coords.map(\.latitude).reduce(0, +) / Double(coords.count)
        let lon = coords.map(\.longitude).reduce(0, +) / Double(coords.count)
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    private func polygonCoordinatesForSelectedShape(in polygonBackedShapes: [GeoSimShape]) -> [CLLocationCoordinate2D]? {
        guard let selectedShapeID else { return nil }
        guard let shape = polygonBackedShapes.first(where: { $0.id == selectedShapeID }) else { return nil }
        return parsePolygonCoordinates(from: shape.shapeGeoJSON)
    }

    private func radiationCoordinateForSelectedShape() -> CLLocationCoordinate2D? {
        guard let selectedShapeID else { return nil }
        guard let shape = shapes.first(where: { $0.id == selectedShapeID }) else { return nil }
        return radiationCoordinate(for: shape)
    }

    private func isValidNumericText(_ value: String) -> Bool {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        let pattern = "^-?\\d*(?:\\.\\d*)?$"
        return trimmed.range(of: pattern, options: .regularExpression) != nil
    }

    @ViewBuilder
    private func chemicalEntryRow(entry: Binding<PolygonChemicalEntry>) -> some View {
        let selectedCatalogItem = catalogItem(for: entry.wrappedValue.catalogAbbr) ?? ChemicalCatalog.all[0]
        let unitOptions = selectedCatalogItem.units

        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Picker("Chemical", selection: entry.catalogAbbr) {
                    ForEach(ChemicalCatalog.all) { item in
                        Text("\(item.name) (\(item.abbr))").tag(item.abbr)
                    }
                }
                .labelsHidden()
                .onChange(of: entry.wrappedValue.catalogAbbr) { newAbbr in
                    if let item = catalogItem(for: newAbbr) {
                        entry.wrappedValue.name = item.name
                        if !item.units.contains(entry.wrappedValue.unit) {
                            entry.wrappedValue.unit = item.units.first ?? ""
                        }
                    }
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                TextField("Value", text: entry.value)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 110)
                    .onChange(of: entry.wrappedValue.value) { newValue in
                        // Sanitize input: keep digits, optional leading '-', and at most one '.'
                        var filtered = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
                        // Remove invalid characters
                        filtered = filtered.filter { ("0"..."9").contains(String($0)) || $0 == "." || $0 == "-" }
                        // Enforce leading '-' only at start
                        if let minusIndex = filtered.firstIndex(of: "-") {
                            if minusIndex != filtered.startIndex { filtered.remove(at: minusIndex) }
                        }
                        // Enforce a single decimal point
                        var sawDot = false
                        filtered = String(filtered.filter { ch in
                            if ch == "." {
                                if sawDot { return false }
                                sawDot = true
                                return true
                            }
                            return true
                        })
                        if filtered != entry.wrappedValue.value {
                            entry.wrappedValue.value = filtered
                        }
                    }
                Picker("Unit", selection: entry.unit) {
                    ForEach(unitOptions, id: \.self) { unit in
                        Text(unit).tag(unit)
                    }
                }
                .labelsHidden()
                .pickerStyle(.menu)
                if !entry.wrappedValue.isNumericValueValid {
                    Text("Enter a numeric value")
                        .font(.caption2)
                        .foregroundStyle(.red)
                }
            }
        }
    }

    private func addChemicalEntry() {
        let first = ChemicalCatalog.all.first ?? ChemicalCatalogItem(name: "Oxygen", abbr: "O2", units: ["%vol"])
        polygonChemicalEntries.append(
            PolygonChemicalEntry(
                catalogAbbr: first.abbr,
                name: first.name,
                unit: first.units.first ?? "",
                value: ""
            )
        )
    }

    private func deleteChemicalRows(at offsets: IndexSet) {
        polygonChemicalEntries.remove(atOffsets: offsets)
        if polygonChemicalEntries.isEmpty {
            resetChemicalEntriesForNewPolygonIfNeeded(force: true)
        }
    }

    private func resetChemicalEntriesForNewPolygonIfNeeded(force: Bool = false) {
        if force || polygonChemicalEntries.isEmpty {
            polygonChemicalEntries = PolygonChemicalEntry.defaultFourGasEntries()
        }
    }

    private func resetSamplingModesForNewPolygon() {
        oxygenHighEnabled = false
        oxygenHighFeatherPercent = "0"
        oxygenLowEnabled = false
        oxygenLowFeatherPercent = "0"
        lelHighEnabled = false
        lelHighFeatherPercent = "0"
        lelLowEnabled = false
        lelLowFeatherPercent = "0"
        carbonMonoxideHighEnabled = false
        carbonMonoxideHighFeatherPercent = "0"
        carbonMonoxideLowEnabled = false
        carbonMonoxideLowFeatherPercent = "0"
        hydrogenSulfideHighEnabled = false
        hydrogenSulfideHighFeatherPercent = "0"
        hydrogenSulfideLowEnabled = false
        hydrogenSulfideLowFeatherPercent = "0"
        pidHighEnabled = false
        pidHighFeatherPercent = "0"
        pidLowEnabled = false
        pidLowFeatherPercent = "0"
    }

    private func catalogItem(for abbr: String) -> ChemicalCatalogItem? {
        ChemicalCatalog.all.first(where: { $0.abbr == abbr })
    }

    private func airMonitorSummary(for shape: GeoSimShape) -> String {
        if !shape.chemicalReadings.isEmpty {
            return shape.chemicalReadings
                .prefix(4)
                .map { "\($0.abbr) \($0.value) \($0.unit)" }
                .joined(separator: " | ")
        }
        return "O2 \(shape.oxygen ?? "-") | LEL \(shape.lel ?? "-") | CO \(shape.carbonMonoxide ?? "-") | H2S \(shape.hydrogenSulfide ?? "-")"
    }

    private func detailText(for shape: GeoSimShape) -> String {
        switch variant {
        case .airMonitor:
            return airMonitorSummary(for: shape)
        case .radiation:
            return "Dose Equivalent \(shape.doseRate ?? "-") \(shape.radDoseUnit ?? "nSv/h")\nExposure Rate \(shape.background ?? "-") \(shape.radExposureUnit ?? "mR/h")\nShielding \(shape.shielding ?? "-")"
        case .pH:
            if let pH = shape.pH { return String(format: "pH %.1f", pH) }
            return "pH -"
        }
    }
}

struct PolygonChemicalEntry: Identifiable, Hashable {
    let id = UUID()
    var catalogAbbr: String
    var name: String
    var unit: String
    var value: String

    var isNumericValueValid: Bool {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return true }
        // Allow leading minus, digits, and a single decimal point
        let pattern = "^-?\\d*(?:\\.\\d*)?$"
        return trimmed.range(of: pattern, options: .regularExpression) != nil
    }

    func toShapeChemicalReading() -> ShapeChemicalReading? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return ShapeChemicalReading(name: name, abbr: catalogAbbr, value: trimmed, unit: unit)
    }

    static func defaultFourGasEntries() -> [PolygonChemicalEntry] {
        ChemicalCatalog.defaultsForFourGas.map { item in
            let defaultValue: String
            switch item.abbr {
            case "O2": defaultValue = "20.8"
            case "CO", "H2S", "LEL": defaultValue = "0"
            default: defaultValue = ""
            }
            return PolygonChemicalEntry(
                catalogAbbr: item.abbr,
                name: item.name,
                unit: item.units.first ?? "",
                value: defaultValue
            )
        }
    }
}

private struct PHColorPreset: Identifiable {
    var id: String { name }
    let name: String
    let color: Color
}

private extension Color {
    init?(shapeHex: String?) {
        guard let shapeHex else { return nil }
        var hex = shapeHex.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !hex.isEmpty else { return nil }
        if hex.hasPrefix("#") { hex.removeFirst() }
        guard hex.count == 6 || hex.count == 8 else { return nil }

        var value: UInt64 = 0
        guard Scanner(string: hex).scanHexInt64(&value) else { return nil }

        let r, g, b, a: Double
        if hex.count == 8 {
            r = Double((value & 0xFF00_0000) >> 24) / 255
            g = Double((value & 0x00FF_0000) >> 16) / 255
            b = Double((value & 0x0000_FF00) >> 8) / 255
            a = Double(value & 0x0000_00FF) / 255
        } else {
            r = Double((value & 0xFF00_00) >> 16) / 255
            g = Double((value & 0x00FF_00) >> 8) / 255
            b = Double((value & 0x0000_FF) / 255)
            a = 1
        }

        self = Color(red: r, green: g, blue: b, opacity: a)
    }

    var hexRGBAString: String {
        let uiColor = UIColor(self)
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        guard uiColor.getRed(&red, green: &green, blue: &blue, alpha: &alpha) else {
            return "#FFA500FF"
        }
        return String(
            format: "#%02X%02X%02X%02X",
            Int(round(red * 255)),
            Int(round(green * 255)),
            Int(round(blue * 255)),
            Int(round(alpha * 255))
        )
    }
}
