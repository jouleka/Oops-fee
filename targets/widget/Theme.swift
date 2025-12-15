import SwiftUI

/// OopsFee Widget Theme - matches the React Native app's dark theme
struct WidgetTheme {
    // Core backgrounds
    static let bg = Color(hex: "#000000")
    static let bgElevated = Color(hex: "#0A0A0C")
    static let bgCard = Color.white.opacity(0.04)
    
    // Text
    static let text = Color.white
    static let textSecondary = Color.white.opacity(0.70)
    static let textTertiary = Color.white.opacity(0.45)
    static let textMuted = Color.white.opacity(0.30)
    
    // Brand / Accent
    static let accent = Color(hex: "#0B93F6")  // iMessage blue
    
    // Urgency colors
    static let urgencyLow = Color(hex: "#34C759")
    static let urgencyMedium = Color(hex: "#FF9F0A")
    static let urgencyHigh = Color(hex: "#FF6B35")
    static let urgencyCritical = Color(hex: "#FF453A")
    
    // Semantic colors
    static let money = Color(hex: "#00D632")
    static let danger = Color(hex: "#FF453A")
    
    /// Get color for urgency level
    static func color(for urgency: PromiseUrgency) -> Color {
        switch urgency {
        case .low:
            return urgencyLow
        case .medium:
            return urgencyMedium
        case .high:
            return urgencyHigh
        case .critical:
            return urgencyCritical
        }
    }
}

// MARK: - Color Extension for Hex

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

