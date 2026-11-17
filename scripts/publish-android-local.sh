#!/usr/bin/env bash
# Publish com.comraid:comraid to mavenLocal from a comraid-android checkout.
# Use this for RN local development when Maven Central is not available yet
# (or when iterating on a native tip). Expo/RN hosts resolve via mavenLocal().
set -euo pipefail

root="${1:-}"
if [[ -z "${root}" ]]; then
  echo "usage: $0 /path/to/comraid-android" >&2
  exit 1
fi
if [[ ! -x "${root}/gradlew" ]]; then
  echo "error: ${root}/gradlew not found or not executable" >&2
  exit 1
fi

cd "${root}"
./gradlew :comraid:publishToMavenLocal --no-configuration-cache
echo "Published com.comraid:comraid to mavenLocal from ${root}"
