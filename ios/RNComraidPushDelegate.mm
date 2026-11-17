#import "RNComraidPushDelegate.h"

#if __has_include(<ReactNativeComraid/ReactNativeComraid-Swift.h>)
#import <ReactNativeComraid/ReactNativeComraid-Swift.h>
#elif __has_include("ReactNativeComraid-Swift.h")
#import "ReactNativeComraid-Swift.h"
#endif

@implementation RNComraidPushDelegate {
  id<UNUserNotificationCenterDelegate> _previousDelegate;
}

+ (instancetype)shared
{
  static RNComraidPushDelegate *sharedInstance;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    sharedInstance = [[RNComraidPushDelegate alloc] init];
  });
  return sharedInstance;
}

+ (void)install
{
  RNComraidPushDelegate *delegate = [RNComraidPushDelegate shared];
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  if (center.delegate == delegate) {
    return;
  }
  delegate->_previousDelegate = center.delegate;
  center.delegate = delegate;
}

+ (void)setDeviceToken:(NSData *)deviceToken
{
  if (deviceToken.length == 0) {
    return;
  }
#if __has_include(<ReactNativeComraid/ReactNativeComraid-Swift.h>) || __has_include("ReactNativeComraid-Swift.h")
  [RNComraidComRaidCaller setAPNsDeviceToken:deviceToken];
#else
  (void)deviceToken;
#endif
}

+ (void)handleRemoteNotification:(NSDictionary *)userInfo
          fetchCompletionHandler:(void (^)(UIBackgroundFetchResult result))completionHandler
{
  if (userInfo.count == 0) {
    if (completionHandler) {
      completionHandler(UIBackgroundFetchResultNoData);
    }
    return;
  }
#if __has_include(<ReactNativeComraid/ReactNativeComraid-Swift.h>) || __has_include("ReactNativeComraid-Swift.h")
  [RNComraidComRaidCaller handleRemoteNotification:userInfo
                                   fetchCompletion:^(UIBackgroundFetchResult result) {
                                     if (completionHandler) {
                                       completionHandler(result);
                                     }
                                   }];
#else
  if (completionHandler) {
    completionHandler(UIBackgroundFetchResultNoData);
  }
#endif
}

#pragma mark - UNUserNotificationCenterDelegate

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions options))completionHandler
{
  NSDictionary *userInfo = notification.request.content.userInfo;
#if __has_include(<ReactNativeComraid/ReactNativeComraid-Swift.h>) || __has_include("ReactNativeComraid-Swift.h")
  [RNComraidComRaidCaller handleRemoteNotification:userInfo];
#endif

  id<UNUserNotificationCenterDelegate> previous = _previousDelegate;
  if ([previous respondsToSelector:@selector(userNotificationCenter:willPresentNotification:withCompletionHandler:)]) {
    [previous userNotificationCenter:center
             willPresentNotification:notification
               withCompletionHandler:completionHandler];
    return;
  }

#if __has_include(<ReactNativeComraid/ReactNativeComraid-Swift.h>) || __has_include("ReactNativeComraid-Swift.h")
  [RNComraidComRaidCaller presentationOptionsForUserInfo:userInfo
                                              completion:^(NSUInteger raw) {
                                                completionHandler((UNNotificationPresentationOptions)raw);
                                              }];
#else
  completionHandler(UNNotificationPresentationOptionNone);
#endif
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler
{
#if __has_include(<ReactNativeComraid/ReactNativeComraid-Swift.h>) || __has_include("ReactNativeComraid-Swift.h")
  [RNComraidComRaidCaller handleNotificationResponse:response];
#endif

  id<UNUserNotificationCenterDelegate> previous = _previousDelegate;
  if ([previous respondsToSelector:@selector(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:)]) {
    [previous userNotificationCenter:center
      didReceiveNotificationResponse:response
               withCompletionHandler:completionHandler];
    return;
  }

  completionHandler();
}

@end
