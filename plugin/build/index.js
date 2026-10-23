'use strict';

const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withEntitlementsPlist,
  withInfoPlist,
} = require('@expo/config-plugins');

const {
  POST_NOTIFICATIONS,
  addFcmMessagingService,
  ensureBackgroundModes,
} = require('./android-ios-helpers');

const pkg = require('../../package.json');

function withComRaid(config, options = {}) {
  const android = options.android ?? {};
  const ios = options.ios ?? {};
  const includeMessagingService = android.includeMessagingService !== false;

  config = AndroidConfig.Permissions.withPermissions(config, [POST_NOTIFICATIONS]);

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

  return config;
}

module.exports = createRunOncePlugin(withComRaid, pkg.name, pkg.version);
module.exports.withComRaid = withComRaid;
