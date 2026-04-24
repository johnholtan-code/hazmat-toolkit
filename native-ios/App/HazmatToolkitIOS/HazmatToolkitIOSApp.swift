#if os(iOS)
import SwiftUI
import UIKit

@main
struct HazmatToolkitIOSApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            HazmatToolboxRootView()
        }
    }
}
#endif
