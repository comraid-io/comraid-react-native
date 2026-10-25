#import "RNComraid.h"
@import ComRaid;

static NSDictionary *RNComraidData(NSString *json, NSError **error)
{
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  id value = [NSJSONSerialization JSONObjectWithData:data options:0 error:error];
  if (![value isKindOfClass:[NSDictionary class]]) {
    if (error && !*error) {
      *error = [NSError errorWithDomain:@"Comraid"
                                   code:2001
                               userInfo:@{NSLocalizedDescriptionKey: @"Notification data must encode a JSON object"}];
    }
    return nil;
  }
  return value;
}

static void RNComraidReject(NSError *error, RCTPromiseRejectBlock reject)
{
  NSString *code = error.domain.length > 0 ? error.domain : @"COMRAID_ERROR";
  reject(code, error.localizedDescription, error);
}

@implementation RNComraid

RCT_EXPORT_MODULE(Comraid)

- (void)configure:(NSString *)appId
      apiBaseURL:(NSString *)apiBaseURL
 apnsEnvironment:(NSString *)apnsEnvironment
defaultChannelId:(NSString *)defaultChannelId
defaultChannelName:(NSString *)defaultChannelName
smallIconResourceName:(NSString *)smallIconResourceName
 storageSuiteName:(NSString *)storageSuiteName
displayForegroundNotifications:(BOOL)displayForegroundNotifications
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  (void)displayForegroundNotifications;
  if (appId.length == 0) {
    reject(@"COMRAID_ERROR", @"appId is required (cr_app_…)", nil);
    return;
  }
  if (apnsEnvironment.length == 0) {
    reject(@"COMRAID_ERROR", @"ios.apnsEnvironment is required (sandbox or production)", nil);
    return;
  }
  NSString *suite = storageSuiteName.length > 0 ? storageSuiteName : nil;
  NSString *base = apiBaseURL.length > 0 ? apiBaseURL : nil;
  [[ComraidBridge shared] configureWithAppId:appId
                                  apiBaseURL:base
                             apnsEnvironment:apnsEnvironment
                            storageSuiteName:suite
                                  completion:^(NSError *error) {
    if (error) {
      RNComraidReject(error, reject);
    } else {
      resolve(nil);
    }
  }];
}

- (void)getCapabilities:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  [[ComraidBridge shared] capabilitiesWithCompletion:^(NSDictionary *value, NSError *error) {
    if (error) {
      RNComraidReject(error, reject);
    } else {
      resolve(value);
    }
  }];
}

- (void)requestNotificationPermission:(RCTPromiseResolveBlock)resolve
                                reject:(RCTPromiseRejectBlock)reject
{
  [[ComraidBridge shared] requestNotificationPermissionWithCompletion:^(BOOL granted, NSError *error) {
    if (error) {
      RNComraidReject(error, reject);
    } else {
      resolve(@(granted));
    }
  }];
}

- (void)register:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject
{
  [[ComraidBridge shared] registerWithCompletion:^(NSError *error) {
    if (error) {
      RNComraidReject(error, reject);
    } else {
      resolve(nil);
    }
  }];
}

- (void)login:(NSString *)externalUserId
          jwt:(NSString *)jwt
      resolve:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject
{
  NSString *token = jwt.length > 0 ? jwt : nil;
  [[ComraidBridge shared] loginWithExternalUserId:externalUserId
                                              jwt:token
                                       completion:^(NSError *error) {
    if (error) {
      RNComraidReject(error, reject);
    } else {
      resolve(nil);
    }
  }];
}

- (void)logout:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [[ComraidBridge shared] logoutWithCompletion:^(NSError *error) {
    if (error) {
      RNComraidReject(error, reject);
    } else {
      resolve(nil);
    }
  }];
}

- (void)optIn:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject
{
  [[ComraidBridge shared] optInWithCompletion:^(NSError *error) {
    if (error) {
      RNComraidReject(error, reject);
    } else {
      resolve(nil);
    }
  }];
}

- (void)optOut:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [[ComraidBridge shared] optOutWithCompletion:^(NSError *error) {
    if (error) {
      RNComraidReject(error, reject);
    } else {
      resolve(nil);
    }
  }];
}

- (void)setDeviceProperties:(NSString *)appVersion
                      model:(NSString *)model
                  osVersion:(NSString *)osVersion
                 extrasJson:(NSString *)extrasJson
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  reject(@"COMRAID_UNSUPPORTED",
         @"setDeviceProperties requires the iOS ComRaid SDK attribute APIs (T18)",
         nil);
}

