import ComRaid
import Foundation
import UserNotifications

/// ObjC-callable wrappers around async ComRaid APIs used by RNComraidPushDelegate.
@objc(RNComraidComRaidCaller)
public final class RNComraidComRaidCaller: NSObject {
  @objc public static func setAPNsDeviceToken(_ deviceToken: Data) {
    guard !deviceToken.isEmpty else { return }
    Task {
      await ComRaid.shared.setAPNsDeviceToken(deviceToken)
    }
  }

  @objc public static func handleRemoteNotification(_ userInfo: [AnyHashable: Any]) {
    Task {
      await ComRaid.shared.handleRemoteNotification(userInfo: userInfo)
    }
  }

  @objc public static func handleNotificationResponse(_ response: UNNotificationResponse) {
    Task {
      await ComRaid.shared.handleNotificationResponse(response)
    }
  }
}
