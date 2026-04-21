import SwiftUI
import HazMatDesignSystem
import Capacitor
import UIKit
import WebKit

enum ToolboxTier: String, CaseIterable, Identifiable, Hashable {
    case tier1 = "Tier 1"
    case tier2 = "Tier 2"
    case tier3 = "Tier 3"
    case tier4 = "Tier 4"

    var id: String { rawValue }

    var title: String { rawValue }

    var priceLabel: String {
        switch self {
        case .tier1: return "Free"
        case .tier2: return "$25/yr"
        case .tier3: return "$50/yr"
        case .tier4: return "$500/yr"
        }
    }

    var benefitLabel: String {
        switch self {
        case .tier1: return "Free Tools"
        case .tier2: return "Vault workflow + Downloads"
        case .tier3: return "Premium Training Tools"
        case .tier4: return "Hazmat ToolK.I.T. Simulator"
        }
    }
}

enum ToolboxModule: String, CaseIterable, Identifiable, Hashable {
    case incidentMapper = "Tier 1"
    case airMonitoring = "Tier 2"
    case radiationDetection = "Tier 3"
    case phPaper = "Tier 4"

    var id: String { rawValue }

    var subtitle: String {
        switch self {
        case .incidentMapper: return "Free tools"
        case .airMonitoring: return "Access to Presentations and Photos"
        case .radiationDetection: return "Access to Trainer Tools"
        case .phPaper: return "Hazmat ToolK.I.T. Simulator"
        }
    }

    var drawerLabel: String {
        tierTitle
    }

    var tier: ToolboxTier {
        switch self {
        case .incidentMapper: return .tier1
        case .airMonitoring: return .tier2
        case .radiationDetection: return .tier3
        case .phPaper: return .tier4
        }
    }

    var symbolName: String {
        switch self {
        case .incidentMapper: return "map"
        case .airMonitoring: return "wind"
        case .radiationDetection: return "dot.radiowaves.left.and.right"
        case .phPaper: return "drop"
        }
    }

    var tierTitle: String {
        tier.title
    }

    var tierPriceLabel: String {
        tier.priceLabel
    }

    var tierBenefitLabel: String {
        tier.benefitLabel
    }
}

enum AccessSource: String {
    case mock = "Mock"
    case appleSubscription = "Apple Subscription"
    case organizationEntitlement = "Agency Entitlement"
}

struct ModuleAccessState: Equatable {
    var unlockedModules: Set<ToolboxModule>
    var source: AccessSource

    func isUnlocked(_ module: ToolboxModule) -> Bool {
        unlockedModules.contains(module)
    }
}

protocol ToolboxAccessControlling: AnyObject {
    var state: ModuleAccessState { get }
    func refreshAccess() async
    func purchaseConsumerSubscription() async throws
    func restorePurchases() async throws
}

enum ToolboxTierAppLaunchKind: Hashable {
    case incidentMapper
    case hazmatToolkitIntegrated
    case bundledWeb(path: String)
    case flaminatorNative
    case pluminatorNative
    case simulatorPlaceholder
    case comingSoon
}

struct ToolboxTierApp: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let subtitle: String
    let symbolName: String
    let launchKind: ToolboxTierAppLaunchKind
}

