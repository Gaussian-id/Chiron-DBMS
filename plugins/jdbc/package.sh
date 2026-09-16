#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
VERSION="$(sed -nE "s/^version[[:space:]]*=[[:space:]]*'([^']+)'.*/\1/p" "$ROOT/build.gradle" | head -n 1)"
PACKAGE_DIR="$ROOT/dist/chiron-horizon-jdbc-plugin-$VERSION"
ZIP_PATH="$ROOT/dist/chiron-horizon-jdbc-plugin-$VERSION.zip"

cd "$ROOT"
./gradlew -q shadowJar -x test

rm -rf "$PACKAGE_DIR" "$ZIP_PATH"
mkdir -p "$PACKAGE_DIR/bin" "$PACKAGE_DIR/lib"
cp "$ROOT/manifest.json" "$PACKAGE_DIR/manifest.json"
cp "$ROOT/bin/chiron-horizon-jdbc-plugin" "$PACKAGE_DIR/bin/chiron-horizon-jdbc-plugin"
cp "$ROOT/bin/chiron-horizon-jdbc-plugin.bat" "$PACKAGE_DIR/bin/chiron-horizon-jdbc-plugin.bat"
cp "$ROOT/bin/chiron-horizon-maven-resolver" "$PACKAGE_DIR/bin/chiron-horizon-maven-resolver"
cp "$ROOT/bin/chiron-horizon-maven-resolver.bat" "$PACKAGE_DIR/bin/chiron-horizon-maven-resolver.bat"
cp "$ROOT/build/libs/chiron-horizon-jdbc-plugin-all.jar" "$PACKAGE_DIR/lib/chiron-horizon-jdbc-plugin.jar"
chmod +x "$PACKAGE_DIR/bin/chiron-horizon-jdbc-plugin"
chmod +x "$PACKAGE_DIR/bin/chiron-horizon-maven-resolver"

(cd "$ROOT/dist" && zip -qr "chiron-horizon-jdbc-plugin-$VERSION.zip" "chiron-horizon-jdbc-plugin-$VERSION")
echo "$ZIP_PATH"
