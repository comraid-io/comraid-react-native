"use strict";

import NativeComraid from "./NativeComraid.js";
function nativeModule() {
  if (!NativeComraid) {
    throw new Error('react-native-comraid is not linked. Rebuild the native app; Expo Go cannot load this module.');
  }
  return NativeComraid;
}
function validateNotification(notification) {
  if (!notification.id.trim()) throw new TypeError('notification.id must not be empty');
  if (!notification.title.trim()) throw new TypeError('notification.title must not be empty');
}
function dataJson(data) {
  if (data != null && (typeof data !== 'object' || Array.isArray(data) || Object.values(data).some(value => typeof value !== 'string'))) {
    throw new TypeError('notification.data must be an object containing only string values');
  }
  return JSON.stringify(data ?? {});
}
function result(value) {
  return {
    id: value.id,
    requestedPrecision: value.requestedPrecision,
    appliedPrecision: value.appliedPrecision,
    triggerAt: new Date(value.triggerAtMillis),
    fallbackReason: value.fallbackReason || undefined
  };
}
export const Comraid = {
  async configure(options = {}) {
    await nativeModule().configure(options.android?.defaultChannelId ?? '', options.android?.defaultChannelName ?? '', options.android?.smallIconResourceName ?? '', options.ios?.storageSuiteName ?? '');
  },
  async getCapabilities() {
    return await nativeModule().getCapabilities();
  },
  async requestNotificationPermission() {
    return nativeModule().requestNotificationPermission();
  },
  async schedule(options) {
    validateNotification(options.notification);
    const triggerAtMillis = options.triggerAt instanceof Date ? options.triggerAt.getTime() : options.triggerAt;
    if (!Number.isFinite(triggerAtMillis) || triggerAtMillis <= Date.now()) {
      throw new TypeError('triggerAt must be a future Date or Unix time in milliseconds');
    }
    return result(await nativeModule().schedule(options.notification.id, options.notification.title, options.notification.body, triggerAtMillis, options.precision ?? 'inexact', options.fallbackPolicy ?? 'fail', dataJson(options.notification.data)));
  },
  async startTimer(options) {
    validateNotification(options.notification);
    if (!Number.isFinite(options.durationMs) || options.durationMs <= 0) {
      throw new TypeError('durationMs must be positive');
    }
    return result(await nativeModule().startTimer(options.notification.id, options.notification.title, options.notification.body, options.durationMs, options.precision ?? 'inexact', options.fallbackPolicy ?? 'fail', dataJson(options.notification.data)));
  },
  async cancel(id) {
    if (!id.trim()) throw new TypeError('id must not be empty');
    await nativeModule().cancel(id);
  },
  async pendingSchedules() {
    return (await nativeModule().pendingSchedules()).map(value => ({
      notification: {
        id: value.id,
        title: value.title,
        body: value.body
      },
      triggerAt: new Date(value.triggerAtMillis)
    }));
  }
};
export default Comraid;
//# sourceMappingURL=index.js.map