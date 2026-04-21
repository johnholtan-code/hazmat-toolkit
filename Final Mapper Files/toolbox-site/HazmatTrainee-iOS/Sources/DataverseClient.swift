import Foundation

struct DataverseRecord: Decodable {
    let id: String
}

enum DataverseClientError: Error {
    case notConfigured
    case notImplemented
}

final class DataverseClient {
    func fetchGeoSimScenarios() async throws -> [Scenario] {
        // Power App references Dataverse tables (GeoSim Scenarios / GeoSims / GeoTrackings).
        // This native project ships with SampleScenarios.json because the .msapp package does not include live table rows.
        // Implement OAuth (MSAL) + Web API requests here to replace local sample data.
        throw DataverseClientError.notImplemented
    }
}
