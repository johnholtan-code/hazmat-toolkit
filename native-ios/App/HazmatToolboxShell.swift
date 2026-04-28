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
    case tier5 = "Tier 5"

    var id: String { rawValue }

    var title: String { rawValue }

    var priceLabel: String {
        switch self {
        case .tier1: return "Free"
        case .tier2: return "$25/yr"
        case .tier3: return "$50/yr"
        case .tier4: return "$500/yr"
        case .tier5: return "$2,500/yr"
        }
    }

    var benefitLabel: String {
        switch self {
        case .tier1: return "Free Tools"
        case .tier2: return "Vault workflow + Downloads"
        case .tier3: return "Premium Training Tools"
        case .tier4: return "Hazmat ToolK.I.T. Simulator"
        case .tier5: return "Incident Collaborative Map"
        }
    }
}

enum ToolboxModule: String, CaseIterable, Identifiable, Hashable {
    case incidentMapper = "Tier 1"
    case airMonitoring = "Tier 2"
    case radiationDetection = "Tier 3"
    case phPaper = "Tier 4"
    case incidentCollaborativeMap = "Incident Collaborative Map"

    var id: String { rawValue }

    var subtitle: String {
        switch self {
        case .incidentMapper: return "Free tools"
        case .airMonitoring: return "Access to Presentations and Photos"
        case .radiationDetection: return "Access to Trainer Tools"
        case .phPaper: return "Hazmat ToolK.I.T. Simulator"
        case .incidentCollaborativeMap: return "Shared operational map sessions"
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
        case .incidentCollaborativeMap: return .tier5
        }
    }

