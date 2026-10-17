package com.comraide.reactnative

import android.Manifest
import android.os.Build
import android.content.pm.PackageManager
import com.comraide.android.Comraid
import com.comraide.android.ComraidConfiguration
import com.comraide.android.ComraidNotification
import com.comraide.android.ComraidScheduleRequest
import com.comraide.android.FallbackPolicy
import com.comraide.android.SchedulePrecision
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import org.json.JSONObject

class ComraidModule(private val reactContext: ReactApplicationContext) :
  NativeComraidSpec(reactContext), PermissionListener {

  private var permissionPromise: Promise? = null

  override fun configure(
    defaultChannelId: String,
    defaultChannelName: String,
    smallIconResourceName: String,
    storageSuiteName: String,
    promise: Promise,
  ) = resolve(promise) {
    val metadata = reactContext.packageManager.getApplicationInfo(
      reactContext.packageName,
      PackageManager.GET_META_DATA,
    ).metaData
    val channelId = defaultChannelId.ifBlank {
      metadata?.getString(META_CHANNEL_ID) ?: "comraid.general"
    }
    val channelName = defaultChannelName.ifBlank {
      metadata?.getString(META_CHANNEL_NAME) ?: "General"
    }
    val iconName = smallIconResourceName.ifBlank {
      metadata?.getString(META_SMALL_ICON) ?: "ic_launcher"
    }
    val icon = reactContext.resources.getIdentifier(iconName, "drawable", reactContext.packageName)
      .takeIf { it != 0 }
      ?: reactContext.resources.getIdentifier(iconName, "mipmap", reactContext.packageName)
    require(icon != 0) { "Android notification icon '$iconName' was not found" }
    Comraid.configure(
      reactContext,
      ComraidConfiguration(
        defaultChannelId = channelId,
        defaultChannelName = channelName,
        smallIconResourceId = icon,
      ),
    )
    null
  }

  override fun getCapabilities(promise: Promise) = resolve(promise) {
    val value = Comraid.capabilities(reactContext)
    Arguments.createMap().apply {
      putString("platform", "android")
      putBoolean("notificationsEnabled", value.notificationsEnabled)
      putString("authorizationStatus", if (value.notificationsEnabled) "authorized" else "denied")
      putBoolean("exactAlarmsAvailable", value.exactAlarmsAvailable)
    }
  }

  override fun requestNotificationPermission(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      promise.resolve(true)
      return
    }
    val activity = reactContext.getCurrentActivity() as? PermissionAwareActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "A foreground Activity is required to request notification permission")
      return
    }
    if (permissionPromise != null) {
      promise.reject("REQUEST_IN_PROGRESS", "A notification permission request is already in progress")
      return
    }
    permissionPromise = promise
    activity.requestPermissions(
      arrayOf(Manifest.permission.POST_NOTIFICATIONS),
      PERMISSION_REQUEST_CODE,
      this,
    )
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<String>,
    grantResults: IntArray,
  ): Boolean {
    if (requestCode != PERMISSION_REQUEST_CODE) return false
    val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
    permissionPromise?.resolve(granted)
    permissionPromise = null
    return true
  }

  override fun schedule(
    id: String,
    title: String,
    body: String,
    triggerAtMillis: Double,
    precision: String,
    fallbackPolicy: String,
    dataJson: String,
    promise: Promise,
  ) = resolve(promise) {
    scheduleResult(
      Comraid.schedule(
        ComraidScheduleRequest(
          notification = notification(id, title, body, dataJson),
          triggerAtMillis = triggerAtMillis.toLong(),
          precision = precision(precision),
          fallbackPolicy = fallback(fallbackPolicy),
        )
      )
    )
  }

  override fun startTimer(
    id: String,
    title: String,
    body: String,
    durationMillis: Double,
    precision: String,
    fallbackPolicy: String,
    dataJson: String,
    promise: Promise,
  ) = resolve(promise) {
    scheduleResult(
      Comraid.startTimer(
        notification = notification(id, title, body, dataJson),
        durationMillis = durationMillis.toLong(),
        precision = precision(precision),
        fallbackPolicy = fallback(fallbackPolicy),
      )
    )
  }

  override fun cancel(id: String, promise: Promise) = resolve(promise) {
    Comraid.cancel(id)
    null
  }

  override fun pendingSchedules(promise: Promise) = resolve(promise) {
    Arguments.createArray().apply {
      Comraid.pendingSchedules().forEach { request ->
        pushMap(Arguments.createMap().apply {
          putString("id", request.notification.id)
          putString("title", request.notification.title)
          putString("body", request.notification.body)
          putDouble("triggerAtMillis", request.triggerAtMillis.toDouble())
        })
      }
    }
  }

  private fun notification(id: String, title: String, body: String, dataJson: String): ComraidNotification {
    val json = JSONObject(dataJson)
    val data = buildMap {
      json.keys().forEach { key -> put(key, json.getString(key)) }
    }
    return ComraidNotification(id = id, title = title, body = body, data = data)
  }

  private fun precision(value: String) = when (value) {
    "exact" -> SchedulePrecision.EXACT
    "inexact" -> SchedulePrecision.INEXACT
    else -> error("Unsupported precision '$value'")
  }

  private fun fallback(value: String) = when (value) {
    "fail" -> FallbackPolicy.FAIL
    "useInexact" -> FallbackPolicy.USE_INEXACT
    else -> error("Unsupported fallback policy '$value'")
  }

  private fun scheduleResult(value: com.comraide.android.ComraidScheduleResult) = Arguments.createMap().apply {
    putString("id", value.id)
    putString("requestedPrecision", value.requestedPrecision.name.lowercase())
    putString("appliedPrecision", value.appliedPrecision.name.lowercase())
    putDouble("triggerAtMillis", value.triggerAtMillis.toDouble())
    putString("fallbackReason", value.fallbackReason ?: "")
  }

  private inline fun resolve(promise: Promise, block: () -> Any?) {
    try {
      promise.resolve(block())
    } catch (error: Throwable) {
      promise.reject("COMRAID_ERROR", error.message, error)
    }
  }

  companion object {
    const val NAME = NativeComraidSpec.NAME
    private const val META_CHANNEL_ID = "com.comraide.DEFAULT_CHANNEL_ID"
    private const val META_CHANNEL_NAME = "com.comraide.DEFAULT_CHANNEL_NAME"
    private const val META_SMALL_ICON = "com.comraide.SMALL_ICON_RESOURCE"
    private const val PERMISSION_REQUEST_CODE = 43_117
  }
}
