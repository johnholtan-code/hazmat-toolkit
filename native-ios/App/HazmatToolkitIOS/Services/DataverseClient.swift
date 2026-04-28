import Foundation

struct DataverseEnvironmentConfig: Sendable {
    var baseURL: URL
    var tenantID: String
    var clientID: String
    var scope: String
}

protocol DataverseAccessTokenProvider: Sendable {
    func accessToken() async throws -> String
}

struct DataverseClient: Sendable {
    var config: DataverseEnvironmentConfig
    var tokenProvider: any DataverseAccessTokenProvider
    var session: URLSession = .shared

    func get(path: String, queryItems: [URLQueryItem] = []) async throws -> Data {
        let url = try buildURL(path: path, queryItems: queryItems)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        try await authorize(&request)
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return data
    }

    func post(path: String, body: Data) async throws -> Data {
        let url = try buildURL(path: path, queryItems: [])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try await authorize(&request)
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return data
    }

    private func authorize(_ request: inout URLRequest) async throws {
        let token = try await tokenProvider.accessToken()
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("4.0", forHTTPHeaderField: "OData-MaxVersion")
        request.setValue("4.0", forHTTPHeaderField: "OData-Version")
    }

    private func buildURL(path: String, queryItems: [URLQueryItem]) throws -> URL {
        guard var components = URLComponents(url: config.baseURL, resolvingAgainstBaseURL: false) else {
            throw URLError(.badURL)
        }
        let normalized = path.hasPrefix("/") ? path : "/\(path)"
        components.path = normalized
        components.queryItems = queryItems.isEmpty ? nil : queryItems
        guard let url = components.url else { throw URLError(.badURL) }
        return url
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard (200..<300).contains(http.statusCode) else {
            throw NSError(domain: "DataverseClient", code: http.statusCode, userInfo: [
                NSLocalizedDescriptionKey: String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            ])
        }
    }
}