    var symbolName: String {
        switch self {
        case .incidentMapper: return "map"
        case .airMonitoring: return "wind"
        case .radiationDetection: return "dot.radiowaves.left.and.right"
        case .phPaper: return "drop"
        case .incidentCollaborativeMap: return "person.3"
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

@MainActor
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
                ToolboxTierApp(title: "Specialty Kit Finder", subtitle: "Free drawer app", symbolName: "shippingbox", launchKind: .bundledWeb(path: "toolbox/training/specialty-kits/index.html")),
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
        case .incidentCollaborativeMap: // Tier 5
            return [
                ToolboxTierApp(title: "Incident Collaborative Map", subtitle: "Shared operational map sessions for commanders, operators, and observers", symbolName: "person.3", launchKind: .bundledWeb(path: "apps/ics-collaborative-map/index.html"))
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

    private struct ToolboxCabinetLayout {
        let size: CGSize

        private var width: CGFloat { size.width }
        private var height: CGFloat { size.height }
        private var minDimension: CGFloat { min(width, height) }

        private enum DeviceTuningProfile {
            case iPadMini
            case iPadStandard
            case iPadLarge
            case myMac
        }

        private var tuningProfile: DeviceTuningProfile {
            if width >= 1200 {
                return .myMac
            } else if width >= 900 {
                return .iPadLarge
            } else if width >= 720 {
                return .iPadStandard
            } else {
                return .iPadMini
            }
        }

        var isCompact: Bool { width < 720 }
        var visibleDrawerX: CGFloat { width * 0.15 }
        var visibleDrawerWidth: CGFloat { width * 0.70 }
        var lidTopPadding: CGFloat { height * (isCompact ? 0.185 : 0.175) }
        var lidHorizontalInset: CGFloat { width * (isCompact ? 0.12 : 0.10) }
        var lidInnerHorizontalPadding: CGFloat { width * (isCompact ? 0.055 : 0.065) }
        var lidInnerVerticalPadding: CGFloat { height * (isCompact ? 0.014 : 0.018) }
        var lidCornerRadius: CGFloat { isCompact ? 22 : 26 }
        var lidTitleSpacing: CGFloat { isCompact ? max(3, height * 0.0045) : max(4, height * 0.006) }
        var lidTitleFontSize: CGFloat { min(max(minDimension * (isCompact ? 0.060 : 0.064), 28), isCompact ? 46 : 56) }
        var lidSubtitleFontSize: CGFloat { min(max(minDimension * (isCompact ? 0.038 : 0.042), 17), isCompact ? 28 : 34) }
        var lidTitleScaleFactor: CGFloat { isCompact ? 0.58 : 0.70 }
        var lidSubtitleScaleFactor: CGFloat { isCompact ? 0.65 : 0.75 }

        func badgeHeight(for zoneRect: CGRect) -> CGFloat {
            min(max(zoneRect.height * (isCompact ? 0.52 : 0.56), 24), isCompact ? 30 : 34)
        }

        var drawerTextFontSize: CGFloat { min(max(minDimension * (isCompact ? 0.026 : 0.029), 16), isCompact ? 22 : 26) }
        var drawerBenefitFontSize: CGFloat { min(max(minDimension * (isCompact ? 0.022 : 0.024), 14), isCompact ? 19 : 22) }
        var drawerTextScaleFactor: CGFloat { isCompact ? 0.62 : 0.78 }
        var drawerBenefitScaleFactor: CGFloat { isCompact ? 0.58 : 0.72 }
        var textBadgeWidth: CGFloat { visibleDrawerWidth * (isCompact ? 0.80 : 0.82) }
        var lockBadgeWidthRatio: CGFloat { isCompact ? 1.08 : 1.14 }
        var badgeHorizontalPadding: CGFloat { isCompact ? 8 : 10 }
        var badgeCornerRadius: CGFloat { isCompact ? 8 : 10 }
        var lockBadgeCornerRadius: CGFloat { isCompact ? 7 : 8 }

        // Per-device drawer offset tuning.
        // Increase a value to move drawer text/icons down on that device class.
        private var iPadMiniDrawerYOffsetRatio: CGFloat { 0.028 }
        private var iPadStandardDrawerYOffsetRatio: CGFloat { 0.038 }
        private var iPadLargeDrawerYOffsetRatio: CGFloat { 0.038 }
        private var myMacDrawerYOffsetRatio: CGFloat { 0.046 }

        var drawerContentYOffset: CGFloat {
            let ratio: CGFloat
            switch tuningProfile {
            case .iPadMini:
                ratio = iPadMiniDrawerYOffsetRatio
            case .iPadStandard:
                ratio = iPadStandardDrawerYOffsetRatio
            case .iPadLarge:
                ratio = iPadLargeDrawerYOffsetRatio
            case .myMac:
                ratio = myMacDrawerYOffsetRatio
            }
            return height * ratio
        }
    }

    // Normalized hit zones over the toolbox image (x, y, width, height in 0...1 image space).
    // Tweak these values to align tap areas to the top 5 drawers.
    private let drawerHitZones: [CGRect] = [
        CGRect(x: 0.15, y: 0.49, width: 0.70, height: 0.11), // Tier 1 (top drawer)
        CGRect(x: 0.15, y: 0.55, width: 1.0, height: 0.11), // Tier 2
        CGRect(x: 0.15, y: 0.605, width: 1.0, height: 0.11), // Tier 3
        CGRect(x: 0.15, y: 0.665, width: 1.0, height: 0.11), // Tier 4
        CGRect(x: 0.15, y: 0.725, width: 1.1, height: 0.11)  // Tier 5
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
                let layout = ToolboxCabinetLayout(size: proxy.size)

                VStack(spacing: layout.lidTitleSpacing) {
                    Text("The Hazmat Guys")
                        .font(.custom("Depressionist3Revisited", size: layout.lidTitleFontSize))
                        .lineLimit(1)
                        .minimumScaleFactor(layout.lidTitleScaleFactor)
                    Text("Hazmat ToolK.I.T.")
                        .font(.custom("Depressionist3Revisited", size: layout.lidSubtitleFontSize))
                        .lineLimit(1)
                        .minimumScaleFactor(layout.lidSubtitleScaleFactor)
                }
                .foregroundStyle(.white.opacity(0.97))
                .padding(.horizontal, layout.lidInnerHorizontalPadding)
                .padding(.vertical, layout.lidInnerVerticalPadding)
                .background(
                    RoundedRectangle(cornerRadius: layout.lidCornerRadius, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [Color.black.opacity(0.42), Color.black.opacity(0.22)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: layout.lidCornerRadius, style: .continuous)
                        .stroke(Color.white.opacity(0.12), lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.65), radius: 12, y: 3)
                .padding(.horizontal, layout.lidHorizontalInset)
                .frame(width: proxy.size.width, height: proxy.size.height, alignment: .top)
                .padding(.top, layout.lidTopPadding)

                ForEach(Array(modules.enumerated()), id: \.element.id) { index, module in
                    let zone = drawerHitZones.indices.contains(index)
                        ? drawerHitZones[index]
                        : CGRect(x: 0.15, y: 0.75, width: 0.70, height: 0.09)
                    let zoneRect = CGRect(
                        x: proxy.size.width * zone.minX,
                        y: proxy.size.height * zone.minY,
                        width: proxy.size.width * zone.width,
                        height: proxy.size.height * zone.height
                    )
                    Button {
                        onTapModule(module)
                    } label: {
                        let badgeHeight = layout.badgeHeight(for: zoneRect)
                        let lockBadgeWidth = badgeHeight * layout.lockBadgeWidthRatio
                        ZStack(alignment: .leading) {
                            HStack(spacing: 8) {
                                Text(module.tierTitle)
                                    .font(.system(size: layout.drawerTextFontSize, weight: .heavy))
                                    .lineLimit(1)
                                    .minimumScaleFactor(layout.drawerTextScaleFactor)
                                Text(module.tierPriceLabel)
                                    .font(.system(size: layout.drawerTextFontSize, weight: .heavy))
                                    .lineLimit(1)
                                    .minimumScaleFactor(layout.drawerTextScaleFactor)
                                Text(module.tierBenefitLabel)
                                    .font(.system(size: layout.drawerBenefitFontSize, weight: .heavy))
                                    .lineLimit(1)
                                    .minimumScaleFactor(layout.drawerBenefitScaleFactor)
                                Spacer(minLength: 0)
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, layout.badgeHorizontalPadding)
                            .frame(width: layout.textBadgeWidth, height: badgeHeight, alignment: .leading)
                            .background(
                                LinearGradient(
                                    colors: [Color.black.opacity(0.62), Color.black.opacity(0.42)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                ),
                                in: RoundedRectangle(cornerRadius: layout.badgeCornerRadius, style: .continuous)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: layout.badgeCornerRadius, style: .continuous)
                                    .stroke(isUnlocked(module) ? Color.green.opacity(0.7) : Color.orange.opacity(0.8), lineWidth: 1)
                            )
                            Image(systemName: isUnlocked(module) ? "lock.open.fill" : "lock.fill")
                                .font(.system(size: min(layout.drawerTextFontSize, badgeHeight * 0.76), weight: .heavy))
                                .foregroundStyle(.white)
                                .frame(width: lockBadgeWidth, height: badgeHeight)
                                .background(
                                    Color.black.opacity(0.55),
                                    in: RoundedRectangle(cornerRadius: layout.lockBadgeCornerRadius, style: .continuous)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: layout.lockBadgeCornerRadius, style: .continuous)
                                        .stroke(isUnlocked(module) ? Color.green.opacity(0.7) : Color.orange.opacity(0.8), lineWidth: 1)
                                )
                                .offset(x: layout.visibleDrawerWidth - lockBadgeWidth)
                        }
                        .frame(width: layout.visibleDrawerWidth, height: badgeHeight, alignment: .leading)
                        .offset(x: layout.visibleDrawerX - zoneRect.minX)
                        .offset(y: layout.drawerContentYOffset)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                        .contentShape(Rectangle())
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
                    VStack(spacing: 16) {
                        HStack {
                            Capsule().fill(Color.white.opacity(0.85)).frame(width: 44, height: 6)
                            Spacer()
                            Capsule().fill(Color.white.opacity(0.85)).frame(width: 44, height: 6)
                        }
                        .padding(.horizontal, 46)
                        Spacer()
                        VStack(spacing: 4) {
                            Text("The Hazmat Guys")
                                .font(.custom("Depressionist3Revisited", size: 48))
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                            Text("Hazmat ToolK.I.T.")
                                .font(.custom("Depressionist3Revisited", size: 30))
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                        }
                        .foregroundStyle(.white.opacity(0.92))
                        Spacer()
                    }
                    .padding(.vertical, 32)
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
        case .incidentCollaborativeMap:
            return "Incident Collaborative Map access"
        default:
            return "Subscribe for Access to Awesome Tools"
        }
    }
}

private struct ToolboxModuleContainerView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var presentedStandaloneTierApp: ToolboxTierApp?
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
                                tierAppRowLink(app)
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
        .fullScreenCover(item: $presentedStandaloneTierApp) { app in
            standaloneTierAppDestination(app)
        }
    }

    @ViewBuilder
    private func tierAppRowLink(_ app: ToolboxTierApp) -> some View {
        if usesStandalonePresentation(app) {
            Button {
                presentedStandaloneTierApp = app
            } label: {
                tierAppRow(app)
            }
            .buttonStyle(.plain)
        } else {
            NavigationLink(destination: tierAppDestination(app)) {
                tierAppRow(app)
            }
        }
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
            IncidentMapperHostView(title: app.title)
        case .hazmatToolkitIntegrated:
            HazmatToolkitIntegratedModuleView(title: app.title)
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
            IncidentMapperHostView(title: app.title)
        case .comingSoon:
            TierAppPlaceholderView(
                title: app.title,
                symbolName: app.symbolName,
                message: "Launcher shell is in place for this app. Connect a native screen or bundled web module next."
            )
        }
    }

    @ViewBuilder
    private func standaloneTierAppDestination(_ app: ToolboxTierApp) -> some View {
        switch app.launchKind {
        case .incidentMapper, .simulatorPlaceholder:
            IncidentMapperHostView(title: app.title)
        default:
            tierAppDestination(app)
        }
    }

    private func usesStandalonePresentation(_ app: ToolboxTierApp) -> Bool {
        switch app.launchKind {
        case .incidentMapper, .simulatorPlaceholder:
            return true
        default:
            return false
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

private struct HazmatToolkitIntegratedModuleView: View {
    @Environment(\.dismiss) private var dismiss
    let title: String

    var body: some View {
        LegacyHazmatToolkitHostView()
            .ignoresSafeArea(edges: .bottom)
            .navigationBarBackButtonHidden(true)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Label("Apps", systemImage: "square.grid.2x2")
                    }
                }
            }
    }
}

private struct IncidentMapperHostView: View {
    @Environment(\.dismiss) private var dismiss
    let title: String

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 20, weight: .semibold))
                        .frame(width: 44, height: 44)
                        .background(Color.white.opacity(0.92), in: Circle())
                }
                .accessibilityLabel("Back to Apps")

                Spacer()

                Text(title)
                    .font(.headline.weight(.semibold))

                Spacer()

                Color.clear
                    .frame(width: 44, height: 44)
            }
            .padding(.horizontal, 12)
            .padding(.top, 10)
            .padding(.bottom, 8)
            .background(.ultraThinMaterial)

            BundledToolWebView(bundleRelativePath: "toolbox/Hazmat Incident Map - Hot Wash Replay.html")
                .ignoresSafeArea(edges: .bottom)
        }
        .background(Color(.systemBackground))
        .interactiveDismissDisabled(true)
    }
}

