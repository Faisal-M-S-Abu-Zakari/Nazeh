#!/usr/bin/env bash
set -euo pipefail

platform="${1:-}"
device_id="${MAESTRO_DEVICE_ID:-}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
flow_name="${MAESTRO_FLOW:-mobile-native-auth-large-text.yaml}"
if [[ "$flow_name" = /* ]]; then
  flow="$flow_name"
else
  flow="$script_dir/$flow_name"
fi

if [[ -z "$device_id" ]]; then
  echo "Set MAESTRO_DEVICE_ID to the connected simulator or device identifier." >&2
  echo "Find it with: maestro list-devices" >&2
  exit 2
fi

if ! command -v maestro >/dev/null 2>&1; then
  echo "Maestro CLI is required to run the native authentication flow." >&2
  exit 2
fi

case "$platform" in
  ios)
    echo "Before running, set iOS Larger Accessibility Sizes to its maximum in Settings."
    maestro --device "$device_id" test "$flow"
    ;;
  android)
    if ! command -v adb >/dev/null 2>&1; then
      echo "Android Debug Bridge (adb) is required for the Android font-scale setup." >&2
      exit 2
    fi

    previous_font_scale="$(adb -s "$device_id" shell settings get system font_scale | tr -d '\r')"
    if [[ ! "$previous_font_scale" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
      echo "Could not read the current Android system font scale: $previous_font_scale" >&2
      exit 2
    fi

    restore_font_scale() {
      adb -s "$device_id" shell settings put system font_scale "$previous_font_scale" >/dev/null
    }
    trap restore_font_scale EXIT

    adb -s "$device_id" shell settings put system font_scale 2.0
    actual_font_scale="$(adb -s "$device_id" shell settings get system font_scale | tr -d '\r')"
    if [[ "$actual_font_scale" != "2.0" ]]; then
      echo "Expected Android font_scale 2.0, received $actual_font_scale." >&2
      exit 2
    fi
    echo "Running with Android system font scale 2.0; the previous setting will be restored afterward."
    maestro --device "$device_id" test "$flow"
    ;;
  *)
    echo "Usage: $0 ios|android" >&2
    exit 2
    ;;
esac