import SwiftUI
import AVFoundation
import UIKit
import AudioToolbox
import HazMatDesignSystem

struct HomeView: View {
    @EnvironmentObject private var model: AppModel
    @State private var showQRScanner = false

    var body: some View {
        ScreenShell(title: "Hazmat ToolK.I.T.", subtitle: "Knowledge In Training") {
            VStack(spacing: 18) {
                Text("Enter your name, then join with the trainer's session code.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.88))
                    .padding(.horizontal)

                TextField("Your Name", text: $model.traineeName)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .font(.title3)
                    .foregroundStyle(.white)
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(model.traineeName.isEmpty ? ThemeColors.accent.opacity(0.22) : ThemeColors.panel)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(ThemeColors.panelStroke, lineWidth: 1)
                    )

                VStack(spacing: 10) {
                    TextField("Session Join Code (optional)", text: $model.joinCode)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .font(.title3.monospaced())
                        .foregroundStyle(.white)
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(ThemeColors.panel)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(ThemeColors.panelStroke, lineWidth: 1)
                        )

                    Button("Scan QR Code") {
                        showQRScanner = true
                    }
                    .buttonStyle(SecondaryButtonStyle())

                    Button(model.isJoiningSession ? "Joining..." : "Join Live Session") {
                        Task { await model.joinScenarioSessionFromBackend() }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(
                        model.isJoiningSession ||
                        model.traineeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                        model.joinCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    )

                }

                if model.hasDownloadedScenario {
                    VStack(spacing: 10) {
                        Button("Continue Session") {
                            Task { await model.continueSession() }
                        }
                        .buttonStyle(SecondaryButtonStyle())
                        .controlSize(.large)

                        Button(model.isJoiningSession ? "Refreshing..." : "Fresh Join") {
                            Task { await model.freshJoinSession() }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .controlSize(.large)
                        .disabled(model.isJoiningSession)
                    }
                }

                Image("THMGWebLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 420)
                    .padding(.top, 12)
            }
            .hazmatPanel()
        }
        .navigationBarBackButtonHidden(true)
        .alert(
            "Join Session Error",
            isPresented: Binding(
                get: { model.backendErrorMessage != nil },
                set: { if !$0 { model.clearBackendError() } }
            )
        ) {
            Button("OK") { model.clearBackendError() }
        } message: {
            Text(model.backendErrorMessage ?? "Unknown error")
        }
        .sheet(isPresented: $showQRScanner) {
            QRScannerSheet { payload in
                model.applyScannedJoinPayload(payload)
                showQRScanner = false
            } onCancel: {
                showQRScanner = false
            }
        }
    }
}

private struct QRScannerSheet: View {
    let onCodeScanned: (String) -> Void
    let onCancel: () -> Void

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                QRScannerCameraView(onCodeScanned: onCodeScanned)
                    .ignoresSafeArea()

                VStack(spacing: 8) {
                    Text("Scan the trainer's session QR code")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text("The app reads the join code and fills it automatically.")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.75))
                }
                .padding()
                .frame(maxWidth: .infinity)
                .hazmatPanel()
            }
            .hazmatBackground()
            .navigationTitle("Scan QR")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
            }
        }
    }
}

private struct QRScannerCameraView: UIViewControllerRepresentable {
    let onCodeScanned: (String) -> Void

    func makeUIViewController(context: Context) -> QRScannerViewController {
        let controller = QRScannerViewController()
        controller.onCodeScanned = onCodeScanned
        return controller
    }

    func updateUIViewController(_ uiViewController: QRScannerViewController, context: Context) {}
}

private final class QRScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onCodeScanned: ((String) -> Void)?

    private let session = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var hasScannedCode = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        configureCamera()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    private func configureCamera() {
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device) else {
            return
        }

        if session.canAddInput(input) {
            session.addInput(input)
        }

        let output = AVCaptureMetadataOutput()
        if session.canAddOutput(output) {
            session.addOutput(output)
            output.setMetadataObjectsDelegate(self, queue: .main)
            output.metadataObjectTypes = [.qr]
        }

        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.videoGravity = .resizeAspectFill
        preview.frame = view.bounds
        view.layer.addSublayer(preview)
        previewLayer = preview

        DispatchQueue.global(qos: .userInitiated).async { [session] in
            session.startRunning()
        }
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard !hasScannedCode else { return }
        guard let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              object.type == .qr,
              let value = object.stringValue else { return }

        hasScannedCode = true
        session.stopRunning()
        AudioServicesPlaySystemSound(SystemSoundID(kSystemSoundID_Vibrate))
        onCodeScanned?(value)
    }
}