extension ToolboxModule {
    var tierApps: [ToolboxTierApp] {
        switch self {
        case .incidentMapper: // Tier 1
            return [
                ToolboxTierApp(title: "Specialty Kit Finder", subtitle: "Free drawer app", symbolName: "shippingbox", launchKind: .bundledWeb(path: "toolbox/training/response-kits-map.html")),
                ToolboxTierApp(title: "Instructor Map", subtitle: "Free drawer app", symbolName: "map", launchKind: .bundledWeb(path: "toolbox/training/trainers.html")),
                ToolboxTierApp(title: "Conference Calendar", subtitle: "Free drawer app", symbolName: "calendar", launchKind: .bundledWeb(path: "toolbox/tools/conference-calendar/index.html"))
            ]
        case .airMonitoring: // Tier 2
            return []
        case .radiationDetection: // Tier 3
            return [
                ToolboxTierApp(title: "Flaminator 9000", subtitle: "Tier 3 tool", symbolName: "flame", launchKind: .flaminatorNative),
                ToolboxTierApp(title: "Pluminator 9000", subtitle: "Tier 3 tool", symbolName: "cloud.drizzle", launchKind: .pluminatorNative),
                ToolboxTierApp(title: "After Action Reporter", subtitle: "Tier 3 tool", symbolName: "doc.text.magnifyingglass", launchKind: .bundledWeb(path: "toolbox/After Action Report.html"))
            ]
        case .phPaper: // Tier 4
            return [
                ToolboxTierApp(title: "Hazmat ToolK.I.T.", subtitle: "Tier 4 module", symbolName: "map", launchKind: .hazmatToolkitIntegrated),
                ToolboxTierApp(title: "Incident Mapper", subtitle: "Interactive incident mapping and exports", symbolName: "map", launchKind: .incidentMapper)
            ]
        }
    }
}

@MainActor
final class MockToolboxAccessManager: ObservableObject, ToolboxAccessControlling {
    @Published private(set) var state = ModuleAccessState(
        unlockedModules: [.incidentMapper],
        source: .mock
    )
    @Published var statusMessage: String?
    @Published var isBusy = false

    func refreshAccess() async {
        // Future: merge Apple IAP + ABM/org entitlement providers here.
        state.source = .mock
    }

    func purchaseConsumerSubscription() async throws {
        isBusy = true
        defer { isBusy = false }
        try await Task.sleep(nanoseconds: 350_000_000)
        state.unlockedModules = Set(ToolboxModule.allCases)
        state.source = .mock
        statusMessage = "Mock subscription enabled. Replace with StoreKit 2 in production."
    }

    func restorePurchases() async throws {
        isBusy = true
        defer { isBusy = false }
        try await Task.sleep(nanoseconds: 250_000_000)
        // Mock restore restores the same local entitlement set.
        statusMessage = "Restore Purchases hook called (mock)."
    }
}

@MainActor
final class ToolboxRouter: ObservableObject {
    enum Sheet: Identifiable {
        case paywall(ToolboxModule)

        var id: String {
            switch self {
            case .paywall(let module): return "paywall-\(module.id)"
            }
        }
    }

    @Published var activeModule: ToolboxModule?
    @Published var activeSheet: Sheet?

    func route(to module: ToolboxModule, using access: ModuleAccessState) {
        if access.isUnlocked(module) {
            activeModule = module
        } else {
            activeSheet = .paywall(module)
        }
    }
}

struct HazmatToolboxRootView: View {
    @StateObject private var accessManager = MockToolboxAccessManager()
    @StateObject private var router = ToolboxRouter()

    var body: some View {
        NavigationView {
            HazmatToolboxHomeView()
                .environmentObject(accessManager)
                .environmentObject(router)
                .navigationTitle("Hazmat ToolK.I.T.")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Refresh Access") {
                            Task { await accessManager.refreshAccess() }
                        }
                        .font(.subheadline.weight(.medium))
                    }
                }
        }
        .navigationViewStyle(.stack)
        .hazmatBackground()
        .sheet(item: $router.activeSheet) { sheet in
            switch sheet {
            case .paywall(let module):
                ToolboxPaywallView(module: module)
                    .environmentObject(accessManager)
            }
        }
        .fullScreenCover(item: $router.activeModule) { module in
            ToolboxModuleContainerView(module: module)
        }
        .task {
            await accessManager.refreshAccess()
        }
    }
}

private struct HazmatToolboxHomeView: View {
    @EnvironmentObject private var accessManager: MockToolboxAccessManager
    @EnvironmentObject private var router: ToolboxRouter

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                ToolboxCabinetHeroView(
                    modules: ToolboxModule.allCases,
                    isUnlocked: { accessManager.state.isUnlocked($0) },
                    onTapModule: { router.route(to: $0, using: accessManager.state) }
                )