- (void)setAttributes:(NSString *)attributesJson
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  NSError *parseError = nil;
  NSDictionary *attributes = RNComraidData(attributesJson, &parseError);
  if (parseError) {
    RNComraidReject(parseError, reject);
    return;
  }
  [[ComraidBridge shared] setAttributes:attributes
                             completion:^(NSError *error) {
    if (error) {
      RNComraidReject(error, reject);
    } else {
      resolve(nil);
    }
  }];
}

- (void)acknowledgeDelivered:(NSString *)deliveryId
           attributionToken:(NSString *)attributionToken
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  [[ComraidBridge shared] acknowledgeDeliveredWithDeliveryId:deliveryId
                                           attributionToken:attributionToken
                                                 completion:^(BOOL ok, NSError *error) {
    if (error) {
      RNComraidReject(error, reject);
    } else {
      resolve(@(ok));
    }
  }];
}

- (void)acknowledgeOpened:(NSString *)deliveryId
        attributionToken:(NSString *)attributionToken
                actionId:(NSString *)actionId
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  NSString *action = actionId.length > 0 ? actionId : nil;
  [[ComraidBridge shared] acknowledgeOpenedWithDeliveryId:deliveryId
                                        attributionToken:attributionToken
                                                actionId:action
                                              completion:^(BOOL ok, NSError *error) {
    if (error) {
      RNComraidReject(error, reject);
    } else {
      resolve(@(ok));
    }
  }];
}

- (void)flushAcks:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  [[ComraidBridge shared] flushAcksWithCompletion:^(NSError *error) {
    if (error) {
      RNComraidReject(error, reject);
    } else {
      resolve(nil);
    }
  }];
}
- (void)schedule:(NSString *)id
           title:(NSString *)title
            body:(NSString *)body
 triggerAtMillis:(double)triggerAtMillis
       precision:(NSString *)precision
  fallbackPolicy:(NSString *)fallbackPolicy
        dataJson:(NSString *)dataJson
         resolve:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject
{
  NSError *parseError = nil;
  NSDictionary *userInfo = RNComraidData(dataJson, &parseError);
  if (parseError) {
    RNComraidReject(parseError, reject);
    return;
  }
  [[ComraidBridge shared] scheduleWithId:id
                                   title:title
                                    body:body
                         triggerAtMillis:triggerAtMillis
                      requestedPrecision:precision
                          fallbackPolicy:fallbackPolicy
                                userInfo:userInfo
                              completion:^(NSDictionary *value, NSError *error) {
    if (error) {
      RNComraidReject(error, reject);
    } else {
      resolve(value);
    }
  }];
}

- (void)startTimer:(NSString *)id
             title:(NSString *)title
              body:(NSString *)body
    durationMillis:(double)durationMillis
         precision:(NSString *)precision
    fallbackPolicy:(NSString *)fallbackPolicy
          dataJson:(NSString *)dataJson
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  NSError *parseError = nil;
  NSDictionary *userInfo = RNComraidData(dataJson, &parseError);
  if (parseError) {
    RNComraidReject(parseError, reject);
    return;
  }
  [[ComraidBridge shared] startTimerWithId:id
                                     title:title
                                      body:body
                            durationMillis:durationMillis
                        requestedPrecision:precision
                            fallbackPolicy:fallbackPolicy
                                  userInfo:userInfo
                                completion:^(NSDictionary *value, NSError *error) {
    if (error) {
      RNComraidReject(error, reject);
    } else {
      resolve(value);
    }
  }];
}

- (void)cancel:(NSString *)id
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [[ComraidBridge shared] cancelWithId:id completion:^(NSError *error) {
    if (error) {
      RNComraidReject(error, reject);
    } else {
      resolve(nil);
    }
  }];
}

- (void)pendingSchedules:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [[ComraidBridge shared] pendingSchedulesWithCompletion:^(NSArray *value, NSError *error) {
    if (error) {
      RNComraidReject(error, reject);
    } else {
      resolve(value);
    }
  }];
}

- (void)getToken:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject
{
  reject(@"COMRAID_UNSUPPORTED",
         @"getToken event bridging lands in ticket 04 (iOS)",
         nil);
}

- (void)getInitialNotification:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  resolve((id)kCFNull);
}

- (void)presentNotification:(NSString *)messageJson
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  (void)messageJson;
  reject(@"COMRAID_UNSUPPORTED",
         @"presentNotification lands in ticket 04 (iOS)",
         nil);
}

- (void)setBackgroundHandlerRegistered:(BOOL)registered
                               resolve:(RCTPromiseResolveBlock)resolve
                                reject:(RCTPromiseRejectBlock)reject
{
  (void)registered;
  resolve(nil);
}

- (void)addListener:(NSString *)eventName
{
  (void)eventName;
}

- (void)removeListeners:(double)count
{
  (void)count;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeComraidSpecJSI>(params);
}

@end
