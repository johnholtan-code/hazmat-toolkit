import SwiftUI
import CoreLocation
import HazMatDesignSystem

struct CreateScenarioView: View {
    @ObservedObject var store: AppStore
    let device: DetectionDevice
    @StateObject private var locationProvider = CurrentLocationProvider()

    @State private var scenarioName = ""
    @State private var trainerName = "trainer@example.com"
    @State private var scenarioDate = Date()
    @State private var latitude = ""
    @State private var longitude = ""
    @State private var isSaving = false

    var body: some View {
        Form {
            Section("Scenario Details") {
                HStack(alignment: .top, spacing: 16) {
                    scenarioDetailCell(
                        title: "Name",
                        value: scenarioName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "New Scenario" : scenarioName,
                        alignment: .leading
                    )
                    Divider()
                    scenarioDetailCell(
                        title: "Device",
                        value: device.rawValue,
                        alignment: .center
                    )
                    Divider()
                    scenarioDetailCell(
                        title: "Date",
                        value: scenarioDate.formatted(date: .abbreviated, time: .omitted),
                        alignment: .trailing
                    )
                }
                .padding(.vertical, 4)
                .hazmatPanel()

                TextField("Scenario Name", text: $scenarioName)
                TextField("Trainer Name", text: $trainerName)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                DatePicker("Scenario Date", selection: $scenarioDate, displayedComponents: .date)
                if device != .phPaper {
                    TextField("Latitude", text: $latitude)
                        .keyboardType(.decimalPad)
                        .disabled(true)
                    TextField("Longitude", text: $longitude)
                        .keyboardType(.decimalPad)
                        .disabled(true)
                }
                HStack {
                    Text("Detection Device")
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(device.rawValue)
                        .multilineTextAlignment(.trailing)
                }
            }

            Section("Map") {
                if #available(iOS 17.0, *) {
                    LocationPickerMapPanel(
                        title: "CreateScenario Map",
                        subtitle: device == .phPaper
                            ? "Defaults to your current location. Tap a spot on the map to set the scenario location."
                            : "Defaults to your current location. Tap a spot on the map to set the scenario location and fill latitude/longitude.",
                        selectedPinTitle: scenarioName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Selected Scenario Location" : scenarioName,
                        selectedCoordinate: createCoordinate,
                        currentLocationCoordinate: locationProvider.currentCoordinate,
                        fallbackCenter: createCoordinate
                    ) { coordinate in
                        setCoordinateFields(coordinate)
                    }
                } else {
                    Text("Map picker requires iOS 17 or newer.")
                        .foregroundStyle(.secondary)
                }
            }

            Section {
                Button {
                    isSaving = true
                    Task {
                        _ = await store.createScenario(
                            name: scenarioName,
                            trainerName: trainerName,
                            date: scenarioDate,
                            latitudeText: latitude,
                            longitudeText: longitude,
                            device: device
                        )
                        isSaving = false
                    }
                } label: {
                    if isSaving {
                        ProgressView()
                    } else {
                        Text("Save Scenario")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(isSaving)
            }
        }
        .hazmatBackground()
        .navigationTitle("Create New Scenario")
        .onAppear {
            if trainerName.isEmpty {
                trainerName = store.currentTrainerEmail
            }
            locationProvider.requestCurrentLocation()
            applyCurrentLocationDefaultIfNeeded()
        }
        .onChange(of: locationProvider.currentCoordinate?.latitude) { _ in
            applyCurrentLocationDefaultIfNeeded()
        }
        .onChange(of: locationProvider.currentCoordinate?.longitude) { _ in
            applyCurrentLocationDefaultIfNeeded()
        }
    }

    private var createCoordinate: CLLocationCoordinate2D? {
        guard let lat = Double(latitude), let lon = Double(longitude) else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    private func applyCurrentLocationDefaultIfNeeded() {
        guard latitude.isEmpty, longitude.isEmpty, let current = locationProvider.currentCoordinate else { return }
        setCoordinateFields(current)
    }

    private func setCoordinateFields(_ coordinate: CLLocationCoordinate2D) {
        latitude = coordinate.latitude.formatted(.number.precision(.fractionLength(6)))
        longitude = coordinate.longitude.formatted(.number.precision(.fractionLength(6)))
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
}
