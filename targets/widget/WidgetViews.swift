import SwiftUI
import WidgetKit

// MARK: - Small Widget View

struct SmallWidgetView: View {
    let data: WidgetData
    
    var body: some View {
        if data.promises.isEmpty {
            EmptyStateView()
        } else {
            SmallPromiseView(promise: data.promises.first!, totalAtStake: data.totalAtStake)
        }
    }
}

struct SmallPromiseView: View {
    let promise: WidgetPromise
    let totalAtStake: Int
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Urgency indicator + countdown
            HStack(spacing: 6) {
                Circle()
                    .fill(WidgetTheme.color(for: promise.urgency))
                    .frame(width: 8, height: 8)
                
                Text(promise.formattedTimeRemaining)
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(WidgetTheme.color(for: promise.urgency))
            }
            
            // Promise text (truncated)
            Text(promise.text)
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(WidgetTheme.text)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            
            Spacer()
            
            // Total at stake
            HStack {
                Text("At stake")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(WidgetTheme.textTertiary)
                
                Spacer()
                
                Text("$\(totalAtStake)")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundColor(WidgetTheme.money)
            }
        }
        .padding(12)
        .containerBackground(for: .widget) {
            WidgetTheme.bg
        }
    }
}

// MARK: - Medium Widget View

struct MediumWidgetView: View {
    let data: WidgetData
    
    var body: some View {
        if data.promises.isEmpty {
            EmptyStateView()
        } else {
            MediumPromisesView(data: data)
        }
    }
}

struct MediumPromisesView: View {
    let data: WidgetData
    
    var body: some View {
        HStack(spacing: 12) {
            // Left side: Promise list (up to 2)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(data.promises.prefix(2))) { promise in
                    PromiseRowView(promise: promise)
                }
                
                // If only 1 promise, add spacer
                if data.promises.count == 1 {
                    Spacer()
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            
            // Right side: Stats
            VStack(alignment: .trailing, spacing: 4) {
                Text("TOTAL AT STAKE")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(WidgetTheme.textMuted)
                    .tracking(0.5)
                
                Text("$\(data.totalAtStake)")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundColor(WidgetTheme.money)
                
                Spacer()
                
                // Promise count
                Text("\(data.promises.count) active")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(WidgetTheme.textTertiary)
            }
            .frame(width: 90)
        }
        .padding(14)
        .containerBackground(for: .widget) {
            WidgetTheme.bg
        }
    }
}

struct PromiseRowView: View {
    let promise: WidgetPromise
    
    var body: some View {
        HStack(spacing: 8) {
            // Urgency indicator
            RoundedRectangle(cornerRadius: 2)
                .fill(WidgetTheme.color(for: promise.urgency))
                .frame(width: 3, height: 32)
            
            VStack(alignment: .leading, spacing: 2) {
                // Promise text
                Text(promise.text)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(WidgetTheme.text)
                    .lineLimit(1)
                
                // Countdown + stake
                HStack(spacing: 8) {
                    Text(promise.formattedTimeRemaining)
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(WidgetTheme.color(for: promise.urgency))
                    
                    Text(promise.formattedStake)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(WidgetTheme.money)
                }
            }
            
            Spacer()
        }
    }
}

// MARK: - Empty State

struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "checkmark.seal")
                .font(.system(size: 28))
                .foregroundColor(WidgetTheme.accent)
            
            Text("No active promises")
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(WidgetTheme.textSecondary)
            
            Text("Tap to make one")
                .font(.system(size: 11))
                .foregroundColor(WidgetTheme.textTertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(for: .widget) {
            WidgetTheme.bg
        }
    }
}

// MARK: - Previews

#Preview("Small - With Promise", as: .systemSmall) {
    OopsFeeWidget()
} timeline: {
    WidgetEntry(date: .now, data: .preview)
}

#Preview("Medium - With Promises", as: .systemMedium) {
    OopsFeeWidget()
} timeline: {
    WidgetEntry(date: .now, data: .preview)
}

#Preview("Small - Empty", as: .systemSmall) {
    OopsFeeWidget()
} timeline: {
    WidgetEntry(date: .now, data: .empty)
}

// MARK: - Preview Data

extension WidgetData {
    static let preview = WidgetData(
        promises: [
            WidgetPromise(
                id: "1",
                text: "Go to the gym 3x this week",
                stake: 25,
                deadlineAt: Int64((Date().timeIntervalSince1970 + 3600 * 5) * 1000),
                urgency: .high
            ),
            WidgetPromise(
                id: "2",
                text: "Finish the project report",
                stake: 50,
                deadlineAt: Int64((Date().timeIntervalSince1970 + 3600 * 48) * 1000),
                urgency: .medium
            )
        ],
        totalAtStake: 75,
        updatedAt: Int64(Date().timeIntervalSince1970 * 1000)
    )
}