private struct LegacyHazmatToolkitHostView: View {
    @StateObject private var store = AppStore()

    var body: some View {
        Group {
            if store.isTrainerSignedIn {
                RootView(store: store)
            } else {
                TrainerSignInGateView(store: store)
            }
        }
    }
}

private struct TrainerSignInGateView: View {
    private enum AuthMode: String, CaseIterable, Identifiable {
        case signIn = "Sign In"
        case createAccount = "Create Account"
        case resetPassword = "Forgot Password"

        var id: String { rawValue }
    }

    @ObservedObject var store: AppStore
    @State private var mode: AuthMode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var displayName = ""
    @State private var organizationName = ""
    @State private var isSigningIn = false
    @State private var statusMessage: String?
    @State private var lastAuthFlowLabel: String?

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "person.crop.circle.badge.checkmark")
                .font(.system(size: 42, weight: .semibold))
                .foregroundStyle(.blue)
            Text("Trainer Login Required")
                .font(.title3.weight(.bold))
            Text("Authenticate before launching the Hazmat ToolK.I.T. simulator workspace.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Picker("Auth Mode", selection: $mode) {
                ForEach(AuthMode.allCases) { item in
                    Text(item.rawValue).tag(item)
                }
            }
            .pickerStyle(.segmented)
            VStack(spacing: 10) {
                TextField("Trainer Email", text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled(true)
                    .textFieldStyle(.roundedBorder)
                if mode == .createAccount {
                    TextField("Display Name", text: $displayName)
                        .autocorrectionDisabled(true)
                        .textFieldStyle(.roundedBorder)
                    TextField("Organization (optional)", text: $organizationName)
                        .autocorrectionDisabled(true)
                        .textFieldStyle(.roundedBorder)
                }
                SecureField("Password", text: $password)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled(true)
                    .textFieldStyle(.roundedBorder)
                if mode == .createAccount || mode == .resetPassword {
                    SecureField(mode == .createAccount ? "Confirm Password" : "Confirm New Password", text: $confirmPassword)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                        .textFieldStyle(.roundedBorder)
                }
            }

            Button {
                Task {
                    guard !isSigningIn else { return }
                    isSigningIn = true
                    defer { isSigningIn = false }
                    store.clearError()
                    statusMessage = nil
                    if (mode == .createAccount || mode == .resetPassword) && password != confirmPassword {
                        store.errorMessage = "Passwords do not match."
                        return
                    }

                    let success: Bool
                    switch mode {
                    case .signIn:
                        success = await store.signInTrainer(email: email, password: password)
                        if success {
                            statusMessage = "Signed in successfully."
                            lastAuthFlowLabel = "Sign In"
                        }
                    case .createAccount:
                        success = await store.signUpTrainer(
                            email: email,
                            password: password,
                            displayName: displayName,
                            organizationName: organizationName
                        )
                        if success {
                            statusMessage = "Account created and signed in."
                            lastAuthFlowLabel = "Create Account"
                        }
                    case .resetPassword:
                        success = await store.resetTrainerPassword(email: email, newPassword: password)
                        if success {
                            statusMessage = "Password reset complete. You are now signed in."
                            lastAuthFlowLabel = "Forgot Password"
                        }
                    }
                }
            } label: {
                if isSigningIn {
                    ProgressView()
                        .progressViewStyle(.circular)
                } else {
                    Text(actionButtonTitle)
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isSigningIn)

            if let statusMessage, !statusMessage.isEmpty {
                Text(statusMessage)
                    .font(.footnote)
                    .foregroundStyle(.green)
                    .multilineTextAlignment(.center)
            }
            if let lastAuthFlowLabel, !lastAuthFlowLabel.isEmpty {
                Text("Auth Mode Used: \(lastAuthFlowLabel)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            if let errorMessage = store.errorMessage, !errorMessage.isEmpty {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(22)
        .frame(maxWidth: 460)
        .hazmatPanel()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .hazmatBackground()
    }

    private var actionButtonTitle: String {
        switch mode {
        case .signIn: return "Sign In"
        case .createAccount: return "Create Account"
        case .resetPassword: return "Reset Password"
        }
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

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = context.coordinator
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

    final class Coordinator: NSObject, WKUIDelegate {
        func webView(
            _ webView: WKWebView,
            runJavaScriptAlertPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping () -> Void
        ) {
            presentAlert(
                on: webView,
                title: nil,
                message: message,
                actions: [UIAlertAction(title: "OK", style: .default) { _ in completionHandler() }],
                fallback: completionHandler
            )
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptConfirmPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping (Bool) -> Void
        ) {
            presentAlert(
                on: webView,
                title: nil,
                message: message,
                actions: [
                    UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) },
                    UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) }
                ],
                fallback: { completionHandler(false) }
            )
        }

        private func presentAlert(
            on webView: WKWebView,
            title: String?,
            message: String,
            actions: [UIAlertAction],
            fallback: @escaping () -> Void
        ) {
            DispatchQueue.main.async {
                guard let presenter = Self.topViewController(from: webView) else {
                    fallback()
                    return
                }
                let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
                actions.forEach(alert.addAction)
                presenter.present(alert, animated: true)
            }
        }

        private static func topViewController(from webView: WKWebView) -> UIViewController? {
            var controller = webView.window?.rootViewController
            if controller == nil {
                controller = UIApplication.shared.connectedScenes
                    .compactMap { $0 as? UIWindowScene }
                    .flatMap(\.windows)
                    .first(where: \.isKeyWindow)?
                    .rootViewController
            }
            while let presented = controller?.presentedViewController {
                controller = presented
            }
            return controller
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

private final class MapperBridgeViewController: BridgeViewController, UIGestureRecognizerDelegate {
    private struct PopGestureState {
        let isEnabled: Bool
        weak var delegate: UIGestureRecognizerDelegate?
    }

    private var savedPopGestureStates: [ObjectIdentifier: PopGestureState] = [:]
    private var managedWebViewEdgeRecognizers: [ObjectIdentifier: Bool] = [:]
    private lazy var leftEdgeBlockerGesture: UIScreenEdgePanGestureRecognizer = {
        let gesture = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(handleLeftEdgeBlockerPan(_:)))
        gesture.edges = .left
        gesture.cancelsTouchesInView = false
        gesture.delegate = self
        return gesture
    }()

    override func viewDidLoad() {
        super.viewDidLoad()
        lockModalDismissal()
        if !(view.gestureRecognizers?.contains(leftEdgeBlockerGesture) ?? false) {
            view.addGestureRecognizer(leftEdgeBlockerGesture)
        }
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        setInteractivePopEnabled(false)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // SwiftUI can attach the representable into the UINavigationController after viewWillAppear.
        setInteractivePopEnabled(false)
        hardenWebViewGestures()
        DispatchQueue.main.async { [weak self] in
            self?.setInteractivePopEnabled(false)
            self?.hardenWebViewGestures()
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        setInteractivePopEnabled(false)
        hardenWebViewGestures()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        restoreInteractivePopGesture()
        restoreWebViewGestures()
    }

    override public func capacitorDidLoad() {
        super.capacitorDidLoad()
        // Avoid WKWebView edge-swipe history navigation competing with canvas/icon dragging.
        webView?.allowsBackForwardNavigationGestures = false
        hardenWebViewGestures()
    }

    private func setInteractivePopEnabled(_ isEnabled: Bool) {
        for nav in allAncestorNavigationControllers() {
            guard let popGesture = nav.interactivePopGestureRecognizer else { continue }
            let id = ObjectIdentifier(nav)
            if savedPopGestureStates[id] == nil {
                savedPopGestureStates[id] = PopGestureState(
                    isEnabled: popGesture.isEnabled,
                    delegate: popGesture.delegate
                )
            }
            if isEnabled {
                let previous = savedPopGestureStates[id]
                popGesture.delegate = previous?.delegate
                popGesture.isEnabled = previous?.isEnabled ?? true
            } else {
                // Keep the recognizer alive but force-block begin to prevent accidental back navigation
                // from left-edge drags used by the mapper icon drawer.
                popGesture.delegate = self
                popGesture.isEnabled = true
                popGesture.require(toFail: leftEdgeBlockerGesture)
            }
        }
    }

    private func restoreInteractivePopGesture() {
        setInteractivePopEnabled(true)
        savedPopGestureStates.removeAll()
    }

    private func lockModalDismissal() {
        isModalInPresentation = true
        navigationController?.isModalInPresentation = true
        parent?.isModalInPresentation = true
        presentingViewController?.isModalInPresentation = true
    }

    private func hardenWebViewGestures() {
        lockModalDismissal()
        guard let webView else { return }
        webView.allowsBackForwardNavigationGestures = false
        installLeftEdgeBlockerIfNeeded(on: webView)
        installLeftEdgeBlockerIfNeeded(on: webView.scrollView)
        disableScreenEdgeGestures(on: webView)
        disableScreenEdgeGestures(on: webView.scrollView)
    }

    private func restoreWebViewGestures() {
        guard let webView else { return }
        restoreScreenEdgeGestures(on: webView)
        restoreScreenEdgeGestures(on: webView.scrollView)
        managedWebViewEdgeRecognizers.removeAll()
    }

    private func installLeftEdgeBlockerIfNeeded(on view: UIView) {
        if view.gestureRecognizers?.contains(leftEdgeBlockerGesture) == true { return }
        view.addGestureRecognizer(leftEdgeBlockerGesture)
    }

    private func disableScreenEdgeGestures(on view: UIView) {
        guard let recognizers = view.gestureRecognizers else { return }
        for recognizer in recognizers where recognizer is UIScreenEdgePanGestureRecognizer {
            if recognizer === leftEdgeBlockerGesture { continue }
            let id = ObjectIdentifier(recognizer)
            if managedWebViewEdgeRecognizers[id] == nil {
                managedWebViewEdgeRecognizers[id] = recognizer.isEnabled
            }
            recognizer.isEnabled = false
        }
    }

    private func restoreScreenEdgeGestures(on view: UIView) {
        guard let recognizers = view.gestureRecognizers else { return }
        for recognizer in recognizers where recognizer is UIScreenEdgePanGestureRecognizer {
            let id = ObjectIdentifier(recognizer)
            guard let wasEnabled = managedWebViewEdgeRecognizers[id] else { continue }
            recognizer.isEnabled = wasEnabled
        }
    }

    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        if gestureRecognizer === leftEdgeBlockerGesture {
            return true
        }
        for nav in allAncestorNavigationControllers() {
            if gestureRecognizer === nav.interactivePopGestureRecognizer {
                return false
            }
        }
        return true
    }

    @objc
    private func handleLeftEdgeBlockerPan(_ gesture: UIScreenEdgePanGestureRecognizer) {
        // Intentionally no-op. This recognizer exists solely to absorb left-edge pan starts
        // so iOS doesn't treat long-press+drag gestures in the mapper as back navigation.
        _ = gesture.state
    }

    private func allAncestorNavigationControllers() -> [UINavigationController] {
        var controllers: [UINavigationController] = []
        var seen = Set<ObjectIdentifier>()

        func appendIfNew(_ nav: UINavigationController?) {
            guard let nav else { return }
            let id = ObjectIdentifier(nav)
            guard !seen.contains(id) else { return }
            seen.insert(id)
            controllers.append(nav)
        }

        appendIfNew(navigationController)
        var current = parent
        while let node = current {
            if let nav = node as? UINavigationController {
                appendIfNew(nav)
            }
            appendIfNew(node.navigationController)
            current = node.parent
        }

        if let windowNav = view.window?.rootViewController as? UINavigationController {
            appendIfNew(windowNav)
        }
        return controllers
    }
}
