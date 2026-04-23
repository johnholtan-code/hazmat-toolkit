import Foundation

enum DataverseClientError: Error {
    case notConfigured
    case notImplemented
    case invalidResponse
    case httpError(Int, String)
}

extension DataverseClientError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "HazmatAPIBaseURL is not configured. Set it in the Trainee app Info.plist (for example, http://localhost:8080 or your Mac's LAN IP for a physical iPhone)."
        case .notImplemented:
            return "This app feature is not implemented yet."
        case .invalidResponse:
            return "The server returned an invalid response."
        case .httpError(let statusCode, let body):
            let trimmedBody = body.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmedBody.isEmpty {
                return "Server error (\(statusCode))."
            }
            return "Server error (\(statusCode)): \(trimmedBody)"
        }
    }
}

final class DataverseClient {
    struct JoinedSessionGeoShape {
        struct Coordinate {
            var latitude: Double
            var longitude: Double
        }

        var id: String
        var description: String
        var kind: String
        var sortOrder: Int
        var radiusM: Double?
        var center: Coordinate?
        var polygonRings: [[Coordinate]]
        var oxygen: Double?
        var lel: Double?
        var carbonMonoxide: Double?
        var hydrogenSulfide: Double?
        var pid: Double?
        var doseRate: Double?
        var background: Double?
        var shielding: Double?
        var radiationLatitude: Double?
        var radiationLongitude: Double?
        var pH: Double?
    }

    struct JoinedSession {
        var scenario: Scenario
        var accessToken: String
        var sessionID: String
        var sessionStatus: String
        var isLive: Bool?
        var trainerName: String?
        var centerLatitude: Double?
        var centerLongitude: Double?
        var geoShapes: [JoinedSessionGeoShape]
    }

    struct SessionState {
        var status: String
        var isLive: Bool
        var scenario: Scenario?
        var centerLatitude: Double?
        var centerLongitude: Double?
        var geoShapes: [JoinedSessionGeoShape]
    }

    func fetchGeoSimScenarios() async throws -> [Scenario] {
        // Power App references Dataverse tables (GeoSim Scenarios / GeoSims / GeoTrackings).
        // Implement OAuth (MSAL) + Web API requests here when scenario listing is needed.
        throw DataverseClientError.notImplemented
    }