                accessFooter
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 20)
        }
        .background(
            Color.clear.hazmatBackground()
        )
        .alert("Access Status", isPresented: Binding(
            get: { accessManager.statusMessage != nil },
            set: { if !$0 { accessManager.statusMessage = nil } }
        )) {
            Button("OK", role: .cancel) { accessManager.statusMessage = nil }
        } message: {
            Text(accessManager.statusMessage ?? "")
        }
    }

    private var accessFooter: some View {
        HStack {
            Label("Access Source: \(accessManager.state.source.rawValue)", systemImage: "checkmark.shield")
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
            Spacer()
            if accessManager.isBusy {
                ProgressView()
                    .controlSize(.small)
            }
        }
        .padding(.horizontal, 4)
    }
}

private struct ToolboxCabinetHeroView: View {
    let modules: [ToolboxModule]
    let isUnlocked: (ToolboxModule) -> Bool
    let onTapModule: (ToolboxModule) -> Void

    var body: some View {
        if UIImage(named: "ToolboxHomeHero") != nil {
            ToolboxPhotoCabinetView(modules: modules, isUnlocked: isUnlocked, onTapModule: onTapModule)
        } else {
            ToolboxCabinetFallbackView(modules: modules, isUnlocked: isUnlocked, onTapModule: onTapModule)
        }
    }
}

private struct ToolboxPhotoCabinetView: View {
    let modules: [ToolboxModule]
    let isUnlocked: (ToolboxModule) -> Bool
    let onTapModule: (ToolboxModule) -> Void

    // Normalized hit zones over the toolbox image (x, y, width, height in 0...1 image space).
    // Tweak these values to align tap areas to the top 4 drawers.
    private let drawerHitZones: [CGRect] = [
        CGRect(x: 0.15, y: 0.50, width: 0.70, height: 0.09), // Tier 1 (top drawer)
        CGRect(x: 0.15, y: 0.56, width: 0.70, height: 0.09), // Tier 2
        CGRect(x: 0.15, y: 0.62, width: 0.70, height: 0.09), // Tier 3
        CGRect(x: 0.15, y: 0.68, width: 0.70, height: 0.09)  // Tier 4
    ]

