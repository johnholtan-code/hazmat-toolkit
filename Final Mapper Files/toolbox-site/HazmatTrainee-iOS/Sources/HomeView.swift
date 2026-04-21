import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ScreenShell(title: "Hazmat ToolK.I.T.", subtitle: "Knowledge In Training") {
            VStack(spacing: 18) {
                Text("Type out the student-name for the trainer to see")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)
                    .padding(.horizontal)

                TextField("Your Name", text: $model.traineeName)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .font(.title3)
                    .padding()
                    .background(model.traineeName.isEmpty ? THMGTheme.accentYellow : .white, in: Rectangle())
                    .overlay(Rectangle().stroke(Color.black.opacity(0.15), lineWidth: 1))

                Button("Next") {
                    model.navPath.append(AppScreen.scenarios)
                }
                .buttonStyle(.borderedProminent)
                .tint(THMGTheme.thmgYellow)
                .foregroundStyle(.black)
                .controlSize(.large)
                .disabled(model.traineeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                Image("THMGWebLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 420)
                    .padding(.top, 12)
            }
            .padding(16)
            .background(Color.black, in: RoundedRectangle(cornerRadius: 20))
        }
        .navigationBarBackButtonHidden(true)
    }
}