    func joinSession(joinCode: String, traineeName: String) async throws -> JoinedSession {
        guard let baseURL = configuredBaseURL() else {
            throw DataverseClientError.notConfigured
        }

        let body = JoinSessionRequest(
            joinCode: joinCode.trimmingCharacters(in: .whitespacesAndNewlines),
            traineeName: traineeName.trimmingCharacters(in: .whitespacesAndNewlines),
            deviceType: "air_monitor"
        )

        var request = URLRequest(url: baseURL.appendingPathComponent("v1/sessions/join"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let encoder = JSONEncoder()
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw DataverseClientError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw DataverseClientError.httpError(http.statusCode, String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)")
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        let joined = try decodeWithDebug(JoinSessionResponse.self, from: data, decoder: decoder)

        return JoinedSession(
            scenario: joined.snapshot.toLegacyScenario(),
            accessToken: joined.token.accessToken,
            sessionID: joined.session.id,
            sessionStatus: joined.session.status,
            isLive: joined.session.isLive,
            trainerName: joined.snapshot.scenario.trainerName,
            centerLatitude: joined.snapshot.scenario.latitude,
            centerLongitude: joined.snapshot.scenario.longitude,
            geoShapes: joined.snapshot.shapes.compactMap { $0.toJoinedGeoShape() }
        )
    }

    func fetchMySessionState(accessToken: String) async throws -> SessionState {
        guard let baseURL = configuredBaseURL() else {
            throw DataverseClientError.notConfigured
        }

        var request = URLRequest(url: baseURL.appendingPathComponent("v1/sessions/me"))
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw DataverseClientError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw DataverseClientError.httpError(http.statusCode, String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)")
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        let payload = try decoder.decode(SessionMeResponse.self, from: data)
        let snapshot = payload.resolvedSnapshot
        return SessionState(
            status: payload.status,
            isLive: payload.isLive,
            scenario: snapshot?.toLegacyScenario(),
            centerLatitude: snapshot?.scenario.latitude,
            centerLongitude: snapshot?.scenario.longitude,
            geoShapes: snapshot?.shapes.compactMap { $0.toJoinedGeoShape() } ?? []
        )
    }

    func uploadTrackingBatch(
        accessToken: String,
        points: [TrackingPointUpload]
    ) async throws {
        guard let baseURL = configuredBaseURL() else {
            throw DataverseClientError.notConfigured
        }
        guard !points.isEmpty else { return }

        var request = URLRequest(url: baseURL.appendingPathComponent("v1/tracking/batches"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let body = TrackingBatchRequest(batchID: UUID().uuidString, points: points.map(TrackingBatchPoint.init))
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw DataverseClientError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw DataverseClientError.httpError(http.statusCode, String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)")
        }
    }

    private func configuredBaseURL() -> URL? {
        if let env = ProcessInfo.processInfo.environment["HAZMAT_API_BASE_URL"],
           let url = URL(string: env),
           !env.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return url
        }
        if let value = Bundle.main.object(forInfoDictionaryKey: "HazmatAPIBaseURL") as? String,
           let url = URL(string: value),
           !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return url
        }
        return nil
    }
}

private func describeDecodingError(_ error: DecodingError) -> String {
    func path(_ codingPath: [CodingKey]) -> String {
        let resolved = codingPath.map { key in
            if let index = key.intValue { return "[\(index)]" }
            return key.stringValue
        }
        return resolved.isEmpty ? "<root>" : resolved.joined(separator: ".")
    }

    switch error {
    case .typeMismatch(let type, let context):
        return "typeMismatch(\(type)) at \(path(context.codingPath)): \(context.debugDescription)"
    case .valueNotFound(let type, let context):
        return "valueNotFound(\(type)) at \(path(context.codingPath)): \(context.debugDescription)"
    case .keyNotFound(let key, let context):
        return "keyNotFound(\(key.stringValue)) at \(path(context.codingPath)): \(context.debugDescription)"
    case .dataCorrupted(let context):
        return "dataCorrupted at \(path(context.codingPath)): \(context.debugDescription)"
    @unknown default:
        return "unknown DecodingError: \(error.localizedDescription)"
    }
}

private func decodeWithDebug<T: Decodable>(
    _ type: T.Type,
    from data: Data,
    decoder: JSONDecoder = JSONDecoder()
) throws -> T {
    do {
        return try decoder.decode(T.self, from: data)
    } catch let decodingError as DecodingError {
        let body = String(data: data.prefix(2048), encoding: .utf8) ?? "<non-utf8>"
        print("JOIN DECODE ERROR: \(describeDecodingError(decodingError))")
        print("JOIN RAW BODY (first 2KB): \(body)")
        throw decodingError
    } catch {
        let body = String(data: data.prefix(2048), encoding: .utf8) ?? "<non-utf8>"
        print("JOIN NON-DECODE ERROR: \(error)")
        print("JOIN RAW BODY (first 2KB): \(body)")
        throw error
    }
}

private extension KeyedDecodingContainer {
    func decodeFlexibleStringIfPresent(forKey key: Key) throws -> String? {
        guard contains(key), try !decodeNil(forKey: key) else { return nil }
        if let value = try? decode(String.self, forKey: key) {
            return value
        }
        if let value = try? decode(Int.self, forKey: key) {
            return String(value)
        }
        if let value = try? decode(Double.self, forKey: key) {
            return String(value)
        }
        if let value = try? decode(Bool.self, forKey: key) {
            return String(value)
        }
        return nil
    }

