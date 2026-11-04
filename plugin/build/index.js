'use strict';

const fs = require('fs');
const path = require('path');

const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withAppBuildGradle,
  withAppDelegate,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} = require('@expo/config-plugins');

const {
  POST_NOTIFICATIONS,
  addFcmMessagingService,
  ensureBackgroundModes,
  ensureFirebaseMessagingDependency,
  ensureNotificationColorMeta,
  modifyAppDelegate,
} = require('./android-ios-helpers');
const {
  addEasAppExtension,
  addNotificationServicePodTarget,
  addNotificationServiceTarget,
  writeNotificationServiceFiles,
} = require('./notification-service-extension');

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

  if (ios.notificationServiceExtension === true) {
    config = withNotificationServiceExtension(config, ios);
  }

  return config;
}

/** Images and cold-device action buttons on iOS need a Notification Service Extension. */
function withNotificationServiceExtension(config, ios) {
  const bundleIdentifier = config.ios?.bundleIdentifier;
  if (!bundleIdentifier) {
    throw new Error(
      '@comraid/react-native: ios.notificationServiceExtension needs expo.ios.bundleIdentifier',
    );
  }
  const versions = {
    version: config.version ?? '1.0.0',
    buildNumber: config.ios?.buildNumber ?? '1',
  };
  config = addEasAppExtension(config, bundleIdentifier);
  config = withDangerousMod(config, [
    'ios',
    current => {
      const iosRoot = current.modRequest.platformProjectRoot;
      writeNotificationServiceFiles(iosRoot, versions);
      const podfilePath = path.join(iosRoot, 'Podfile');
      const podfile = fs.readFileSync(podfilePath, 'utf8');
      fs.writeFileSync(podfilePath, addNotificationServicePodTarget(podfile));
      return current;
    },
  ]);
  config = withXcodeProject(config, current => {
    addNotificationServiceTarget(current.modResults, {
      bundleIdentifier,
      developmentTeam: ios.appleTeamId ?? config.ios?.appleTeamId,
      ...versions,
    });
    return current;
  });
  return config;
}

module.exports = createRunOncePlugin(withComRaid, pkg.name, pkg.version);
module.exports.withComRaid = withComRaid;
