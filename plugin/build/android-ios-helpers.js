'use strict';

const MESSAGING_SERVICE = 'com.comraid.android.internal.ComraidMessagingService';
const POST_NOTIFICATIONS = 'android.permission.POST_NOTIFICATIONS';
const FCM_EVENT = 'com.google.firebase.MESSAGING_EVENT';

/**
 * Declares ComRaid's FCM MessagingService on the host application (idempotent).
 * @param {Record<string, unknown>} application AndroidManifest application node
 */
function addFcmMessagingService(application) {
  if (!Array.isArray(application.service)) {
    application.service = [];
  }
  const exists = application.service.some(
    entry => entry?.$?.['android:name'] === MESSAGING_SERVICE,
  );
  if (exists) return application;
  application.service.push({
    $: {
      'android:name': MESSAGING_SERVICE,
      'android:exported': 'false',
    },
    'intent-filter': [
      {
        action: [{ $: { 'android:name': FCM_EVENT } }],
      },
    ],
  });
  return application;
}

/**
 * Ensures UIBackgroundModes includes remote-notification (idempotent).
 * @param {Record<string, unknown>} plist
 */
function ensureBackgroundModes(plist) {
  const existing = Array.isArray(plist.UIBackgroundModes) ? plist.UIBackgroundModes : [];
  const modes = new Set(existing);
  modes.add('remote-notification');
  plist.UIBackgroundModes = [...modes];
  return plist;
}

module.exports = {
  MESSAGING_SERVICE,
  POST_NOTIFICATIONS,
  FCM_EVENT,
  addFcmMessagingService,
  ensureBackgroundModes,
};