    func decodeFlexibleDoubleIfPresent(forKey key: Key) throws -> Double? {
        guard contains(key), try !decodeNil(forKey: key) else { return nil }
        if let value = try? decode(Double.self, forKey: key) {
            return value
        }
        if let value = try? decode(Int.self, forKey: key) {
            return Double(value)
        }
        if let value = try? decode(String.self, forKey: key) {
            let cleaned = value.filter { "0123456789.-".contains($0) }
            return Double(cleaned)
        }
        return nil
    }
}

private struct JoinSessionRequest: Encodable {
    var joinCode: String
    var traineeName: String
    var deviceType: String
}

private struct JoinSessionResponse: Decodable {
    struct SessionInfo: Decodable {
        var id: String
        var status: String
        var isLive: Bool?
    }

    struct TokenInfo: Decodable {
        var accessToken: String
    }

    struct SnapshotDTO: Decodable {
        struct ScenarioDTO: Decodable {
            var id: String
            var scenarioName: String
            var trainerName: String?
            var scenarioDate: Date
            var latitude: Double?
            var longitude: Double?
        }

        struct ShapeDTO: Decodable {
            var id: String
            var description: String
            var kind: String
            var sortOrder: Int
            var shapeGeoJSON: String?
            var radiusM: Double?
            var oxygen: String?
            var lel: String?
            var carbonMonoxide: String?
            var hydrogenSulfide: String?
            var pid: String?
            var oxygenHighSamplingMode: String?
            var oxygenHighFeatherPercent: String?
            var oxygenLowSamplingMode: String?
            var oxygenLowFeatherPercent: String?
            var lelHighSamplingMode: String?
            var lelHighFeatherPercent: String?
            var lelLowSamplingMode: String?
            var lelLowFeatherPercent: String?
            var carbonMonoxideHighSamplingMode: String?
            var carbonMonoxideHighFeatherPercent: String?
            var carbonMonoxideLowSamplingMode: String?
            var carbonMonoxideLowFeatherPercent: String?
            var hydrogenSulfideHighSamplingMode: String?
            var hydrogenSulfideHighFeatherPercent: String?
            var hydrogenSulfideLowSamplingMode: String?
            var hydrogenSulfideLowFeatherPercent: String?
            var pidHighSamplingMode: String?
            var pidHighFeatherPercent: String?
            var pidLowSamplingMode: String?
            var pidLowFeatherPercent: String?
            var doseRate: String?
            var background: String?
            var shielding: String?
            var radLatitude: String?
            var radLongitude: String?
            var pH: Double?

            private enum CodingKeys: String, CodingKey {
                case id
                case description
                case kind
                case sortOrder
                case shapeGeoJSON
                case radiusM
                case oxygen
                case lel
                case carbonMonoxide
                case hydrogenSulfide
                case pid
                case oxygenHighSamplingMode
                case oxygenHighFeatherPercent
                case oxygenLowSamplingMode
                case oxygenLowFeatherPercent
                case lelHighSamplingMode
                case lelHighFeatherPercent
                case lelLowSamplingMode
                case lelLowFeatherPercent
                case carbonMonoxideHighSamplingMode
                case carbonMonoxideHighFeatherPercent
                case carbonMonoxideLowSamplingMode
                case carbonMonoxideLowFeatherPercent
                case hydrogenSulfideHighSamplingMode
                case hydrogenSulfideHighFeatherPercent
                case hydrogenSulfideLowSamplingMode
                case hydrogenSulfideLowFeatherPercent
                case pidHighSamplingMode
                case pidHighFeatherPercent
                case pidLowSamplingMode
                case pidLowFeatherPercent
                case doseRate
                case background
                case shielding
                case radLatitude
                case radLongitude
                case pH = "pH"
            }

