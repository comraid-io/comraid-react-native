package com.comraid.reactnative

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.comraid.android.ComRaid
import com.comraid.android.ComRaidConfiguration
import com.comraid.android.ComRaidNotification
import com.comraid.android.ComRaidScheduleRequest
import com.comraid.android.DeviceProperties
import com.comraid.android.FallbackPolicy
import com.comraid.android.RemoteMessageAction
import com.comraid.android.RemoteMessageEvent
import com.comraid.android.RemoteMessageListener
import com.comraid.android.SchedulePrecision
import com.comraid.android.TokenRefreshListener
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import org.json.JSONArray
import org.json.JSONObject

class ComraidModule(private val reactContext: ReactApplicationContext) :
  NativeComraidSpec(reactContext), PermissionListener, ActivityEventListener {

  private var permissionPromise: Promise? = null
  private var listenersAttached = false

  private val foregroundListener = RemoteMessageListener { event ->
    emit(EVENT_MESSAGE, remoteMessageMap(event))
  }
  private val backgroundListener = RemoteMessageListener { event ->
    emit(EVENT_BACKGROUND_MESSAGE, remoteMessageMap(event))
  }
  private val openedListener = RemoteMessageListener { event ->
    emit(EVENT_NOTIFICATION_OPENED, remoteMessageMap(event))
  }
  private val tokenListener = TokenRefreshListener { token ->
    emit(EVENT_TOKEN_REFRESH, Arguments.createMap().apply { putString("token", token) })
  }

  override fun initialize() {
    super.initialize()
    reactContext.addActivityEventListener(this)
    attachNativeListeners()
  }

  override fun invalidate() {
    reactContext.removeActivityEventListener(this)
    detachNativeListeners()
    super.invalidate()
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    // No-op: ActivityEventListener requires both methods.
  }

  override fun onNewIntent(intent: Intent) {
    // Warm system-tray opens: Activity may already be running (singleTop / singleTask).
    reactContext.currentActivity?.intent = intent
    ComRaid.consumeLaunchIntent(intent, coldStart = false)
  }

  override fun configure(
    appId: String,
    apiBaseURL: String,
    apnsEnvironment: String,
    defaultChannelId: String,
    defaultChannelName: String,
    smallIconResourceName: String,
    storageSuiteName: String,
    displayForegroundNotifications: Boolean,
    promise: Promise,
  ) = resolve(promise) {
    require(appId.isNotBlank()) { "appId is required (cr_app_…)" }
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
    ComRaid.configure(
      reactContext,
      ComRaidConfiguration(
        appId = appId.trim(),
        apiBaseUrl = apiBaseURL.ifBlank { ComRaidConfiguration.DEFAULT_API_BASE_URL },
        defaultChannelId = channelId,
        defaultChannelName = channelName,
        smallIconResourceId = icon,
        displayForegroundNotifications = displayForegroundNotifications,
      ),
    )
    attachNativeListeners()
    // Cold-start: consume launcher extras once configure has a context.
    reactContext.currentActivity?.intent?.let { intent ->
      ComRaid.consumeLaunchIntent(intent, coldStart = true)
    }
    null
  }

  override fun getCapabilities(promise: Promise) = resolve(promise) {
    val value = ComRaid.capabilities(reactContext)
    Arguments.createMap().apply {
      putString("platform", "android")
      putBoolean("notificationsEnabled", value.notificationsEnabled)
      putString("authorizationStatus", if (value.notificationsEnabled) "authorized" else "denied")
      putBoolean("exactAlarmsAvailable", value.exactAlarmsAvailable)
    }
  }

  override fun requestNotificationPermission(promise: Promise) {
    val notificationsEnabled = NotificationManagerCompat.from(reactContext).areNotificationsEnabled()
    val permissionGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      ContextCompat.checkSelfPermission(reactContext, Manifest.permission.POST_NOTIFICATIONS) ==
      PackageManager.PERMISSION_GRANTED

    if (permissionGranted && notificationsEnabled) {
      resolve(promise) {
        ComRaid.register()
        true
      }
      return
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      promise.resolve(false)
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

  override fun register(promise: Promise) = resolve(promise) {
    ComRaid.register()
    null
  }

  override fun login(externalUserId: String, jwt: String, promise: Promise) = resolve(promise) {
    ComRaid.login(
      externalUserId,
      jwt = jwt.takeIf { it.isNotBlank() },
    )
    null
  }

  override fun logout(promise: Promise) = resolve(promise) {
    ComRaid.logout()
    null
  }

  override fun optIn(promise: Promise) = resolve(promise) {
    ComRaid.optIn()
    null
  }

  override fun optOut(promise: Promise) = resolve(promise) {
    ComRaid.optOut()
    null
  }

  override fun setDeviceProperties(
    appVersion: String,
    model: String,
    osVersion: String,
    extrasJson: String,
    promise: Promise,
  ) = resolve(promise) {
    ComRaid.setDeviceProperties(
      DeviceProperties(
        appVersion = appVersion.takeIf { it.isNotBlank() },
        model = model.takeIf { it.isNotBlank() },
        osVersion = osVersion.takeIf { it.isNotBlank() },
        extras = jsonObjectToMap(JSONObject(extrasJson.ifBlank { "{}" })),
      ),
    )
    null
  }

  override fun setAttributes(attributesJson: String, promise: Promise) = resolve(promise) {
    val json = JSONObject(attributesJson)
    ComRaid.setAttributes(jsonObjectToMap(json))
    null
  }

  override fun acknowledgeDelivered(
    deliveryId: String,
    attributionToken: String,
    promise: Promise,
  ) = resolve(promise) {
    ComRaid.acknowledgeDelivered(deliveryId, attributionToken)
  }

  override fun acknowledgeOpened(
    deliveryId: String,
    attributionToken: String,
    actionId: String,
    promise: Promise,
  ) = resolve(promise) {
    ComRaid.acknowledgeOpened(
      deliveryId,
      attributionToken,
      actionId = actionId.takeIf { it.isNotBlank() },
    )
  }

  override fun flushAcks(promise: Promise) = resolve(promise) {
    ComRaid.flushAcks()
    null
  }

  override fun getToken(promise: Promise) = resolve(promise) {
    ComRaid.getToken()
  }

  override fun getInitialNotification(promise: Promise) = resolve(promise) {
    ComRaid.getInitialNotification()?.let { remoteMessageMap(it) }
  }

  override fun presentNotification(messageJson: String, promise: Promise) = resolve(promise) {
    ComRaid.presentNotification(parseRemoteMessage(messageJson))
    null
  }

  override fun setBackgroundHandlerRegistered(registered: Boolean, promise: Promise) = resolve(promise) {
    ComRaid.setBackgroundHandlerRegistered(registered)
    null
  }

  override fun addListener(eventName: String) {
    // Required for NativeEventEmitter; events are pushed via RCTDeviceEventEmitter.
  }

  override fun removeListeners(count: Double) {
    // Required for NativeEventEmitter.
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<String>,
    grantResults: IntArray,
  ): Boolean {
    if (requestCode != PERMISSION_REQUEST_CODE) return false
    val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
    val promise = permissionPromise
    permissionPromise = null
    if (granted && NotificationManagerCompat.from(reactContext).areNotificationsEnabled()) {
      try {
        ComRaid.register()
        promise?.resolve(true)
      } catch (error: Throwable) {
        promise?.reject("COMRAID_ERROR", error.message, error)
      }
    } else {
      promise?.resolve(false)
    }
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
      ComRaid.schedule(
        ComRaidScheduleRequest(
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
      ComRaid.startTimer(
        notification = notification(id, title, body, dataJson),
        durationMillis = durationMillis.toLong(),
        precision = precision(precision),
        fallbackPolicy = fallback(fallbackPolicy),
      )
    )
  }

  override fun cancel(id: String, promise: Promise) = resolve(promise) {
    ComRaid.cancel(id)
    null
  }

  override fun pendingSchedules(promise: Promise) = resolve(promise) {
    Arguments.createArray().apply {
      ComRaid.pendingSchedules().forEach { request ->
        pushMap(Arguments.createMap().apply {
          putString("id", request.notification.id)
          putString("title", request.notification.title)
          putString("body", request.notification.body)
          putDouble("triggerAtMillis", request.triggerAtMillis.toDouble())
        })
      }
    }
  }

  private fun attachNativeListeners() {
    if (listenersAttached) return
    listenersAttached = true
    ComRaid.addForegroundMessageListener(foregroundListener)
    ComRaid.addBackgroundMessageListener(backgroundListener)
    ComRaid.addNotificationOpenedListener(openedListener)
    ComRaid.addTokenRefreshListener(tokenListener)
  }

  private fun detachNativeListeners() {
    if (!listenersAttached) return
    listenersAttached = false
    ComRaid.removeForegroundMessageListener(foregroundListener)
    ComRaid.removeBackgroundMessageListener(backgroundListener)
    ComRaid.removeNotificationOpenedListener(openedListener)
    ComRaid.removeTokenRefreshListener(tokenListener)
  }

  private fun emit(eventName: String, payload: WritableMap) {
    if (!reactContext.hasActiveReactInstance()) return
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, payload)
  }

  private fun remoteMessageMap(event: RemoteMessageEvent): WritableMap =
    Arguments.createMap().apply {
      event.messageId?.let { putString("messageId", it) }
      event.deliveryId?.let { putString("deliveryId", it) }
      event.attributionToken?.let { putString("attributionToken", it) }
      event.title?.let { putString("title", it) }
      event.body?.let { putString("body", it) }
      event.deepLink?.let { putString("deepLink", it) }
      event.actionId?.let { putString("actionId", it) }
      putMap(
        "data",
        Arguments.createMap().apply {
          event.data.forEach { (k, v) -> putString(k, v) }
        },
      )
      if (event.actions.isNotEmpty()) {
        putArray(
          "actions",
          Arguments.createArray().apply {
            event.actions.forEach { action ->
              pushMap(
                Arguments.createMap().apply {
                  putString("id", action.id)
                  putString("text", action.text)
                  action.icon?.let { putString("icon", it) }
                },
              )
            }
          },
        )
      }
    }

  private fun parseRemoteMessage(messageJson: String): RemoteMessageEvent {
    val json = JSONObject(messageJson)
    val dataJson = json.optJSONObject("data")
    val data = buildMap<String, String> {
      dataJson?.keys()?.forEach { key -> put(key, dataJson.optString(key)) }
    }
    val actionsJson = json.optJSONArray("actions")
    val actions = buildList {
      if (actionsJson != null) {
        for (i in 0 until actionsJson.length()) {
          val obj = actionsJson.optJSONObject(i) ?: continue
          val id = obj.optString("id").trim()
          val text = obj.optString("text").trim()
          if (id.isEmpty() || text.isEmpty()) continue
          add(
            RemoteMessageAction(
              id = id,
              text = text,
              icon = obj.optString("icon").trim().takeIf { it.isNotEmpty() },
            ),
          )
        }
      }
    }
    return RemoteMessageEvent(
      messageId = json.optString("messageId").takeIf { it.isNotBlank() },
      deliveryId = json.optString("deliveryId").takeIf { it.isNotBlank() },
      attributionToken = json.optString("attributionToken").takeIf { it.isNotBlank() },
      title = json.optString("title").takeIf { it.isNotBlank() },
      body = json.optString("body").takeIf { it.isNotBlank() },
      data = data,
      deepLink = json.optString("deepLink").takeIf { it.isNotBlank() },
      actions = actions,
      actionId = json.optString("actionId").takeIf { it.isNotBlank() },
    )
  }

  private fun notification(id: String, title: String, body: String, dataJson: String): ComRaidNotification {
    val json = JSONObject(dataJson)
    val data = buildMap {
      json.keys().forEach { key -> put(key, json.getString(key)) }
    }
    return ComRaidNotification(id = id, title = title, body = body, data = data)
  }

  private fun jsonObjectToMap(json: JSONObject): Map<String, Any?> = buildMap {
    json.keys().forEach { key ->
      put(key, jsonValue(json.get(key)))
    }
  }

  private fun jsonValue(value: Any?): Any? = when (value) {
    JSONObject.NULL, null -> null
    is JSONObject -> jsonObjectToMap(value)
    is JSONArray -> (0 until value.length()).map { jsonValue(value.get(it)) }
    else -> value
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

  private fun scheduleResult(value: com.comraid.android.ComRaidScheduleResult) = Arguments.createMap().apply {
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
    private const val META_CHANNEL_ID = "com.comraid.DEFAULT_CHANNEL_ID"
    private const val META_CHANNEL_NAME = "com.comraid.DEFAULT_CHANNEL_NAME"
    private const val META_SMALL_ICON = "com.comraid.SMALL_ICON_RESOURCE"
    private const val PERMISSION_REQUEST_CODE = 43_117
    private const val EVENT_MESSAGE = "comraid_message"
    private const val EVENT_BACKGROUND_MESSAGE = "comraid_background_message"
    private const val EVENT_NOTIFICATION_OPENED = "comraid_notification_opened"
    private const val EVENT_TOKEN_REFRESH = "comraid_token_refresh"
  }
}
