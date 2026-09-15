#!/usr/bin/env python3
"""Validate a staged 0.1.0 release before it can be published."""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

PLATFORMS = {"macos-aarch64", "macos-x64", "windows-x64", "linux-x64"}
PREFIX = "https://github.com/Gaussian-id/Gauss-Horizon/releases/download/v0.1.0/"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check_artifact(root: Path, value: dict, errors: list[str], location: str) -> None:
    url = value.get("url", "")
    if not url.startswith(PREFIX):
        errors.append(f"{location}: non-Gauss-Horizon immutable release URL: {url}")
        return
    path = root / Path(urlparse(url).path).name
    if not path.is_file():
        errors.append(f"{location}: staged asset missing: {path.name}")
        return
    if value.get("size") != path.stat().st_size:
        errors.append(f"{location}: size does not match {path.name}")
    if value.get("sha256") != sha256(path):
        errors.append(f"{location}: SHA-256 does not match {path.name}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("release_dir", type=Path)
    args = parser.parse_args()
    root = args.release_dir.resolve()
    registry_path = root / "agent-registry.json"
    errors: list[str] = []
    if not registry_path.is_file():
        errors.append("agent-registry.json is missing")
    else:
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        jre = registry.get("jres", {}).get("21", {})
        if not str(jre.get("version", "")).startswith("21."):
            errors.append("managed JRE key 21 is missing a Java 21 version")
        platforms = jre.get("platforms", {})
        if set(platforms) != PLATFORMS:
            errors.append(f"managed JRE platforms differ: {sorted(platforms)}")
        for platform, value in platforms.items():
            check_artifact(root, value, errors, f"jre {platform}")
        drivers = registry.get("drivers", {})
        if not drivers or any(item.get("version") != "0.1.0" for item in drivers.values()):
            errors.append("every agent driver must have version 0.1.0")
        h2 = drivers.get("h2", {})
        if not h2.get("jar") or not h2["jar"].get("sha256"):
            errors.append("H2 Java agent is absent from the release registry")
        for key, item in drivers.items():
            if item.get("jar", {}).get("size", 0):
                check_artifact(root, item["jar"], errors, f"driver {key} jar")
            for platform, value in item.get("native", {}).items():
                if platform not in PLATFORMS:
                    errors.append(f"driver {key}: unsupported native platform {platform}")
                check_artifact(root, value, errors, f"driver {key} {platform}")
    for path in root.iterdir():
        if re.search(r"(?:dbx|chiron)", path.name, re.I):
            errors.append(f"legacy product name in release asset: {path.name}")
    if errors:
        print("Release asset validation failed:\n- " + "\n- ".join(errors), file=sys.stderr)
        return 1
    print("Release assets validated: immutable registry, checksums, Java 21, and no legacy asset names.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