            init(from decoder: Decoder) throws {
                let container = try decoder.container(keyedBy: CodingKeys.self)
                id = try container.decode(String.self, forKey: .id)
                description = try container.decode(String.self, forKey: .description)
                kind = try container.decode(String.self, forKey: .kind)
                sortOrder = try container.decode(Int.self, forKey: .sortOrder)
                shapeGeoJSON = try container.decodeFlexibleStringIfPresent(forKey: .shapeGeoJSON)
                radiusM = try container.decodeFlexibleDoubleIfPresent(forKey: .radiusM)
                oxygen = try container.decodeFlexibleStringIfPresent(forKey: .oxygen)
                lel = try container.decodeFlexibleStringIfPresent(forKey: .lel)
                carbonMonoxide = try container.decodeFlexibleStringIfPresent(forKey: .carbonMonoxide)
                hydrogenSulfide = try container.decodeFlexibleStringIfPresent(forKey: .hydrogenSulfide)
                pid = try container.decodeFlexibleStringIfPresent(forKey: .pid)
                oxygenHighSamplingMode = try container.decodeFlexibleStringIfPresent(forKey: .oxygenHighSamplingMode)
                oxygenHighFeatherPercent = try container.decodeFlexibleStringIfPresent(forKey: .oxygenHighFeatherPercent)
                oxygenLowSamplingMode = try container.decodeFlexibleStringIfPresent(forKey: .oxygenLowSamplingMode)
                oxygenLowFeatherPercent = try container.decodeFlexibleStringIfPresent(forKey: .oxygenLowFeatherPercent)
                lelHighSamplingMode = try container.decodeFlexibleStringIfPresent(forKey: .lelHighSamplingMode)
                lelHighFeatherPercent = try container.decodeFlexibleStringIfPresent(forKey: .lelHighFeatherPercent)
                lelLowSamplingMode = try container.decodeFlexibleStringIfPresent(forKey: .lelLowSamplingMode)
                lelLowFeatherPercent = try container.decodeFlexibleStringIfPresent(forKey: .lelLowFeatherPercent)
                carbonMonoxideHighSamplingMode = try container.decodeFlexibleStringIfPresent(forKey: .carbonMonoxideHighSamplingMode)
                carbonMonoxideHighFeatherPercent = try container.decodeFlexibleStringIfPresent(forKey: .carbonMonoxideHighFeatherPercent)
                carbonMonoxideLowSamplingMode = try container.decodeFlexibleStringIfPresent(forKey: .carbonMonoxideLowSamplingMode)
                carbonMonoxideLowFeatherPercent = try container.decodeFlexibleStringIfPresent(forKey: .carbonMonoxideLowFeatherPercent)
                hydrogenSulfideHighSamplingMode = try container.decodeFlexibleStringIfPresent(forKey: .hydrogenSulfideHighSamplingMode)
                hydrogenSulfideHighFeatherPercent = try container.decodeFlexibleStringIfPresent(forKey: .hydrogenSulfideHighFeatherPercent)
                hydrogenSulfideLowSamplingMode = try container.decodeFlexibleStringIfPresent(forKey: .hydrogenSulfideLowSamplingMode)
                hydrogenSulfideLowFeatherPercent = try container.decodeFlexibleStringIfPresent(forKey: .hydrogenSulfideLowFeatherPercent)
                pidHighSamplingMode = try container.decodeFlexibleStringIfPresent(forKey: .pidHighSamplingMode)
                pidHighFeatherPercent = try container.decodeFlexibleStringIfPresent(forKey: .pidHighFeatherPercent)
                pidLowSamplingMode = try container.decodeFlexibleStringIfPresent(forKey: .pidLowSamplingMode)
                pidLowFeatherPercent = try container.decodeFlexibleStringIfPresent(forKey: .pidLowFeatherPercent)
                doseRate = try container.decodeFlexibleStringIfPresent(forKey: .doseRate)
                background = try container.decodeFlexibleStringIfPresent(forKey: .background)
                shielding = try container.decodeFlexibleStringIfPresent(forKey: .shielding)
                radLatitude = try container.decodeFlexibleStringIfPresent(forKey: .radLatitude)
                radLongitude = try container.decodeFlexibleStringIfPresent(forKey: .radLongitude)
                pH = try container.decodeFlexibleDoubleIfPresent(forKey: .pH)
            }

