#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Installs APNs token forwarding and UNUserNotificationCenterDelegate wiring for
 * Expo / React Native hosts so AppDelegate does not need hand edits beyond what
 * the Expo config plugin injects (install + setDeviceToken + fetch handler).
 */
@interface RNComraidPushDelegate : NSObject <UNUserNotificationCenterDelegate>

+ (void)install;
+ (void)setDeviceToken:(NSData *)deviceToken;
+ (void)handleRemoteNotification:(NSDictionary *)userInfo
          fetchCompletionHandler:(void (^)(UIBackgroundFetchResult result))completionHandler;

@end

NS_ASSUME_NONNULL_END
