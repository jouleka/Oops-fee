import WidgetKit
import SwiftUI

// MARK: - Timeline Entry

struct WidgetEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

// MARK: - Timeline Provider

struct OopsFeeWidgetProvider: TimelineProvider {
    
    func placeholder(in context: Context) -> WidgetEntry {
        WidgetEntry(date: Date(), data: .preview)
    }
    
    func getSnapshot(in context: Context, completion: @escaping (WidgetEntry) -> Void) {
        let data = WidgetDataProvider.shared.loadWidgetData()
        let entry = WidgetEntry(date: Date(), data: data)
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetEntry>) -> Void) {
        let data = WidgetDataProvider.shared.loadWidgetData()
        let currentDate = Date()
        
        print("[Widget] getTimeline called, loaded \(data.promises.count) promises, total: $\(data.totalAtStake)")
        
        // Create a single entry with current data
        // The timeline will be refreshed when reloadAllTimelines() is called from the app
        let entry = WidgetEntry(date: currentDate, data: data)
        
        // Refresh timeline after 5 minutes as a fallback
        // The app will call reloadAllTimelines() on any promise change for immediate updates
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 5, to: currentDate)!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        
        completion(timeline)
    }
}

// MARK: - Widget Entry View

struct OopsFeeWidgetEntryView: View {
    var entry: OopsFeeWidgetProvider.Entry
    @Environment(\.widgetFamily) var family
    
    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(data: entry.data)
        case .systemMedium:
            MediumWidgetView(data: entry.data)
        default:
            SmallWidgetView(data: entry.data)
        }
    }
}

// MARK: - Widget Definition

struct OopsFeeWidget: Widget {
    let kind: String = "OopsFeeWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: OopsFeeWidgetProvider()) { entry in
            OopsFeeWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("OopsFee")
        .description("Track your promises and stakes at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

// MARK: - Widget Bundle (Entry Point)

@main
struct OopsFeeWidgetBundle: WidgetBundle {
    var body: some Widget {
        OopsFeeWidget()
    }
}

