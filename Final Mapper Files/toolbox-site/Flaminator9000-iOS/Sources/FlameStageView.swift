import SpriteKit
import SwiftUI
import UIKit

struct FlameStageView: View {
    @EnvironmentObject private var simulation: FlameSimulationStore

    var body: some View {
        GeometryReader { proxy in
            SpriteKitStageRepresentable(simulation: simulation, size: proxy.size)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onEnded { value in
                            let size = proxy.size
                            guard size.width > 0, size.height > 0 else { return }
                            let x = min(max(0, value.location.x / size.width), 1)
                            let y = min(max(0, value.location.y / size.height), 1)
                            simulation.setActiveEmitterPosition(x: x, y: y)
                        }
                )
        }
    }
}

private struct SpriteKitStageRepresentable: UIViewRepresentable {
    @MainActor final class Coordinator {
        let scene = FlameSpriteScene()
        weak var view: SKView?
    }

    let simulation: FlameSimulationStore
    let size: CGSize

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> SKView {
        let view = SKView(frame: .zero)
        view.ignoresSiblingOrder = true
        view.allowsTransparency = false
        view.backgroundColor = .black

        let scene = context.coordinator.scene
        scene.bind(store: simulation)
        if size.width > 0, size.height > 0 {
            scene.size = size
        }
        view.presentScene(scene)

        context.coordinator.view = view
        simulation.registerStageRenderer(view: view, scene: scene)
        return view
    }

    func updateUIView(_ uiView: SKView, context: Context) {
        let scene = context.coordinator.scene
        scene.bind(store: simulation)
        if size.width > 0, size.height > 0, scene.size != size {
            scene.size = size
        }
        if uiView.scene !== scene {
            uiView.presentScene(scene)
        }
        simulation.registerStageRenderer(view: uiView, scene: scene)
    }
}