    var body: some View {
        ZStack {
            Image("ToolboxHomeHero")
                .resizable()
                .scaledToFit()
                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .stroke(Color.black.opacity(0.25), lineWidth: 1)
                )

            GeometryReader { proxy in
                let width = proxy.size.width
                let height = proxy.size.height

                ForEach(Array(modules.enumerated()), id: \.element.id) { index, module in
                    let zone = drawerHitZones.indices.contains(index)
                        ? drawerHitZones[index]
                        : CGRect(x: 0.15, y: 0.75, width: 0.70, height: 0.09)
                    let zoneRect = CGRect(
                        x: width * zone.minX,
                        y: height * zone.minY,
                        width: width * zone.width,
                        height: height * zone.height
                    )
                    Button {
                        onTapModule(module)
                    } label: {
                        ZStack {
                            // Compact text badge aligned to the left side of the drawer.
                            HStack(spacing: 8) {
                                Text(module.tierTitle)
                                    .font(.caption.weight(.bold))
                                Text(module.tierPriceLabel)
                                    .font(.caption.weight(.bold))
                                Text(module.tierBenefitLabel)
                                    .font(.caption2.weight(.semibold))
                                    .lineLimit(1)
                                Spacer(minLength: 0)
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .frame(width: zoneRect.width * 0.34, alignment: .leading)
                            .background(
                                LinearGradient(
                                    colors: [Color.black.opacity(0.62), Color.black.opacity(0.42)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                ),
                                in: RoundedRectangle(cornerRadius: 10, style: .continuous)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .stroke(isUnlocked(module) ? Color.green.opacity(0.7) : Color.orange.opacity(0.8), lineWidth: 1)
                            )
                            .frame(maxWidth: .infinity, alignment: .leading)

                            // Small lock status on the right side of the drawer.
                            HStack {
                                Spacer()
                                Image(systemName: isUnlocked(module) ? "lock.open.fill" : "lock.fill")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 5)
                                    .background(
                                        Color.black.opacity(0.55),
                                        in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                                            .stroke(isUnlocked(module) ? Color.green.opacity(0.7) : Color.orange.opacity(0.8), lineWidth: 1)
                                    )
                            }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                        .contentShape(Rectangle())
                        .padding(.horizontal, zoneRect.width * 0.01)
                    }
                    .buttonStyle(.plain)
                    .frame(width: zoneRect.width, height: zoneRect.height)
                    .contentShape(Rectangle())
                    .position(x: zoneRect.midX, y: zoneRect.midY)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        }
        .aspectRatio(768.0 / 1024.0, contentMode: .fit)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(Color.black.opacity(0.05))
        )
    }
}

private struct ToolboxCabinetFallbackView: View {
    let modules: [ToolboxModule]
    let isUnlocked: (ToolboxModule) -> Bool
    let onTapModule: (ToolboxModule) -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Open lid
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Color(red: 0.86, green: 0.10, blue: 0.10), Color(red: 0.62, green: 0.05, blue: 0.06)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(height: 180)
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .inset(by: 10)
                        .stroke(Color.black.opacity(0.30), lineWidth: 2)
                )
                .overlay(
                    VStack(spacing: 8) {
                        HStack {
                            Capsule().fill(Color.white.opacity(0.85)).frame(width: 44, height: 6)
                            Spacer()
                            Capsule().fill(Color.white.opacity(0.85)).frame(width: 44, height: 6)
                        }
                        .padding(.horizontal, 46)
                        Spacer()
                        VStack(spacing: 2) {
                            Text("The Hazmat Guys")
                                .font(.custom("Depressionist3Revisited", size: 24))
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                            Text("Hazmat ToolK.I.T.")
                                .font(.custom("Depressionist3Revisited", size: 15))
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                        }
                        .foregroundStyle(.white.opacity(0.92))
                        Spacer()
                    }
                    .padding(.vertical, 16)
                )
                .rotation3DEffect(.degrees(9), axis: (x: 1, y: 0, z: 0))
                .offset(y: 10)

            // Cabinet body
            VStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(Color.black.opacity(0.70))
                    .frame(height: 30)
                    .overlay(
                        HStack {
                            Spacer()
                            Capsule()
                                .fill(Color.white.opacity(0.75))
                                .frame(width: 220, height: 6)
                            Spacer()
                        }
                    )
                    .padding(.horizontal, 14)
                    .padding(.top, 10)

                VStack(spacing: 12) {
                    ForEach(modules) { module in
                        ToolboxDrawerButton(
                            module: module,
                            isUnlocked: isUnlocked(module)
                        ) {
                            onTapModule(module)
                        }
                    }
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 14)
            }
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [Color(red: 0.92, green: 0.10, blue: 0.09), Color(red: 0.68, green: 0.05, blue: 0.05)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(Color.black.opacity(0.35), lineWidth: 2)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(Color.white.opacity(0.14), lineWidth: 1)
            )
        }
        .padding(4)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(Color.black.opacity(0.06))
        )
    }
}

private struct ToolboxDrawerButton: View {
    let module: ToolboxModule
    let isUnlocked: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 0) {
                // Metal trim
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [Color.white.opacity(0.92), Color.gray.opacity(0.65)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(height: 5)

                HStack(spacing: 10) {
                    Image(systemName: module.symbolName)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.92))
                        .frame(width: 26)

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 8) {
                            Text(module.tierTitle)
                                .font(.caption.weight(.bold))
                            Text(module.tierPriceLabel)
                                .font(.caption.weight(.bold))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(Color.black.opacity(0.24), in: Capsule())
                        }
                        .foregroundStyle(.white.opacity(0.96))

                        Text(module.tierBenefitLabel)
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.85))
                            .lineLimit(1)

                        Text(module.rawValue)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.72))
                            .lineLimit(1)
                    }

                    Spacer(minLength: 8)

                    Label(isUnlocked ? "Open" : "Locked", systemImage: isUnlocked ? "lock.open.fill" : "lock.fill")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(isUnlocked ? Color.green.opacity(0.95) : Color.yellow.opacity(0.95))

                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [Color.white.opacity(0.95), Color.gray.opacity(0.55)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .frame(width: 112, height: 12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 4, style: .continuous)
                                .stroke(Color.black.opacity(0.18), lineWidth: 0.5)
                        )
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [Color(red: 0.92, green: 0.08, blue: 0.09), Color(red: 0.72, green: 0.04, blue: 0.06)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Color.white.opacity(0.12), lineWidth: 1)
                )
            }
        }
        .buttonStyle(.plain)
    }
}

