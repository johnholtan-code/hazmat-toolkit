import SwiftUI
import Combine
import AudioToolbox

struct RadiationSimulatorView: View {
    @EnvironmentObject private var model: AppModel
    @State private var clickTimer = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()
    @State private var clickAccumulator: TimeInterval = 0
    @State private var lastClickTickDate = Date()

    var body: some View {
        ScreenShell(title: "Radiation Monitor", subtitle: model.selectedScenario?.name ?? "Radiation Simulator") {
            VStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Dose Rate")
                        .font(.headline)
                    Text(model.radiationDisplayStatusText)
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundStyle(model.isRadiationOverRange ? .red : .primary)
                    HStack {
                        Text("Background: \(model.formattedBackgroundText)")
                        Spacer()
                        Text("@1m: \(model.formattedDoseAt1mText)")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)

                    HStack {
                        Text("Distance to source: \(model.formattedRadiationDistanceText)")
                        Spacer()
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.white, in: RoundedRectangle(cornerRadius: 16))

                VStack(alignment: .leading, spacing: 8) {
                    Text("Live Tracking")
                        .font(.headline)
                    Text(model.isGPSDrivenLiveSession
                         ? "Source-tracking active. Move closer/farther and adjust pointing to change readings."
                         : "Join a training session to receive real-time radiation changes.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    if let heading = model.deviceHeadingDegrees, model.isGPSDrivenLiveSession {
                        Text("Heading: \(heading, specifier: "%.0f")°")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Text("Clicks: \(model.radiationEstimatedClicksPerSecond, specifier: "%.1f") cps")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.white, in: RoundedRectangle(cornerRadius: 16))
            }
        }
        .onReceive(clickTimer) { _ in
            emitRadiationClicks()
        }
        .onDisappear {
            clickAccumulator = 0
            lastClickTickDate = Date()
        }
    }

    private func emitRadiationClicks() {
        let now = Date()
        let dt = max(0.02, now.timeIntervalSince(lastClickTickDate))
        lastClickTickDate = now
        clickAccumulator += dt
        let interval = model.radiationClickIntervalSeconds
        guard interval > 0 else { return }
        if clickAccumulator >= interval {
            clickAccumulator = 0
            RadiationClickSoundPlayer.playClick(overRange: model.isRadiationOverRange)
        }
    }
}

private enum RadiationClickSoundPlayer {
    private static var clickSoundID: SystemSoundID?
    private static var attemptedLoadClick = false

    static func playClick(overRange: Bool) {
        if overRange {
            AudioServicesPlaySystemSound(SystemSoundID(1016))
        } else {
            playBundledClick()
        }
    }

    private static func playBundledClick() {
        if !attemptedLoadClick {
            attemptedLoadClick = true
            clickSoundID = loadSystemSoundID(resource: "radiation_click", ext: "wav")
        }

        if let clickSoundID {
            AudioServicesPlaySystemSound(clickSoundID)
        } else {
            AudioServicesPlaySystemSound(SystemSoundID(1104))
        }
    }

    private static func loadSystemSoundID(resource: String, ext: String) -> SystemSoundID? {
        guard let url = Bundle.main.url(forResource: resource, withExtension: ext) else { return nil }
        var soundID: SystemSoundID = 0
        let status = AudioServicesCreateSystemSoundID(url as CFURL, &soundID)
        guard status == kAudioServicesNoError else { return nil }
        return soundID
    }
}
