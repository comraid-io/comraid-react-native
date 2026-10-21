'use strict';

const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withInfoPlist,
} = require('@expo/config-plugins');

const pkg = require('../../package.json');

function withComRaid(config, options = {}) {
  config = withAndroidManifest(config, current => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(current.modResults);
    const android = options.android ?? {};
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
    return current;
  });

  config = withInfoPlist(config, current => {
    const storageSuiteName = options.ios?.storageSuiteName;
    if (storageSuiteName) current.modResults.ComRaidStorageSuiteName = storageSuiteName;
    return current;
  });

  return config;
}

module.exports = createRunOncePlugin(withComRaid, pkg.name, pkg.version);
module.exports.withComRaid = withComRaid;