struct ToolboxPaywallView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var accessManager: MockToolboxAccessManager
    let module: ToolboxModule

    var body: some View {
        NavigationView {
            VStack(spacing: 18) {
                VStack(spacing: 10) {
                    Image(systemName: "lock.shield")
                        .font(.system(size: 42, weight: .semibold))
                        .foregroundStyle(.blue)
                    Text("\(module.rawValue) Requires Subscription")
                        .font(.title2.weight(.bold))
                        .multilineTextAlignment(.center)
                    Text("Unlock \(module.tierTitle) (\(module.tierPriceLabel)) for this module.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 8)

                VStack(spacing: 12) {
                    paywallFeatureRow("Tier", detail: "\(module.tierTitle) • \(module.tierPriceLabel)")
                    paywallFeatureRow("Modules", detail: paywallModulesDetail)
                    paywallFeatureRow("Entitlements", detail: "Individual subscription")
                }
                .padding(16)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                Button {
                    Task {
                        try? await accessManager.purchaseConsumerSubscription()
                        dismiss()
                    }
                } label: {
                    HStack {
                        if accessManager.isBusy { ProgressView().tint(.white) }
                        Text("Subscribe (\(module.tierPriceLabel))")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
                .disabled(accessManager.isBusy)

                Button {
                    Task {
                        try? await accessManager.restorePurchases()
                    }
                } label: {
                    Text("Restore Purchases")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.bordered)
                .disabled(accessManager.isBusy)

                Text("Future hook: Replace mock access manager with StoreKit 2 + ABM/org entitlement provider.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                Spacer()
            }
            .padding(20)
            .navigationTitle("Unlock ToolK.I.T. Tiers")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .navigationViewStyle(.stack)
    }

    private func paywallFeatureRow(_ title: String, detail: String) -> some View {
        HStack {
            Text(title)
                .fontWeight(.semibold)
            Spacer()
            Text(detail)
                .foregroundStyle(.secondary)
        }
    }

    private var paywallModulesDetail: String {
        switch module {
        case .radiationDetection:
            return "Flaminator 9000 and more!"
        case .phPaper:
            return "Hazmat ToolK.I.T. premium tools"
        default:
            return "Subscribe for Access to Awesome Tools"
        }
    }
}

private struct ToolboxModuleContainerView: View {
    @Environment(\.dismiss) private var dismiss
    let module: ToolboxModule

    var body: some View {
        NavigationView {
            Group {
                if module.tierApps.isEmpty {
                    modulePlaceholder(module)
                } else {
                    List {
                        Section {
                            ForEach(module.tierApps) { app in
                                NavigationLink(destination: tierAppDestination(app)) {
                                    tierAppRow(app)
                                }
                            }
                        } header: {
                            Text("\(module.tierTitle) Apps")
                        } footer: {
                            Text("\(module.tierPriceLabel) • \(module.tierBenefitLabel)")
                        }
                    }
                }
            }
            .navigationTitle(module == .phPaper ? "Hazmat ToolK.I.T." : module.rawValue)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .navigationViewStyle(.stack)
    }

    private func tierAppRow(_ app: ToolboxTierApp) -> some View {
        HStack(spacing: 12) {
            Image(systemName: app.symbolName)
                .font(.system(size: 18, weight: .semibold))
                .frame(width: 26)
                .foregroundStyle(.blue)

            VStack(alignment: .leading, spacing: 3) {
                Text(app.title)
                    .font(.headline)
                Text(app.subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            launchBadge(for: app.launchKind)
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
    }

    private func modulePlaceholder(_ module: ToolboxModule) -> some View {
        VStack(spacing: 14) {
            Image(systemName: module.symbolName)
                .font(.system(size: 40, weight: .semibold))
            Text(module.tierTitle)
                .font(.title2.weight(.bold))
            Text(module == .airMonitoring
                 ? "Tier 2 drawer is reserved for Vault workflow + Downloads."
                 : "Tier launcher placeholder. Route is working; implementation can be added next.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .hazmatPanel()
    }

    @ViewBuilder
    private func tierAppDestination(_ app: ToolboxTierApp) -> some View {
        switch app.launchKind {
        case .incidentMapper:
            IncidentMapperModuleView()
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle(app.title)
                .navigationBarTitleDisplayMode(.inline)
        case .hazmatToolkitIntegrated:
            LegacyHazmatToolkitHostView()
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle(app.title)
                .navigationBarTitleDisplayMode(.inline)
        case .flaminatorNative:
            if #available(iOS 17.0, *) {
                FlaminatorNativeModuleHostView()
                    .ignoresSafeArea(edges: .bottom)
                    .navigationBarHidden(true)
            } else {
                TierAppPlaceholderView(
                    title: app.title,
                    symbolName: app.symbolName,
                    message: "This native module requires iOS 17 or newer in the integrated Hazmat ToolK.I.T. app."
                )
            }
        case .pluminatorNative:
            if #available(iOS 17.0, *) {
                PluminatorNativeModuleHostView()
                    .ignoresSafeArea(edges: .bottom)
                    .navigationBarHidden(true)
            } else {
                TierAppPlaceholderView(
                    title: app.title,
                    symbolName: app.symbolName,
                    message: "This native module requires iOS 17 or newer in the integrated Hazmat ToolK.I.T. app."
                )
            }
        case .bundledWeb(let path):
            BundledToolWebView(bundleRelativePath: path)
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle(app.title)
                .navigationBarTitleDisplayMode(.inline)
        case .simulatorPlaceholder:
            IncidentMapperModuleView()
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle(app.title)
                .navigationBarTitleDisplayMode(.inline)
        case .comingSoon:
            TierAppPlaceholderView(
                title: app.title,
                symbolName: app.symbolName,
                message: "Launcher shell is in place for this app. Connect a native screen or bundled web module next."
            )
        }
    }

    @ViewBuilder
    private func launchBadge(for kind: ToolboxTierAppLaunchKind) -> some View {
        switch kind {
        case .incidentMapper:
            Text("App")
                .font(.caption2.weight(.bold))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.green.opacity(0.18), in: Capsule())
                .foregroundStyle(.green)
        case .hazmatToolkitIntegrated:
            Text("Native")
                .font(.caption2.weight(.bold))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.green.opacity(0.18), in: Capsule())
                .foregroundStyle(.green)
        case .flaminatorNative, .pluminatorNative:
            Text("Native")
                .font(.caption2.weight(.bold))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.green.opacity(0.18), in: Capsule())
                .foregroundStyle(.green)
        case .bundledWeb:
            Text("Web")
                .font(.caption2.weight(.bold))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.blue.opacity(0.18), in: Capsule())
                .foregroundStyle(.blue)
        case .simulatorPlaceholder:
            Text("Native")
                .font(.caption2.weight(.bold))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.green.opacity(0.18), in: Capsule())
                .foregroundStyle(.green)
        case .comingSoon:
            Text("Soon")
                .font(.caption2.weight(.bold))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.gray.opacity(0.18), in: Capsule())
                .foregroundStyle(.secondary)
        }
    }
}

private struct LegacyHazmatToolkitHostView: View {
    @StateObject private var store = AppStore()

    var body: some View {
        RootView(store: store)
    }
}

@available(iOS 17.0, *)
private struct FlaminatorNativeModuleHostView: View {
    @StateObject private var simulation = FLAFlameSimulationStore()

    var body: some View {
        ToolboxFlaminatorModuleView()
            .environmentObject(simulation)
    }
}

@available(iOS 17.0, *)
private struct PluminatorNativeModuleHostView: View {
    @StateObject private var simulation = PLUPlumeSimulationStore()

    var body: some View {
        ToolboxPluminatorModuleView()
            .environmentObject(simulation)
    }
}

private struct BundledToolWebView: UIViewRepresentable {
    let bundleRelativePath: String

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.bounces = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        load(in: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // No-op. Future: support reloading if route changes.
    }

    private func load(in webView: WKWebView) {
        let normalizedPath = bundleRelativePath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedPath.isEmpty else { return }

        guard let resourceRoot = Bundle.main.resourceURL else {
            webView.loadHTMLString("<html><body><p>Bundle resource root not found.</p></body></html>", baseURL: nil)
            return
        }

        let primaryURL = resourceRoot.appendingPathComponent(normalizedPath)
        let publicPrefixedURL = resourceRoot.appendingPathComponent("public").appendingPathComponent(normalizedPath)
        let fileURL: URL?
        if FileManager.default.fileExists(atPath: primaryURL.path) {
            fileURL = primaryURL
        } else if FileManager.default.fileExists(atPath: publicPrefixedURL.path) {
            fileURL = publicPrefixedURL
        } else {
            fileURL = nil
        }
        let readRoot = resourceRoot.appendingPathComponent("public")

        if let fileURL {
            webView.loadFileURL(fileURL, allowingReadAccessTo: readRoot)
        } else {
            let escaped = normalizedPath.replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
            webView.loadHTMLString(
                "<html><body style='font-family:-apple-system;padding:20px'><h3>Tool not bundled yet</h3><p>Missing file: <code>\(escaped)</code></p><p>Copy the toolbox-site module files into <code>App/public/toolbox</code>.</p></body></html>",
                baseURL: nil
            )
        }
    }
}

private struct TierAppPlaceholderView: View {
    let title: String
    let symbolName: String
    let message: String

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: symbolName)
                .font(.system(size: 40, weight: .semibold))
                .foregroundStyle(.blue)
            Text(title)
                .font(.title2.weight(.bold))
            Text(message)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .hazmatPanel()
    }
}

private struct IncidentMapperModuleView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        let controller = MapperBridgeViewController()
        controller.modalPresentationStyle = .fullScreen
        return controller
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        // No-op for now. Future: route module/deep-link parameters into web layer.
    }
}

