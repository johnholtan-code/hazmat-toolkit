import SwiftUI
import CoreLocation
import HazMatDesignSystem

struct CreateScenarioView: View {
    @ObservedObject var store: AppStore
    let device: DetectionDevice
    @StateObject private var locationProvider = CurrentLocationProvider()

    @State private var scenarioName = ""
    @State private var trainerName = ""
    @State private var scenarioDate = Date()
    @State private var latitude = ""
    @State private var longitude = ""
    @State private var addressSearchText = ""
    @State private var isSearchingAddress = false
    @State private var addressSearchStatus: String?
    @State private var addressSearchError: String?
    @State private var isSaving = false
    @State private var geocoder = CLGeocoder()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Scenario Details")
                        .font(.headline)
                        .foregroundStyle(.secondary)

                    HStack(spacing: 12) {
                        TextField("Scenario Name", text: $scenarioName)
                            .textFieldStyle(.roundedBorder)
                        TextField("Trainer Name", text: $trainerName)
                            .textFieldStyle(.roundedBorder)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }

                    HStack(spacing: 12) {
                        DatePicker("Scenario Date", selection: $scenarioDate, displayedComponents: .date)
                            .datePickerStyle(.compact)
                        HStack {
                            Text("Device")
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(device.rawValue)
                                .multilineTextAlignment(.trailing)
                        }
                        .padding(.horizontal, 10)
                        .frame(minHeight: 34)
                        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
                .hazmatPanel()

                saveScenarioButton

                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 10) {
                        TextField("Search Address", text: $addressSearchText)
                            .textInputAutocapitalization(.words)
                            .autocorrectionDisabled()
                            .textFieldStyle(.roundedBorder)
                            .controlSize(.small)
                            .frame(maxWidth: 320, alignment: .leading)

                        Button {
                            Task { await searchAddressAndUpdateLocation() }
                        } label: {
                            if isSearchingAddress {
                                ProgressView()
                            } else {
                                Label("Find", systemImage: "magnifyingglass")
                            }
                        }
                        .buttonStyle(SecondaryButtonStyle())
                        .disabled(isSearchingAddress || addressSearchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .fixedSize()

                        Spacer(minLength: 0)
                    }
                    .frame(minHeight: 32)

                    if let status = addressSearchStatus {
                        Text(status)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }

                    if let error = addressSearchError {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }

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
                .hazmatPanel()
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .hazmatBackground()
        .navigationTitle("Create New Scenario")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if trainerName.isEmpty {
                trainerName = store.currentTrainerName
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

    private func searchAddressAndUpdateLocation() async {
        let query = addressSearchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return }

        isSearchingAddress = true
        addressSearchError = nil
        addressSearchStatus = nil
        defer { isSearchingAddress = false }

        if geocoder.isGeocoding {
            geocoder.cancelGeocode()
        }

        do {
            let placemarks = try await geocoder.geocodeAddressString(query)
            guard let location = placemarks.first?.location else {
                addressSearchError = "No location found for that address."
                return
            }

            setCoordinateFields(location.coordinate)

            let placemark = placemarks.first
            let resolvedParts = [
                placemark?.name,
                placemark?.locality,
                placemark?.administrativeArea
            ]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }

            addressSearchStatus = resolvedParts.isEmpty
                ? "Location found and map updated."
                : "Found: \(resolvedParts.joined(separator: ", "))"
        } catch {
            addressSearchError = "Address lookup failed: \(error.localizedDescription)"
        }
    }

    private var saveScenarioButton: some View {
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
                    .frame(maxWidth: .infinity)
            } else {
                Text("Save Scenario")
                    .frame(maxWidth: .infinity)
            }
        }
        .buttonStyle(PrimaryButtonStyle())
        .disabled(isSaving)
    }

}
