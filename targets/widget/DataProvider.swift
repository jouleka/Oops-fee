import Foundation

/// Loads widget data from App Groups UserDefaults
class WidgetDataProvider {
    
    static let shared = WidgetDataProvider()
    
    private init() {}
    
    /// Load widget data from shared UserDefaults
    func loadWidgetData() -> WidgetData {
        guard let userDefaults = UserDefaults(suiteName: AppGroupConstants.groupId) else {
            print("[Widget] Failed to access App Group UserDefaults")
            return .empty
        }
        
        guard let jsonString = userDefaults.string(forKey: AppGroupConstants.widgetDataKey) else {
            print("[Widget] No widget data found in UserDefaults")
            return .empty
        }
        
        guard let jsonData = jsonString.data(using: .utf8) else {
            print("[Widget] Failed to convert JSON string to data")
            return .empty
        }
        
        do {
            let decoder = JSONDecoder()
            let data = try decoder.decode(WidgetData.self, from: jsonData)
            print("[Widget] Successfully loaded \(data.promises.count) promises")
            return data
        } catch {
            print("[Widget] Failed to decode widget data: \(error)")
            return .empty
        }
    }
}

