const { withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Widget Kotlin Files
// ============================================================================

const WIDGET_MODELS_KT = `package com.oopsfee.app.widget

import org.json.JSONArray
import org.json.JSONObject

/**
 * Urgency level for a promise - determines color coding
 */
enum class PromiseUrgency {
    LOW, MEDIUM, HIGH, CRITICAL;

    companion object {
        fun fromString(value: String): PromiseUrgency {
            return when (value.lowercase()) {
                "low" -> LOW
                "medium" -> MEDIUM
                "high" -> HIGH
                "critical" -> CRITICAL
                else -> MEDIUM
            }
        }
    }
}

/**
 * Lightweight promise data for widget display
 */
data class WidgetPromise(
    val id: String,
    val text: String,
    val stake: Int,
    val deadlineAt: Long, // ms since epoch
    val urgency: PromiseUrgency
) {
    val timeRemaining: Long
        get() = deadlineAt - System.currentTimeMillis()

    val formattedTimeRemaining: String
        get() {
            val remaining = timeRemaining
            if (remaining <= 0) return "EXPIRED"
            val totalMinutes = (remaining / (1000 * 60)).toInt()
            val hours = totalMinutes / 60
            val minutes = totalMinutes % 60
            return when {
                hours < 1 -> "\${minutes}m"
                hours < 24 -> "\${hours}h \${minutes}m"
                else -> {
                    val days = hours / 24
                    val remainingHours = hours % 24
                    "\${days}d \${remainingHours}h"
                }
            }
        }

    val formattedStake: String
        get() = "$$stake"

    companion object {
        fun fromJson(json: JSONObject): WidgetPromise {
            return WidgetPromise(
                id = json.getString("id"),
                text = json.getString("text"),
                stake = json.getInt("stake"),
                deadlineAt = json.getLong("deadlineAt"),
                urgency = PromiseUrgency.fromString(json.getString("urgency"))
            )
        }
    }
}

data class WidgetData(
    val promises: List<WidgetPromise>,
    val totalAtStake: Int,
    val updatedAt: Long
) {
    val formattedTotalAtStake: String
        get() = "$$totalAtStake"

    companion object {
        val EMPTY = WidgetData(emptyList(), 0, 0)

        fun fromJson(jsonString: String?): WidgetData {
            if (jsonString.isNullOrEmpty()) return EMPTY
            return try {
                val json = JSONObject(jsonString)
                val promisesArray = json.getJSONArray("promises")
                val promises = mutableListOf<WidgetPromise>()
                for (i in 0 until promisesArray.length()) {
                    promises.add(WidgetPromise.fromJson(promisesArray.getJSONObject(i)))
                }
                WidgetData(
                    promises = promises,
                    totalAtStake = json.getInt("totalAtStake"),
                    updatedAt = json.getLong("updatedAt")
                )
            } catch (e: Exception) {
                android.util.Log.e("WidgetModels", "Failed to parse widget data: \${e.message}")
                EMPTY
            }
        }
    }
}

object WidgetConstants {
    const val PREFS_NAME = "com.oopsfee.app.widget"
    const val WIDGET_DATA_KEY = "widget_data"
}
`;

const WIDGET_THEME_KT = `package com.oopsfee.app.widget

import android.graphics.Color

object WidgetTheme {
    val bg = Color.parseColor("#000000")
    val bgElevated = Color.parseColor("#0A0A0C")
    val bgCard = Color.parseColor("#0A0A0A")
    val text = Color.WHITE
    val textSecondary = Color.parseColor("#B3FFFFFF")
    val textTertiary = Color.parseColor("#73FFFFFF")
    val textMuted = Color.parseColor("#4DFFFFFF")
    val accent = Color.parseColor("#0B93F6")
    val urgencyLow = Color.parseColor("#34C759")
    val urgencyMedium = Color.parseColor("#FF9F0A")
    val urgencyHigh = Color.parseColor("#FF6B35")
    val urgencyCritical = Color.parseColor("#FF453A")
    val money = Color.parseColor("#00D632")
    val danger = Color.parseColor("#FF453A")

    fun colorForUrgency(urgency: PromiseUrgency): Int {
        return when (urgency) {
            PromiseUrgency.LOW -> urgencyLow
            PromiseUrgency.MEDIUM -> urgencyMedium
            PromiseUrgency.HIGH -> urgencyHigh
            PromiseUrgency.CRITICAL -> urgencyCritical
        }
    }
}
`;

const WIDGET_PROVIDER_KT = `package com.oopsfee.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import com.oopsfee.app.MainActivity
import com.oopsfee.app.R

class OopsFeeWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val TAG = "OopsFeeWidget"

        fun requestUpdate(context: Context) {
            val intent = Intent(context, OopsFeeWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            }
            val widgetManager = AppWidgetManager.getInstance(context)
            val widgetIds = widgetManager.getAppWidgetIds(
                ComponentName(context, OopsFeeWidgetProvider::class.java)
            )
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, widgetIds)
            context.sendBroadcast(intent)
            Log.d(TAG, "Requested update for \${widgetIds.size} widgets")
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        Log.d(TAG, "onUpdate called for \${appWidgetIds.size} widgets")
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onAppWidgetOptionsChanged(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int, newOptions: Bundle) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        updateAppWidget(context, appWidgetManager, appWidgetId)
    }

    private fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        val data = loadWidgetData(context)
        Log.d(TAG, "Loaded \${data.promises.size} promises, total: $\${data.totalAtStake}")

        val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
        val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
        val isSmall = minWidth < 200

        val views = if (data.promises.isEmpty()) {
            createEmptyView(context)
        } else if (isSmall) {
            createSmallView(context, data)
        } else {
            createMediumView(context, data)
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun loadWidgetData(context: Context): WidgetData {
        val prefs = context.getSharedPreferences(WidgetConstants.PREFS_NAME, Context.MODE_PRIVATE)
        val jsonString = prefs.getString(WidgetConstants.WIDGET_DATA_KEY, null)
        return WidgetData.fromJson(jsonString)
    }

    private fun createEmptyView(context: Context): RemoteViews {
        return RemoteViews(context.packageName, R.layout.widget_empty)
    }

    private fun createSmallView(context: Context, data: WidgetData): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_small)
        val promise = data.promises.first()
        views.setInt(R.id.urgency_indicator, "setColorFilter", WidgetTheme.colorForUrgency(promise.urgency))
        views.setTextViewText(R.id.countdown_text, promise.formattedTimeRemaining)
        views.setTextColor(R.id.countdown_text, WidgetTheme.colorForUrgency(promise.urgency))
        views.setTextViewText(R.id.promise_text, promise.text)
        views.setTextViewText(R.id.stake_amount, data.formattedTotalAtStake)
        return views
    }

    private fun createMediumView(context: Context, data: WidgetData): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_medium)
        views.setTextViewText(R.id.total_stake, data.formattedTotalAtStake)
        views.setTextViewText(R.id.active_count, "\${data.promises.size} active")

        if (data.promises.isNotEmpty()) {
            val promise1 = data.promises[0]
            views.setViewVisibility(R.id.promise_row_1, View.VISIBLE)
            views.setInt(R.id.urgency_bar_1, "setColorFilter", WidgetTheme.colorForUrgency(promise1.urgency))
            views.setTextViewText(R.id.promise_text_1, promise1.text)
            views.setTextViewText(R.id.countdown_1, promise1.formattedTimeRemaining)
            views.setTextColor(R.id.countdown_1, WidgetTheme.colorForUrgency(promise1.urgency))
            views.setTextViewText(R.id.stake_1, promise1.formattedStake)
        } else {
            views.setViewVisibility(R.id.promise_row_1, View.GONE)
        }

        if (data.promises.size > 1) {
            val promise2 = data.promises[1]
            views.setViewVisibility(R.id.promise_row_2, View.VISIBLE)
            views.setInt(R.id.urgency_bar_2, "setColorFilter", WidgetTheme.colorForUrgency(promise2.urgency))
            views.setTextViewText(R.id.promise_text_2, promise2.text)
            views.setTextViewText(R.id.countdown_2, promise2.formattedTimeRemaining)
            views.setTextColor(R.id.countdown_2, WidgetTheme.colorForUrgency(promise2.urgency))
            views.setTextViewText(R.id.stake_2, promise2.formattedStake)
        } else {
            views.setViewVisibility(R.id.promise_row_2, View.GONE)
        }

        return views
    }

    override fun onEnabled(context: Context) { Log.d(TAG, "Widget enabled") }
    override fun onDisabled(context: Context) { Log.d(TAG, "Widget disabled") }
}
`;

const WIDGET_MODULE_KT = `package com.oopsfee.app.widget

import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class WidgetModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "WidgetModule"
        const val NAME = "WidgetModule"
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun setWidgetData(jsonData: String, promise: Promise) {
        try {
            Log.d(TAG, "setWidgetData called with \${jsonData.length} chars")
            val prefs = reactApplicationContext.getSharedPreferences(WidgetConstants.PREFS_NAME, android.content.Context.MODE_PRIVATE)
            prefs.edit().putString(WidgetConstants.WIDGET_DATA_KEY, jsonData).apply()
            Log.d(TAG, "Widget data saved to SharedPreferences")
            OopsFeeWidgetProvider.requestUpdate(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set widget data: \${e.message}")
            promise.reject("WIDGET_ERROR", "Failed to set widget data", e)
        }
    }

    @ReactMethod
    fun reloadAllTimelines() {
        Log.d(TAG, "reloadAllTimelines called")
        OopsFeeWidgetProvider.requestUpdate(reactApplicationContext)
    }

    @ReactMethod
    fun clearWidgetData(promise: Promise) {
        try {
            Log.d(TAG, "clearWidgetData called")
            val prefs = reactApplicationContext.getSharedPreferences(WidgetConstants.PREFS_NAME, android.content.Context.MODE_PRIVATE)
            prefs.edit().remove(WidgetConstants.WIDGET_DATA_KEY).apply()
            OopsFeeWidgetProvider.requestUpdate(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear widget data: \${e.message}")
            promise.reject("WIDGET_ERROR", "Failed to clear widget data", e)
        }
    }
}
`;

const WIDGET_PACKAGE_KT = `package com.oopsfee.app.widget

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class WidgetPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(WidgetModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

// ============================================================================
// XML Layout Files
// ============================================================================

const WIDGET_EMPTY_XML = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#000000"
    android:gravity="center"
    android:orientation="vertical"
    android:padding="12dp">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="✓"
        android:textColor="#0B93F6"
        android:textSize="28sp"/>

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="8dp"
        android:text="No active promises"
        android:textColor="#B3FFFFFF"
        android:textSize="13sp"/>

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="4dp"
        android:text="Tap to make one"
        android:textColor="#73FFFFFF"
        android:textSize="11sp"/>

</LinearLayout>
`;

const WIDGET_SMALL_XML = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#000000"
    android:orientation="vertical"
    android:padding="12dp">

    <LinearLayout
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:gravity="center_vertical"
        android:orientation="horizontal">

        <ImageView
            android:id="@+id/urgency_indicator"
            android:layout_width="8dp"
            android:layout_height="8dp"
            android:src="@drawable/urgency_dot"
            android:contentDescription="Urgency"/>

        <TextView
            android:id="@+id/countdown_text"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginStart="6dp"
            android:fontFamily="sans-serif-medium"
            android:text="5h 30m"
            android:textColor="#FF6B35"
            android:textSize="15sp"
            android:textStyle="bold"/>

    </LinearLayout>

    <TextView
        android:id="@+id/promise_text"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:layout_marginTop="8dp"
        android:ellipsize="end"
        android:fontFamily="sans-serif-medium"
        android:maxLines="2"
        android:text="Go to the gym 3x this week"
        android:textColor="#FFFFFF"
        android:textSize="13sp"/>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:gravity="center_vertical"
        android:orientation="horizontal">

        <TextView
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:fontFamily="sans-serif-medium"
            android:text="At stake"
            android:textColor="#73FFFFFF"
            android:textSize="11sp"/>

        <TextView
            android:id="@+id/stake_amount"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:fontFamily="sans-serif-medium"
            android:text="$75"
            android:textColor="#00D632"
            android:textSize="17sp"
            android:textStyle="bold"/>

    </LinearLayout>

</LinearLayout>
`;

const WIDGET_MEDIUM_XML = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#000000"
    android:orientation="horizontal"
    android:padding="14dp">

    <LinearLayout
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1"
        android:orientation="vertical">

        <LinearLayout
            android:id="@+id/promise_row_1"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal">

            <ImageView
                android:id="@+id/urgency_bar_1"
                android:layout_width="3dp"
                android:layout_height="32dp"
                android:src="@drawable/urgency_bar"
                android:contentDescription="Urgency"/>

            <LinearLayout
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:layout_marginStart="8dp"
                android:orientation="vertical">

                <TextView
                    android:id="@+id/promise_text_1"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:ellipsize="end"
                    android:fontFamily="sans-serif-medium"
                    android:maxLines="1"
                    android:text="Go to the gym 3x this week"
                    android:textColor="#FFFFFF"
                    android:textSize="13sp"/>

                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="2dp"
                    android:orientation="horizontal">

                    <TextView
                        android:id="@+id/countdown_1"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:fontFamily="sans-serif-medium"
                        android:text="5h 30m"
                        android:textColor="#FF6B35"
                        android:textSize="12sp"
                        android:textStyle="bold"/>

                    <TextView
                        android:id="@+id/stake_1"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:layout_marginStart="8dp"
                        android:fontFamily="sans-serif"
                        android:text="$25"
                        android:textColor="#00D632"
                        android:textSize="12sp"
                        android:textStyle="bold"/>

                </LinearLayout>

            </LinearLayout>

        </LinearLayout>

        <LinearLayout
            android:id="@+id/promise_row_2"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="8dp"
            android:orientation="horizontal"
            android:visibility="gone">

            <ImageView
                android:id="@+id/urgency_bar_2"
                android:layout_width="3dp"
                android:layout_height="32dp"
                android:src="@drawable/urgency_bar"
                android:contentDescription="Urgency"/>

            <LinearLayout
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:layout_marginStart="8dp"
                android:orientation="vertical">

                <TextView
                    android:id="@+id/promise_text_2"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:ellipsize="end"
                    android:fontFamily="sans-serif-medium"
                    android:maxLines="1"
                    android:text="Finish the project report"
                    android:textColor="#FFFFFF"
                    android:textSize="13sp"/>

                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="2dp"
                    android:orientation="horizontal">

                    <TextView
                        android:id="@+id/countdown_2"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:fontFamily="sans-serif-medium"
                        android:text="2d 5h"
                        android:textColor="#FF9F0A"
                        android:textSize="12sp"
                        android:textStyle="bold"/>

                    <TextView
                        android:id="@+id/stake_2"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:layout_marginStart="8dp"
                        android:fontFamily="sans-serif"
                        android:text="$50"
                        android:textColor="#00D632"
                        android:textSize="12sp"
                        android:textStyle="bold"/>

                </LinearLayout>

            </LinearLayout>

        </LinearLayout>

    </LinearLayout>

    <LinearLayout
        android:layout_width="90dp"
        android:layout_height="match_parent"
        android:gravity="end"
        android:orientation="vertical">

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:fontFamily="sans-serif-medium"
            android:letterSpacing="0.05"
            android:text="TOTAL AT STAKE"
            android:textColor="#4DFFFFFF"
            android:textSize="9sp"
            android:textStyle="bold"/>

        <TextView
            android:id="@+id/total_stake"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:fontFamily="sans-serif-medium"
            android:text="$75"
            android:textColor="#00D632"
            android:textSize="28sp"
            android:textStyle="bold"/>

        <FrameLayout
            android:layout_width="0dp"
            android:layout_height="0dp"
            android:layout_weight="1"/>

        <TextView
            android:id="@+id/active_count"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:fontFamily="sans-serif-medium"
            android:text="2 active"
            android:textColor="#73FFFFFF"
            android:textSize="11sp"/>

    </LinearLayout>

</LinearLayout>
`;

const URGENCY_DOT_XML = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="oval">
    <solid android:color="#FFFFFF"/>
    <size
        android:width="8dp"
        android:height="8dp"/>
</shape>
`;

const URGENCY_BAR_XML = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#FFFFFF"/>
    <corners android:radius="2dp"/>
    <size
        android:width="3dp"
        android:height="32dp"/>
</shape>
`;

const WIDGET_INFO_XML = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="110dp"
    android:minHeight="110dp"
    android:minResizeWidth="110dp"
    android:minResizeHeight="110dp"
    android:targetCellWidth="2"
    android:targetCellHeight="2"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:initialLayout="@layout/widget_empty"
    android:description="@string/widget_description"
    android:previewLayout="@layout/widget_small"
    android:updatePeriodMillis="1800000">
</appwidget-provider>
`;

// ============================================================================
// Plugin Implementation
// ============================================================================

const withAndroidWidget = (config) => {
  // Add widget files to android folder
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidPath = path.join(projectRoot, 'android');
      const mainPath = path.join(androidPath, 'app', 'src', 'main');
      const packagePath = path.join(mainPath, 'java', 'com', 'oopsfee', 'app');
      const widgetPath = path.join(packagePath, 'widget');
      const resPath = path.join(mainPath, 'res');
      const layoutPath = path.join(resPath, 'layout');
      const drawablePath = path.join(resPath, 'drawable');
      const xmlPath = path.join(resPath, 'xml');
      const valuesPath = path.join(resPath, 'values');

      // Create directories
      [widgetPath, layoutPath, xmlPath].forEach((dir) => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });

      // Write Kotlin files
      fs.writeFileSync(path.join(widgetPath, 'WidgetModels.kt'), WIDGET_MODELS_KT);
      fs.writeFileSync(path.join(widgetPath, 'WidgetTheme.kt'), WIDGET_THEME_KT);
      fs.writeFileSync(path.join(widgetPath, 'OopsFeeWidgetProvider.kt'), WIDGET_PROVIDER_KT);
      fs.writeFileSync(path.join(widgetPath, 'WidgetModule.kt'), WIDGET_MODULE_KT);
      fs.writeFileSync(path.join(widgetPath, 'WidgetPackage.kt'), WIDGET_PACKAGE_KT);

      // Write layout files
      fs.writeFileSync(path.join(layoutPath, 'widget_empty.xml'), WIDGET_EMPTY_XML);
      fs.writeFileSync(path.join(layoutPath, 'widget_small.xml'), WIDGET_SMALL_XML);
      fs.writeFileSync(path.join(layoutPath, 'widget_medium.xml'), WIDGET_MEDIUM_XML);

      // Write drawable files
      fs.writeFileSync(path.join(drawablePath, 'urgency_dot.xml'), URGENCY_DOT_XML);
      fs.writeFileSync(path.join(drawablePath, 'urgency_bar.xml'), URGENCY_BAR_XML);

      // Write widget info
      fs.writeFileSync(path.join(xmlPath, 'widget_info.xml'), WIDGET_INFO_XML);

      // Update strings.xml to add widget strings
      const stringsPath = path.join(valuesPath, 'strings.xml');
      if (fs.existsSync(stringsPath)) {
        let stringsContent = fs.readFileSync(stringsPath, 'utf8');
        if (!stringsContent.includes('widget_description')) {
          stringsContent = stringsContent.replace(
            '</resources>',
            '  <string name="widget_description">Track your promises and stakes at a glance.</string>\n  <string name="widget_name">OopsFee</string>\n</resources>'
          );
          fs.writeFileSync(stringsPath, stringsContent);
        }
      }

      // Update MainApplication.kt to register WidgetPackage
      const mainAppPath = path.join(packagePath, 'MainApplication.kt');
      if (fs.existsSync(mainAppPath)) {
        let mainAppContent = fs.readFileSync(mainAppPath, 'utf8');

        // Add import if not present
        if (!mainAppContent.includes('import com.oopsfee.app.widget.WidgetPackage')) {
          mainAppContent = mainAppContent.replace(
            'import expo.modules.ReactNativeHostWrapper',
            'import expo.modules.ReactNativeHostWrapper\n\nimport com.oopsfee.app.widget.WidgetPackage'
          );
        }

        // Add package registration if not present
        if (!mainAppContent.includes('add(WidgetPackage())')) {
          mainAppContent = mainAppContent.replace(
            '// add(MyReactNativePackage())',
            '// add(MyReactNativePackage())\n              add(WidgetPackage())'
          );
        }

        fs.writeFileSync(mainAppPath, mainAppContent);
      }

      console.log('[withAndroidWidget] Added Android widget files');

      return config;
    },
  ]);

  // Add widget receiver to AndroidManifest
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];

    if (!application) {
      console.warn('[withAndroidWidget] Could not find application in AndroidManifest');
      return config;
    }

    // Check if receiver already exists
    const receivers = application.receiver || [];
    const hasWidgetReceiver = receivers.some(
      (r) => r.$?.['android:name'] === '.widget.OopsFeeWidgetProvider'
    );

    if (!hasWidgetReceiver) {
      application.receiver = [
        ...receivers,
        {
          $: {
            'android:name': '.widget.OopsFeeWidgetProvider',
            'android:exported': 'true',
            'android:label': '@string/widget_name',
          },
          'intent-filter': [
            {
              action: [
                {
                  $: {
                    'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
                  },
                },
              ],
            },
          ],
          'meta-data': [
            {
              $: {
                'android:name': 'android.appwidget.provider',
                'android:resource': '@xml/widget_info',
              },
            },
          ],
        },
      ];
      console.log('[withAndroidWidget] Added widget receiver to AndroidManifest');
    }

    return config;
  });

  return config;
};

module.exports = withAndroidWidget;

