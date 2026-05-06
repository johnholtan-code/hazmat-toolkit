import Foundation

struct HazmatAPIEnvironmentConfig: Sendable {
    var baseURL: URL
}

protocol HazmatAPIAccessTokenProvider: Sendable {
    func accessToken() async throws -> String?
}

enum HazmatAPIError: LocalizedError {
    case invalidURL
    case httpStatus(Int, String)
    case unsupportedResponse

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL."
        case .httpStatus(let code, let body):
            return "API error (\(code)): \(body)"
        case .unsupportedResponse:
            return "Unsupported server response."
        }
    }
}

protocol HazmatAPIClient: Sendable {
    // Trainer authoring endpoints
    func listScenarios() async throws -> [APIScenarioDTO]
    func createScenario(_ request: APICreateScenarioRequest) async throws -> APIScenarioDTO
    func updateScenario(id: UUID, _ request: APIUpdateScenarioRequest) async throws -> APIScenarioDTO
    func deleteScenario(id: UUID) async throws

    func listShapes(scenarioID: UUID) async throws -> [APIShapeDTO]
    func createShape(scenarioID: UUID, _ request: APIUpsertShapeRequest) async throws -> APIShapeDTO
    func upsertShape(scenarioID: UUID, shapeID: UUID, _ request: APIUpsertShapeRequest) async throws -> APIShapeDTO
    func deleteShape(scenarioID: UUID, shapeID: UUID) async throws

    // Current watch-mode repository contract (legacy shape of data expected by AppStore)
    func listTrackingPoints(scenarioName: String) async throws -> [APITrackingPointDTO]
    func listSessionParticipants(sessionID: UUID) async throws -> [APIWatchParticipantDTO]
    func listSessionTracking(sessionID: UUID, since: Date?, limit: Int?) async throws -> APIWatchTrackingEnvelopeDTO
    func listSessionZoneEvents(sessionID: UUID, since: Date?, limit: Int?) async throws -> APIWatchZoneEventEnvelopeDTO
    func listSessions(scenarioID: UUID) async throws -> [APIScenarioSessionSummaryDTO]
    func latestSession(scenarioID: UUID) async throws -> APILatestSessionResponseDTO

    // Trainee session endpoints (MVP)
    func joinSession(_ request: APIJoinSessionRequest) async throws -> APIJoinSessionResponse
    func uploadTrackingBatch(_ request: APITrackingBatchRequest) async throws -> APITrackingBatchResponse
}

struct URLSessionHazmatAPIClient: HazmatAPIClient {
    var config: HazmatAPIEnvironmentConfig
    var tokenProvider: (any HazmatAPIAccessTokenProvider)? = nil
    var trainerRefHeaderValue: String? = nil
    var session: URLSession

    init(
        config: HazmatAPIEnvironmentConfig,
        tokenProvider: (any HazmatAPIAccessTokenProvider)? = nil,
        trainerRefHeaderValue: String? = nil,
        session: URLSession? = nil
    ) {
        self.config = config
        self.tokenProvider = tokenProvider
        self.trainerRefHeaderValue = trainerRefHeaderValue

        if let session {
            self.session = session
        } else {
            let configuration = URLSessionConfiguration.default
            configuration.httpMaximumConnectionsPerHost = 4
            configuration.httpShouldUsePipelining = true
            configuration.timeoutIntervalForRequest = 30
            configuration.timeoutIntervalForResource = 60
            configuration.waitsForConnectivity = true
            self.session = URLSession(configuration: configuration)
        }
    }

