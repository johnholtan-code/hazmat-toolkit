import SwiftUI
import UIKit

@main
struct ToolboxMainApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            HazmatToolboxRootView()
        }
    }
}
