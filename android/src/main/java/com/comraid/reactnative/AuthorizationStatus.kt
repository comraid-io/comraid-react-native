package com.comraid.reactnative

/**
 * Maps Android notification permission state to the RN capabilities
 * `authorizationStatus` strings shared with iOS (`authorized` / `denied` / `notDetermined`).
 *
 * Pure inputs so the decision table can be unit-tested without a device.
 */
internal object AuthorizationStatus {
  const val AUTHORIZED = "authorized"
  const val DENIED = "denied"
  const val NOT_DETERMINED = "notDetermined"

  /** API level where POST_NOTIFICATIONS becomes a runtime permission (Android 13). */
  const val TIRAMISU = 33

  fun from(
    apiLevel: Int,
    postNotificationsGranted: Boolean,
    notificationsEnabled: Boolean,
    hasRequestedPermission: Boolean,
  ): String {
    if (postNotificationsGranted && notificationsEnabled) {
      return AUTHORIZED
    }
    if (
      apiLevel >= TIRAMISU &&
      !postNotificationsGranted &&
      !hasRequestedPermission
    ) {
      return NOT_DETERMINED
    }
    return DENIED
  }
}