            func toJoinedGeoShape() -> DataverseClient.JoinedSessionGeoShape? {
                let parsedGeometry = Self.parseGeometry(shapeGeoJSON)
                return DataverseClient.JoinedSessionGeoShape(
                    id: id,
                    description: description,
                    kind: kind,
                    sortOrder: sortOrder,
                    radiusM: radiusM,
                    center: parsedGeometry.center,
                    polygonRings: parsedGeometry.polygonRings,
                    oxygen: Self.parseDouble(oxygen),
                    lel: Self.parseDouble(lel),
                    carbonMonoxide: Self.parseDouble(carbonMonoxide),
                    hydrogenSulfide: Self.parseDouble(hydrogenSulfide),
                    pid: Self.parseDouble(pid),
                    doseRate: Self.parseDouble(doseRate),
                    background: Self.parseDouble(background),
                    shielding: Self.parseDouble(shielding),
                    radiationLatitude: Self.parseDouble(radLatitude),
                    radiationLongitude: Self.parseDouble(radLongitude),
                    pH: pH
                )
            }

            private static func parseDouble(_ text: String?) -> Double? {
                guard let text else { return nil }
                let cleaned = text.filter { "0123456789.-".contains($0) }
                return Double(cleaned)
            }

            private static func parseGeometry(_ geoJSONString: String?) -> (center: DataverseClient.JoinedSessionGeoShape.Coordinate?, polygonRings: [[DataverseClient.JoinedSessionGeoShape.Coordinate]]) {
                guard let geoJSONString,
                      let data = geoJSONString.data(using: .utf8),
                      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let type = object["type"] as? String else {
                    return (nil, [])
                }

                if type == "Point",
                   let coordinates = object["coordinates"] as? [Any],
                   coordinates.count >= 2,
                   let lon = coordinates[0] as? Double,
                   let lat = coordinates[1] as? Double {
                    return (DataverseClient.JoinedSessionGeoShape.Coordinate(latitude: lat, longitude: lon), [])
                }

                if type == "Polygon",
                   let rings = object["coordinates"] as? [Any] {
                    let parsedRings: [[DataverseClient.JoinedSessionGeoShape.Coordinate]] = rings.compactMap { ring in
                        guard let ringArray = ring as? [Any] else { return nil }
                        let points = ringArray.compactMap { point -> DataverseClient.JoinedSessionGeoShape.Coordinate? in
                            guard let pair = point as? [Any],
                                  pair.count >= 2,
                                  let lon = pair[0] as? Double,
                                  let lat = pair[1] as? Double else { return nil }
                            return DataverseClient.JoinedSessionGeoShape.Coordinate(latitude: lat, longitude: lon)
                        }
                        return points.isEmpty ? nil : points
                    }
                    return (nil, parsedRings)
                }

                return (nil, [])
            }
        }

        var sessionID: String
        var scenario: ScenarioDTO
        var shapes: [ShapeDTO]

        private enum CodingKeys: String, CodingKey {
            case sessionID = "sessionId"
            case scenario
            case shapes
        }