    private var decoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }

    private var encoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.keyEncodingStrategy = .convertToSnakeCase
        return encoder
    }

    func listScenarios() async throws -> [APIScenarioDTO] {
        try await send(path: "/v1/scenarios", method: "GET")
    }

    func createScenario(_ request: APICreateScenarioRequest) async throws -> APIScenarioDTO {
        try await send(path: "/v1/scenarios", method: "POST", body: request)
    }

    func updateScenario(id: UUID, _ request: APIUpdateScenarioRequest) async throws -> APIScenarioDTO {
        try await send(path: "/v1/scenarios/\(id.uuidString)", method: "PATCH", body: request)
    }

    func deleteScenario(id: UUID) async throws {
        let _: EmptyAPIResponse = try await send(path: "/v1/scenarios/\(id.uuidString)", method: "DELETE")
    }

    func listShapes(scenarioID: UUID) async throws -> [APIShapeDTO] {
        try await send(path: "/v1/scenarios/\(scenarioID.uuidString)/shapes", method: "GET")
    }

    func createShape(scenarioID: UUID, _ request: APIUpsertShapeRequest) async throws -> APIShapeDTO {
        try await send(
            path: "/v1/scenarios/\(scenarioID.uuidString)/shapes",
            method: "POST",
            body: request
        )
    }

    func upsertShape(scenarioID: UUID, shapeID: UUID, _ request: APIUpsertShapeRequest) async throws -> APIShapeDTO {
        try await send(
            path: "/v1/scenarios/\(scenarioID.uuidString)/shapes/\(shapeID.uuidString)",
            method: "PUT",
            body: request
        )
    }

    func deleteShape(scenarioID: UUID, shapeID: UUID) async throws {
        let _: EmptyAPIResponse = try await send(
            path: "/v1/scenarios/\(scenarioID.uuidString)/shapes/\(shapeID.uuidString)",
            method: "DELETE"
        )
    }

    func listTrackingPoints(scenarioName: String) async throws -> [APITrackingPointDTO] {
        let query = [URLQueryItem(name: "scenarioName", value: scenarioName)]
        return try await send(path: "/v1/watch/tracking", method: "GET", queryItems: query)
    }

    func listSessionParticipants(sessionID: UUID) async throws -> [APIWatchParticipantDTO] {
        try await send(path: "/v1/sessions/\(sessionID.uuidString)/watch/participants", method: "GET")
    }

    func listSessionTracking(sessionID: UUID, since: Date? = nil, limit: Int? = nil) async throws -> APIWatchTrackingEnvelopeDTO {
        var query: [URLQueryItem] = []
        if let since {
            query.append(URLQueryItem(name: "since", value: ISO8601DateFormatter().string(from: since)))
        }
        if let limit {
            query.append(URLQueryItem(name: "limit", value: String(limit)))
        }
        return try await send(path: "/v1/sessions/\(sessionID.uuidString)/watch/tracking", method: "GET", queryItems: query)
    }

    func listSessionZoneEvents(sessionID: UUID, since: Date? = nil, limit: Int? = nil) async throws -> APIWatchZoneEventEnvelopeDTO {
        var query: [URLQueryItem] = []
        if let since {
            query.append(URLQueryItem(name: "since", value: ISO8601DateFormatter().string(from: since)))
        }
        if let limit {
            query.append(URLQueryItem(name: "limit", value: String(limit)))
        }
        return try await send(path: "/v1/sessions/\(sessionID.uuidString)/watch/zone-events", method: "GET", queryItems: query)
    }

    func listSessions(scenarioID: UUID) async throws -> [APIScenarioSessionSummaryDTO] {
        let query = [URLQueryItem(name: "scenarioId", value: scenarioID.uuidString)]
        return try await send(path: "/v1/sessions", method: "GET", queryItems: query)
    }

    func latestSession(scenarioID: UUID) async throws -> APILatestSessionResponseDTO {
        let query = [URLQueryItem(name: "scenarioId", value: scenarioID.uuidString)]
        return try await send(path: "/v1/sessions/latest", method: "GET", queryItems: query)
    }

    func joinSession(_ request: APIJoinSessionRequest) async throws -> APIJoinSessionResponse {
        try await send(path: "/v1/sessions/join", method: "POST", body: request)
    }

    func uploadTrackingBatch(_ request: APITrackingBatchRequest) async throws -> APITrackingBatchResponse {
        try await send(path: "/v1/tracking/batches", method: "POST", body: request)
    }

    private func send<Response: Decodable>(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = []
    ) async throws -> Response {
        try await send(path: path, method: method, queryItems: queryItems, bodyData: nil)
    }

    private func send<RequestBody: Encodable, Response: Decodable>(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        body: RequestBody
    ) async throws -> Response {
        let data = try encoder.encode(body)
        return try await send(path: path, method: method, queryItems: queryItems, bodyData: data)
    }

    private func send<Response: Decodable>(
        path: String,
        method: String,
        queryItems: [URLQueryItem],
        bodyData: Data?
    ) async throws -> Response {
        let request = try await buildRequest(path: path, method: method, queryItems: queryItems, bodyData: bodyData)
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data, request: request)

        if Response.self == EmptyAPIResponse.self {
            return EmptyAPIResponse() as! Response
        }

        return try decoder.decode(Response.self, from: data)
    }

    private func buildRequest(
        path: String,
        method: String,
        queryItems: [URLQueryItem],
        bodyData: Data?
    ) async throws -> URLRequest {
        guard var components = URLComponents(url: config.baseURL, resolvingAgainstBaseURL: false) else {
            throw HazmatAPIError.invalidURL
        }

        let normalizedPath = path.hasPrefix("/") ? path : "/\(path)"
        if components.path.isEmpty || components.path == "/" {
            components.path = normalizedPath
        } else {
            components.path = components.path + normalizedPath
        }
        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }
        guard let url = components.url else { throw HazmatAPIError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let bodyData {
            request.httpBody = bodyData
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        if let provider = tokenProvider, let token = try await provider.accessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let trainerRef = trainerRefHeaderValue?.trimmingCharacters(in: .whitespacesAndNewlines),
           !trainerRef.isEmpty {
            request.setValue(trainerRef, forHTTPHeaderField: "X-Trainer-Ref")
        }

        return request
    }

    private func validate(response: URLResponse, data: Data, request: URLRequest) throws {
        guard let http = response as? HTTPURLResponse else {
            throw HazmatAPIError.unsupportedResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            let method = request.httpMethod ?? "UNKNOWN"
            let url = request.url?.absoluteString ?? "<unknown-url>"
            let contextualBody = "[\(method) \(url)] \(body)"
            throw HazmatAPIError.httpStatus(http.statusCode, contextualBody)
        }
    }
}

private struct EmptyAPIResponse: Codable {}
