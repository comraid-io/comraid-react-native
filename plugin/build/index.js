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
  withProjectBuildGradle,
  withXcodeProject,
} = require('@expo/config-plugins');

const {
  POST_NOTIFICATIONS,
  addFcmMessagingService,
  ensureBackgroundModes,
  ensureFirebaseMessagingDependency,
  ensureMavenLocalRepository,
  ensureNotificationColorMeta,
  modifyAppDelegate,
} = require('./android-ios-helpers');
const {
  addEasAppExtension,
  addNotificationServicePodTarget,
  addNotificationServiceTarget,
  applyComraidPodPathOverride,
  ensureAppGroupEntitlement,
  writeNotificationServiceFiles,
} = require('./notification-service-extension');

const pkg = require('../../package.json');

function withComRaid(config, options = {}) {
  const android = options.android ?? {};
  const ios = options.ios ?? {};
  const includeMessagingService = android.includeMessagingService !== false;
  const iosComraidPath = typeof ios.comraidPath === 'string' ? ios.comraidPath.trim() : '';

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

  config = withProjectBuildGradle(config, current => {
    if (current.modResults.language === 'groovy' || current.modResults.language === 'kt') {
      current.modResults.contents = ensureMavenLocalRepository(current.modResults.contents);
    }
    return current;
  });

  if (iosComraidPath) {
    config = withDangerousMod(config, [
      'ios',
      current => {
        const podfilePath = path.join(current.modRequest.platformProjectRoot, 'Podfile');
        const podfile = fs.readFileSync(podfilePath, 'utf8');
        fs.writeFileSync(podfilePath, applyComraidPodPathOverride(podfile, iosComraidPath));
        return current;
      },
    ]);
  }

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

  if (ios.storageSuiteName) {
    config = withEntitlementsPlist(config, current => {
      ensureAppGroupEntitlement(current.modResults, ios.storageSuiteName);
      return current;
    });
  }

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
    config = withNotificationServiceExtension(config, ios, iosComraidPath);
  }

  return config;
}

/** Images, cold-device action buttons, and NSE delivered ACK need a Notification Service Extension. */
function withNotificationServiceExtension(config, ios, comraidPath = '') {
  const bundleIdentifier = config.ios?.bundleIdentifier;
  if (!bundleIdentifier) {
    throw new Error(
      '@comraid/react-native: ios.notificationServiceExtension needs expo.ios.bundleIdentifier',
    );
  }
  const storageSuiteName =
    typeof ios.storageSuiteName === 'string' ? ios.storageSuiteName.trim() : '';
  const versions = {
    version: config.version ?? '1.0.0',
    buildNumber: config.ios?.buildNumber ?? '1',
    storageSuiteName: storageSuiteName || undefined,
  };
  config = addEasAppExtension(config, bundleIdentifier, {
    storageSuiteName: storageSuiteName || undefined,
  });
  config = withDangerousMod(config, [
    'ios',
    current => {
      const iosRoot = current.modRequest.platformProjectRoot;
      writeNotificationServiceFiles(iosRoot, versions);
      const podfilePath = path.join(iosRoot, 'Podfile');
      const podfile = fs.readFileSync(podfilePath, 'utf8');
      fs.writeFileSync(
        podfilePath,
        addNotificationServicePodTarget(podfile, {
          comraidPath: comraidPath || undefined,
        }),
      );
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
