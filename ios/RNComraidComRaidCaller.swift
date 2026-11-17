import ComRaid
import Foundation
import UIKit
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
      await ComRaid.shared.handleRemoteNotification(userInfo: userInfo, appInForeground: true)
    }
  }

  /// Background `content-available` path: process then complete the fetch result.
  @objc public static func handleRemoteNotification(
    _ userInfo: [AnyHashable: Any],
    fetchCompletion: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    Task {
      await ComRaid.shared.handleRemoteNotification(userInfo: userInfo, appInForeground: false)
      fetchCompletion(.newData)
    }
  }

  /// Foreground presentation options from ComRaid display policy (data-only / FG opt-out → none).
  @objc public static func presentationOptions(
    forUserInfo userInfo: [AnyHashable: Any],
    completion: @escaping (UInt) -> Void
  ) {
    Task {
      let options = await ComRaid.shared.presentationOptions(for: userInfo)
      completion(options.rawValue)
    }
  }

  @objc public static func handleNotificationResponse(_ response: UNNotificationResponse) {
    Task {
      await ComRaid.shared.handleNotificationResponse(response)
    }
  }
}
