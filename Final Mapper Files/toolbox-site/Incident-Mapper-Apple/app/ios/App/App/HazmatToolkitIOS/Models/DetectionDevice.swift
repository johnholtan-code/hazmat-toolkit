import Foundation

enum DetectionDevice: String, CaseIterable, Codable, Hashable, Identifiable {
    case airMonitor = "Air Monitor"
    case radiationDetection = "Radiation Detection"
    case phPaper = "pH Paper"
    case flameSpectroscopy = "Flame Spectroscopy"
    case ionMobility = "Ion Mobility Spectroscopy"
    case hpms = "High Pressure Mass Spectrometry"
    case xrf = "Xray Fluorescence"
    case gcms = "GC-MS: Gas Chromatograph-Mass Spectrometer"
    case bioDetection = "Bio-Detection"
    case pid = "PID - Photoionization Detector"
    case wetChemistry = "Wet Chemistry"
    case colorimetricTubes = "Colorimetric Tubes"
    case fid = "FID - Flame Ionization Detector"

    var id: String { rawValue }

    var isAvailableInCurrentPowerApp: Bool {
        switch self {
        case .airMonitor, .radiationDetection, .phPaper:
            return true
        default:
            return false
        }
    }
}
