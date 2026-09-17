#!/usr/bin/env python3
"""Create the immutable Chiron Horizon 0.1.0 agent registry from staged assets."""
import argparse
import hashlib
import json
import re
import sys
import zipfile
from email.parser import Parser
from pathlib import Path

PLATFORMS = ("macos-aarch64", "macos-x64", "windows-x64", "linux-x64")
RELEASE_PREFIX = "https://github.com/Gaussian-id/Gauss-Horizon/releases/download"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def artifact(path: Path, tag: str, *, fmt: str | None = None) -> dict:
    value = {
        "url": f"{RELEASE_PREFIX}/{tag}/{path.name}",
        "sha256": digest(path),
        "size": path.stat().st_size,
    }
    if fmt:
        value["format"] = fmt
    return value


def jar_label(path: Path, fallback: str) -> str:
    try:
        with zipfile.ZipFile(path) as archive:
            manifest = Parser().parsestr(archive.read("META-INF/MANIFEST.MF").decode("utf-8"))
            return manifest.get("Agent-Label", fallback)
    except (KeyError, OSError, zipfile.BadZipFile):
        return fallback


def readable_label(key: str) -> str:
    return " ".join(part.upper() if part in {"h2", "db2", "iotdb", "tdengine", "uxdb"} else part.title() for part in key.split("-"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("release_dir", type=Path)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--jre-version", required=True)
    parser.add_argument("--versions", type=Path, default=Path("agents/versions.json"))
    args = parser.parse_args()
    release_dir = args.release_dir.resolve()
    versions = json.loads(args.versions.read_text(encoding="utf-8"))
    expected_version = args.tag.removeprefix("v")
    if expected_version != "0.1.0" or any(version != expected_version for version in versions.values()):
        raise SystemExit("Agent registry requires every product agent to be version 0.1.0")

    jre_platforms = {}
    for platform in PLATFORMS:
        path = release_dir / f"chiron-horizon-jre-21-{platform}.tar.zst"
        if not path.is_file():
            raise SystemExit(f"Missing managed JRE asset: {path.name}")
        jre_platforms[platform] = artifact(path, args.tag, fmt="tar_zstd")

    drivers = {}
    missing = []
    for key, version in sorted(versions.items()):
        jar = release_dir / f"chiron-horizon-agent-{key}-{version}.jar"
        native = {}
        for platform in PLATFORMS:
            suffix = ".exe" if platform.startswith("windows-") else ""
            candidate = release_dir / f"chiron-horizon-agent-{key}-{version}-{platform}{suffix}"
            if candidate.is_file():
                native[platform] = artifact(candidate, args.tag)
        if not jar.is_file() and not native:
            missing.append(key)
            continue
        item = {
            "version": version,
            "label": jar_label(jar, readable_label(key)) if jar.is_file() else readable_label(key),
            "min_app_version": expected_version,
            "jre": "21",
        }
        if jar.is_file():
            item["jar"] = artifact(jar, args.tag)
        else:
            # Compatibility marker; the desktop only selects a native artifact.
            item["jar"] = {"url": "legacy-placeholder.jar", "size": 0}
        if native:
            item["native"] = native
        drivers[key] = item
    if missing:
        raise SystemExit("Missing 0.1.0 agent artifacts: " + ", ".join(missing))

    registry = {"jres": {"21": {"version": args.jre_version, "platforms": jre_platforms}}, "drivers": drivers}
    output = release_dir / "agent-registry.json"
    output.write_text(json.dumps(registry, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote {output} with {len(drivers)} drivers")
    return 0


if __name__ == "__main__":
    sys.exit(main())
