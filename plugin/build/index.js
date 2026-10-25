'use strict';

const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withAppBuildGradle,
  withAppDelegate,
  withEntitlementsPlist,
  withInfoPlist,
} = require('@expo/config-plugins');

const {
  POST_NOTIFICATIONS,
  addFcmMessagingService,
  ensureBackgroundModes,
  ensureFirebaseMessagingDependency,
  ensureNotificationColorMeta,
  modifyAppDelegate,
} = require('./android-ios-helpers');

const pkg = require('../../package.json');

function withComRaid(config, options = {}) {
  const android = options.android ?? {};
  const ios = options.ios ?? {};
  const includeMessagingService = android.includeMessagingService !== false;

  // Prefer plugin option, then Expo app config `android.googleServicesFile`.
  if (!config.android) {
    config.android = {};
  }
  if (android.googleServicesFile && !config.android.googleServicesFile) {
    config.android.googleServicesFile = android.googleServicesFile;
  }

  config = AndroidConfig.Permissions.withPermissions(config, [POST_NOTIFICATIONS]);

  if (config.android.googleServicesFile) {
    config = AndroidConfig.GoogleServices.withClassPath(config);
    config = AndroidConfig.GoogleServices.withApplyPlugin(config);
    config = AndroidConfig.GoogleServices.withGoogleServicesFile(config);
  }

  config = withAppBuildGradle(config, current => {
    if (current.modResults.language === 'groovy' || current.modResults.language === 'kt') {
      current.modResults.contents = ensureFirebaseMessagingDependency(
        current.modResults.contents,
      );
    }
    return current;
  });

  config = withAndroidManifest(config, current => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(current.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      'com.comraid.DEFAULT_CHANNEL_ID',
      android.defaultChannelId ?? 'comraid.general',
    );
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      'com.comraid.DEFAULT_CHANNEL_NAME',
      android.defaultChannelName ?? 'General',
    );
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      'com.comraid.SMALL_ICON_RESOURCE',
      android.smallIconResourceName ?? 'ic_launcher',
    );
    if (android.defaultNotificationColor || android.notificationColor) {
      ensureNotificationColorMeta(
        application,
        android.defaultNotificationColor ?? android.notificationColor,
      );
    }
    if (includeMessagingService) {
      addFcmMessagingService(application);
    }
    return current;
  });

  config = withInfoPlist(config, current => {
    ensureBackgroundModes(current.modResults);
    if (ios.storageSuiteName) {
      current.modResults.ComRaidStorageSuiteName = ios.storageSuiteName;
    }
    return current;
  });

  if (ios.apnsEnvironment === 'sandbox' || ios.apnsEnvironment === 'production') {
    config = withEntitlementsPlist(config, current => {
      current.modResults['aps-environment'] = ios.apnsEnvironment;
      return current;
    });
  }

  if (ios.wireAppDelegate !== false) {
    config = withAppDelegate(config, current => {
      current.modResults.contents = modifyAppDelegate(
        current.modResults.contents,
        current.modResults.language,
      );
      return current;
    });
  }

  return config;
}

module.exports = createRunOncePlugin(withComRaid, pkg.name, pkg.version);
module.exports.withComRaid = withComRaid;
