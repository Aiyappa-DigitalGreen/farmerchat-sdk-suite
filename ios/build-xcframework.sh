#!/usr/bin/env bash
#
# build-xcframework.sh — build distributable .xcframework binaries for the
# FarmerChat iOS SDK packages (FarmerChatCore, FarmerChatSwiftUI,
# FarmerChatUIKit) for iphoneos + iphonesimulator.
#
# Why this is non-trivial: SwiftPM library products build as STATIC archives,
# and `xcodebuild archive` of a static SwiftPM scheme emits only a `.o` — no
# framework. To get real frameworks we temporarily flip each product to
# `type: .dynamic` (the manifest is restored on exit), archive per-platform,
# copy the generated `.swiftmodule` into the framework's `Modules/` directory
# (xcodebuild does not do this for SwiftPM dynamic products — the known quirk),
# then combine the per-platform frameworks with `xcodebuild -create-xcframework`.
#
# Output: ios/dist/<Product>.xcframework  and a Package.binary.swift manifest
# variant that references them as binaryTargets.
#
# Usage:  ./build-xcframework.sh            # all three packages
#         ./build-xcframework.sh Core       # single package (Core|SwiftUI|UIKit)
#
set -euo pipefail

IOS_ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST="$IOS_ROOT/dist"
BUILD="$IOS_ROOT/.xcframework-build"
VERSION="1.0.0"   # single source: FarmerChatCore FarmerChatSDK.version

# package-dir : scheme/product : min-ios
PACKAGES=(
  "FarmerChatCore:FarmerChatCore:15.0"
  "FarmerChatSwiftUI:FarmerChatSwiftUI:16.0"
  "FarmerChatUIKit:FarmerChatUIKit:15.0"
)

FILTER="${1:-}"

# --- restore any temporarily-modified manifests on exit -----------------------
BACKUPS=()
cleanup() {
  for b in "${BACKUPS[@]:-}"; do
    [ -n "$b" ] && [ -f "$b" ] && mv -f "$b" "${b%.dist-bak}" && echo "restored ${b%.dist-bak}"
  done
}
trap cleanup EXIT

make_product_dynamic() {
  local pkg="$1" product="$2"
  local manifest="$IOS_ROOT/$pkg/Package.swift"
  cp "$manifest" "$manifest.dist-bak"
  BACKUPS+=("$manifest.dist-bak")
  # Insert `type: .dynamic,` into the .library(...) for this product.
  /usr/bin/sed -i '' \
    "s/\.library(name: \"$product\", targets:/.library(name: \"$product\", type: .dynamic, targets:/" \
    "$manifest"
}

archive_one() {
  local pkg="$1" scheme="$2" destination="$3" platform_tag="$4"
  local dd="$BUILD/dd-$scheme-$platform_tag"
  local archive="$BUILD/$scheme-$platform_tag.xcarchive"
  rm -rf "$archive"
  ( cd "$IOS_ROOT/$pkg" && xcodebuild archive \
      -scheme "$scheme" \
      -destination "$destination" \
      -archivePath "$archive" \
      -derivedDataPath "$dd" \
      SKIP_INSTALL=NO \
      BUILD_LIBRARY_FOR_DISTRIBUTION=YES \
      CODE_SIGNING_ALLOWED=NO \
      >/dev/null )

  local fw="$archive/Products/usr/local/lib/$scheme.framework"
  [ -d "$fw" ] || { echo "ERROR: $scheme.framework not produced for $platform_tag" >&2; exit 1; }

  # Copy the generated .swiftmodule into the framework (xcodebuild omits it).
  local built_module
  built_module="$(find "$dd/Build/Intermediates.noindex/ArchiveIntermediates/$scheme/BuildProductsPath" \
      -type d -name "$scheme.swiftmodule" | head -1)"
  if [ -n "$built_module" ]; then
    mkdir -p "$fw/Modules"
    cp -R "$built_module" "$fw/Modules/"
  fi
  echo "$fw"
}

build_package() {
  local pkg="$1" scheme="$2"
  echo "==> $scheme.xcframework"
  local sim_fw dev_fw
  sim_fw="$(archive_one "$pkg" "$scheme" "generic/platform=iOS Simulator" "simulator")"
  dev_fw="$(archive_one "$pkg" "$scheme" "generic/platform=iOS" "device")"

  rm -rf "$DIST/$scheme.xcframework"
  xcodebuild -create-xcframework \
    -framework "$sim_fw" \
    -framework "$dev_fw" \
    -output "$DIST/$scheme.xcframework" >/dev/null
  echo "    -> $DIST/$scheme.xcframework"
}

rm -rf "$BUILD"
mkdir -p "$DIST" "$BUILD"

# Flip ALL products to dynamic up front so that dependent packages
# (SwiftUI/UIKit) link FarmerChatCore as a *separate* dynamic framework
# instead of statically embedding it — this keeps the produced xcframeworks
# free of duplicate Core symbols, so a consumer can link Core + a UI package
# together. Manifests are restored on exit by the trap.
for entry in "${PACKAGES[@]}"; do
  IFS=':' read -r pkg scheme _ <<< "$entry"
  make_product_dynamic "$pkg" "$scheme"
done

for entry in "${PACKAGES[@]}"; do
  IFS=':' read -r pkg scheme min <<< "$entry"
  case "$FILTER" in
    "") build_package "$pkg" "$scheme" ;;
    Core)     [ "$scheme" = "FarmerChatCore" ]    && build_package "$pkg" "$scheme" ;;
    SwiftUI)  [ "$scheme" = "FarmerChatSwiftUI" ] && build_package "$pkg" "$scheme" ;;
    UIKit)    [ "$scheme" = "FarmerChatUIKit" ]   && build_package "$pkg" "$scheme" ;;
    *) echo "unknown filter: $FILTER (use Core|SwiftUI|UIKit)"; exit 1 ;;
  esac
done

rm -rf "$BUILD"
echo ""
echo "XCFrameworks (v$VERSION) written to: $DIST"
ls -1 "$DIST" | sed 's/^/  /'
echo ""
echo "Consume via the binary manifest: ios/Package.binary.swift"
echo "(rename to Package.swift in a distribution repo, or add the .xcframeworks"
echo " directly to an Xcode target's 'Frameworks, Libraries, and Embedded Content')."