        func toLegacyScenario() -> Scenario {
            let sortedShapes = shapes.sorted { $0.sortOrder < $1.sortOrder }
            let zones = sortedShapes.compactMap { shape -> ScenarioZone? in
                guard Self.isTrainerZoneShape(shape) else { return nil }
                let sampling = Self.makeAirMonitorSampling(from: shape)

                return ScenarioZone(
                    name: shape.description,
                    oxygen: Self.parseDoubleOptional(shape.oxygen) ?? 20.8,
                    lel: Self.parseDoubleOptional(shape.lel) ?? 0,
                    co: Self.parseDoubleOptional(shape.carbonMonoxide) ?? 0,
                    h2s: Self.parseDoubleOptional(shape.hydrogenSulfide) ?? 0,
                    pid: Self.parseDoubleOptional(shape.pid) ?? 0,
                    ph: shape.pH ?? 7.0,
                    airMonitorSampling: sampling
                )
            }
            var zonesWithLatestValuesByName: [ScenarioZone] = []
            for zone in zones {
                if let existingIndex = zonesWithLatestValuesByName.firstIndex(where: { $0.name == zone.name }) {
                    // Trainer updates can emit duplicate shapes; keep the latest sort-order value.
                    zonesWithLatestValuesByName[existingIndex] = zone
                } else {
                    zonesWithLatestValuesByName.append(zone)
                }
            }
            let zonesWithBaseline = [ScenarioZone(name: "OUT", oxygen: 20.8, lel: 0, co: 0, h2s: 0, pid: 0, ph: 7, airMonitorSampling: nil)] + zonesWithLatestValuesByName

            // Prefer the latest configured radiation shape in case older duplicates exist.
            let firstRad = sortedShapes.reversed().first {
                $0.kind.lowercased() == "point" &&
                (
                    Self.parseDoubleOptional($0.doseRate) != nil ||
                    Self.parseDoubleOptional($0.background) != nil ||
                    Self.parseDoubleOptional($0.shielding) != nil
                )
            }

            let defaultDoseAt1m = (firstRad == nil) ? 0.025 : 0.0
            let radSource = Scenario.RadiationSource(
                doseAt1mRph: Self.parseDoubleOptional(firstRad?.doseRate) ?? defaultDoseAt1m,
                backgroundRph: Self.parseDoubleOptional(firstRad?.background) ?? 0.0,
                shielding: Self.parseDoubleOptional(firstRad?.shielding) ?? 1.0
            )

            return Scenario(
                id: scenario.id,
                name: scenario.scenarioName,
                date: scenario.scenarioDate,
                notes: (scenario.trainerName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
                    ? (scenario.trainerName ?? "")
                    : "Trainer",
                radiationSource: radSource,
                zones: zonesWithBaseline
            )
        }

        private static func parseDouble(_ text: String?, default fallback: Double) -> Double {
            guard let text else { return fallback }
            let cleaned = text.filter { "0123456789.-".contains($0) }
            return Double(cleaned) ?? fallback
        }

        private static func makeAirMonitorSampling(from shape: ShapeDTO) -> ScenarioZoneAirMonitorSampling? {
            let oxygen = makeChannelAdjustment(
                highMode: shape.oxygenHighSamplingMode,
                highFeather: shape.oxygenHighFeatherPercent,
                lowMode: shape.oxygenLowSamplingMode,
                lowFeather: shape.oxygenLowFeatherPercent
            )
            let lel = makeChannelAdjustment(
                highMode: shape.lelHighSamplingMode,
                highFeather: shape.lelHighFeatherPercent,
                lowMode: shape.lelLowSamplingMode,
                lowFeather: shape.lelLowFeatherPercent
            )
            let co = makeChannelAdjustment(
                highMode: shape.carbonMonoxideHighSamplingMode,
                highFeather: shape.carbonMonoxideHighFeatherPercent,
                lowMode: shape.carbonMonoxideLowSamplingMode,
                lowFeather: shape.carbonMonoxideLowFeatherPercent
            )
            let h2s = makeChannelAdjustment(
                highMode: shape.hydrogenSulfideHighSamplingMode,
                highFeather: shape.hydrogenSulfideHighFeatherPercent,
                lowMode: shape.hydrogenSulfideLowSamplingMode,
                lowFeather: shape.hydrogenSulfideLowFeatherPercent
            )
            let pid = makeChannelAdjustment(
                highMode: shape.pidHighSamplingMode,
                highFeather: shape.pidHighFeatherPercent,
                lowMode: shape.pidLowSamplingMode,
                lowFeather: shape.pidLowFeatherPercent
            )

            guard oxygen != nil || lel != nil || co != nil || h2s != nil || pid != nil else {
                return nil
            }

            return ScenarioZoneAirMonitorSampling(oxygen: oxygen, lel: lel, co: co, h2s: h2s, pid: pid)
        }

        private static func makeChannelAdjustment(
            highMode: String?,
            highFeather: String?,
            lowMode: String?,
            lowFeather: String?
        ) -> AirMonitorSamplingChannelAdjustment? {
            let high = makeBandAdjustment(mode: highMode, feather: highFeather)
            let low = makeBandAdjustment(mode: lowMode, feather: lowFeather)

            guard high != .unchanged || low != .unchanged else { return nil }
            return AirMonitorSamplingChannelAdjustment(high: high, low: low)
        }

        private static func makeBandAdjustment(mode: String?, feather: String?) -> AirMonitorSamplingBandAdjustment {
            let normalizedMode = (mode ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let usesLowering = normalizedMode == "low"
                || normalizedMode == "down"
                || normalizedMode.contains("lower")
                || normalizedMode.contains("feather")
            let resolvedMode: AirMonitorSamplingAdjustmentMode = usesLowering ? .lower : .normal

            let percent = min(max(parseDoubleOptional(feather) ?? 0, 0), 100)
            guard resolvedMode != .normal, percent > 0 else { return .unchanged }
            return AirMonitorSamplingBandAdjustment(mode: resolvedMode, featherPercent: percent)
        }

        private static func isTrainerZoneShape(_ shape: ShapeDTO) -> Bool {
            parseDoubleOptional(shape.oxygen) != nil ||
            parseDoubleOptional(shape.lel) != nil ||
            parseDoubleOptional(shape.carbonMonoxide) != nil ||
            parseDoubleOptional(shape.hydrogenSulfide) != nil ||
            parseDoubleOptional(shape.pid) != nil ||
            shape.pH != nil ||
            makeAirMonitorSampling(from: shape) != nil
        }

        private static func parseDoubleOptional(_ text: String?) -> Double? {
            guard let text else { return nil }
            let cleaned = text.filter { "0123456789.-".contains($0) }
            guard !cleaned.isEmpty else { return nil }
            return Double(cleaned)
        }
    }

    var session: SessionInfo
    var token: TokenInfo
    var snapshot: SnapshotDTO
}

private struct SessionMeResponse: Decodable {
    var status: String
    var isLive: Bool
    var snapshot: JoinSessionResponse.SnapshotDTO?
    var session: JoinSessionResponse.SessionInfo?
    var scenario: JoinSessionResponse.SnapshotDTO.ScenarioDTO?
    var shapes: [JoinSessionResponse.SnapshotDTO.ShapeDTO]?

