'use strict';

const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withInfoPlist,
} = require('@expo/config-plugins');

const pkg = require('../../package.json');

function withComraid(config, options = {}) {
  config = withAndroidManifest(config, current => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(current.modResults);
    const android = options.android ?? {};
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      'com.comraide.DEFAULT_CHANNEL_ID',
      android.defaultChannelId ?? 'comraid.general',
    );
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      'com.comraide.DEFAULT_CHANNEL_NAME',
      android.defaultChannelName ?? 'General',
    );
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      'com.comraide.SMALL_ICON_RESOURCE',
      android.smallIconResourceName ?? 'ic_launcher',
    );
    return current;
  });

  config = withInfoPlist(config, current => {
    const storageSuiteName = options.ios?.storageSuiteName;
    if (storageSuiteName) current.modResults.ComraidStorageSuiteName = storageSuiteName;
    return current;
  });

  return config;
}

module.exports = createRunOncePlugin(withComraid, pkg.name, pkg.version);
module.exports.withComraid = withComraid;
