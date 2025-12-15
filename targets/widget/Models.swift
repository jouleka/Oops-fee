import Foundation

/// Urgency level for a promise - determines color coding
enum PromiseUrgency: String, Codable {
    case low
    case medium
    case high
    case critical
}

/// Lightweight promise data for widget display
struct WidgetPromise: Codable, Identifiable {
    let id: String
    let text: String
    let stake: Int
    let deadlineAt: Int64  // ms since epoch
    let urgency: PromiseUrgency
    
    /// Calculate time remaining from now
    var timeRemaining: TimeInterval {
        let deadline = Date(timeIntervalSince1970: Double(deadlineAt) / 1000.0)
        return deadline.timeIntervalSince(Date())
    }
    
    /// Formatted time remaining string
    var formattedTimeRemaining: String {
        let remaining = timeRemaining
        
        if remaining <= 0 {
            return "EXPIRED"
        }
        
        let hours = Int(remaining) / 3600
        let minutes = (Int(remaining) % 3600) / 60
        
        if hours < 1 {
            return "\(minutes)m"
        } else if hours < 24 {
            return "\(hours)h \(minutes)m"
        } else {
            let days = hours / 24
            let remainingHours = hours % 24
            return "\(days)d \(remainingHours)h"
        }
    }
    
    /// Formatted stake string
    var formattedStake: String {
        return "$\(stake)"
    }
}

/// Complete widget data payload from App Groups
struct WidgetData: Codable {
    let promises: [WidgetPromise]
    let totalAtStake: Int
    let updatedAt: Int64
    
    static let empty = WidgetData(promises: [], totalAtStake: 0, updatedAt: 0)
    
    var formattedTotalAtStake: String {
        return "$\(totalAtStake)"
    }
}

/// App Group constants
struct AppGroupConstants {
    static let groupId = "group.com.oopsfee.app"
    static let widgetDataKey = "widget_data"
}