private final class MapperBridgeViewController: BridgeViewController {
    private var previousInteractivePopEnabled: Bool?
    private weak var managedNavigationController: UINavigationController?

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        setInteractivePopEnabled(false)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // SwiftUI can attach the representable into the UINavigationController after viewWillAppear.
        setInteractivePopEnabled(false)
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        restoreInteractivePopGesture()
    }

    override public func capacitorDidLoad() {
        super.capacitorDidLoad()
        // Avoid WKWebView edge-swipe history navigation competing with canvas/icon dragging.
        webView?.allowsBackForwardNavigationGestures = false
    }

    private func setInteractivePopEnabled(_ isEnabled: Bool) {
        guard let nav = nearestNavigationController(),
              let popGesture = nav.interactivePopGestureRecognizer else { return }
        managedNavigationController = nav
        if previousInteractivePopEnabled == nil {
            previousInteractivePopEnabled = popGesture.isEnabled
        }
        popGesture.isEnabled = isEnabled
    }

    private func restoreInteractivePopGesture() {
        let nav = managedNavigationController ?? nearestNavigationController()
        guard let popGesture = nav?.interactivePopGestureRecognizer else { return }
        popGesture.isEnabled = previousInteractivePopEnabled ?? true
        previousInteractivePopEnabled = nil
    }

    private func nearestNavigationController() -> UINavigationController? {
        if let navigationController {
            return navigationController
        }
        var current = parent
        while let node = current {
            if let nav = node as? UINavigationController {
                return nav
            }
            if let nav = node.navigationController {
                return nav
            }
            current = node.parent
        }
        return nil
    }
}
