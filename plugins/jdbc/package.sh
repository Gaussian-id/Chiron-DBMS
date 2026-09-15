#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
VERSION="$(sed -nE "s/^version[[:space:]]*=[[:space:]]*'([^']+)'.*/\1/p" "$ROOT/build.gradle" | head -n 1)"
PACKAGE_DIR="$ROOT/dist/gauss-horizon-jdbc-plugin-$VERSION"
ZIP_PATH="$ROOT/dist/gauss-horizon-jdbc-plugin-$VERSION.zip"

cd "$ROOT"
./gradlew -q shadowJar -x test

rm -rf "$PACKAGE_DIR" "$ZIP_PATH"
mkdir -p "$PACKAGE_DIR/bin" "$PACKAGE_DIR/lib"
cp "$ROOT/manifest.json" "$PACKAGE_DIR/manifest.json"
cp "$ROOT/bin/gauss-horizon-jdbc-plugin" "$PACKAGE_DIR/bin/gauss-horizon-jdbc-plugin"
cp "$ROOT/bin/gauss-horizon-jdbc-plugin.bat" "$PACKAGE_DIR/bin/gauss-horizon-jdbc-plugin.bat"
cp "$ROOT/bin/gauss-horizon-maven-resolver" "$PACKAGE_DIR/bin/gauss-horizon-maven-resolver"
cp "$ROOT/bin/gauss-horizon-maven-resolver.bat" "$PACKAGE_DIR/bin/gauss-horizon-maven-resolver.bat"
cp "$ROOT/build/libs/gauss-horizon-jdbc-plugin-all.jar" "$PACKAGE_DIR/lib/gauss-horizon-jdbc-plugin.jar"
chmod +x "$PACKAGE_DIR/bin/gauss-horizon-jdbc-plugin"
chmod +x "$PACKAGE_DIR/bin/gauss-horizon-maven-resolver"

(cd "$ROOT/dist" && zip -qr "gauss-horizon-jdbc-plugin-$VERSION.zip" "gauss-horizon-jdbc-plugin-$VERSION")
echo "$ZIP_PATH"