    var resolvedSnapshot: JoinSessionResponse.SnapshotDTO? {
        if let snapshot {
            return snapshot
        }
        if let scenario, let shapes {
            return JoinSessionResponse.SnapshotDTO(
                sessionID: session?.id ?? "",
                scenario: scenario,
                shapes: shapes
            )
        }
        return nil
    }
}

struct TrackingPointUpload {
    var clientPointID: UUID
    var recordedAt: Date
    var lat: Double
    var lon: Double
    var accuracyM: Double?
    var speedMps: Double?
    var headingDeg: Double?
    var activeShapeID: String?
    var activeShapeSortOrder: Int?
}

private struct TrackingBatchRequest: Encodable {
    var batchID: String
    var points: [TrackingBatchPoint]

    private enum CodingKeys: String, CodingKey {
        case batchID = "batchId"
        case points
    }
}

private struct TrackingBatchPoint: Encodable {
    var clientPointID: String
    var recordedAt: Date
    var lat: Double
    var lon: Double
    var accuracyM: Double?
    var speedMps: Double?
    var headingDeg: Double?
    var activeShapeID: String?
    var activeShapeSortOrder: Int?

    private enum CodingKeys: String, CodingKey {
        case clientPointID = "clientPointId"
        case recordedAt
        case lat
        case lon
        case accuracyM
        case speedMps
        case headingDeg
        case activeShapeID = "activeShapeId"
        case activeShapeSortOrder
    }

    init(_ point: TrackingPointUpload) {
        self.clientPointID = point.clientPointID.uuidString
        self.recordedAt = point.recordedAt
        self.lat = point.lat
        self.lon = point.lon
        self.accuracyM = point.accuracyM
        self.speedMps = point.speedMps
        self.headingDeg = point.headingDeg
        self.activeShapeID = point.activeShapeID
        self.activeShapeSortOrder = point.activeShapeSortOrder
    }
}
