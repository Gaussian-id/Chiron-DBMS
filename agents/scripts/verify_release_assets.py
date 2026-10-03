#!/usr/bin/env python3
"""Validate a staged release before it can be published."""
import argparse
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path
from urllib.parse import urlparse

PLATFORMS = {"macos-aarch64", "macos-x64", "windows-x64", "linux-x64"}
def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check_artifact(root: Path, value: dict, errors: list[str], location: str, prefix: str) -> None:
    url = value.get("url", "")
    if not url.startswith(prefix):
        errors.append(f"{location}: non-Chiron-Horizon immutable release URL: {url}")
        return
    path = root / Path(urlparse(url).path).name
    if not path.is_file():
        errors.append(f"{location}: staged asset missing: {path.name}")
        return
    if value.get("size") != path.stat().st_size:
        errors.append(f"{location}: size does not match {path.name}")
    if value.get("sha256") != sha256(path):
        errors.append(f"{location}: SHA-256 does not match {path.name}")


def check_offline_bundle(path: Path, platform: str, public_registry: dict, errors: list[str]) -> None:
    """Check the raw artifacts consumed by the application's offline importer.

    The public registry describes compressed downloads. Each offline ZIP must
    retain the earlier raw registry, whose sizes/hashes describe its own files.
    """
    label = f"offline {platform}"
    try:
        with zipfile.ZipFile(path) as archive:
            names = [item.filename for item in archive.infolist() if not item.is_dir()]
            if len(names) != len(set(names)):
                errors.append(f"{label}: duplicate archive entries")
                return
            registry = json.loads(archive.read("agent-registry.json"))
            if registry.get("jres") != public_registry.get("jres"):
                errors.append(f"{label}: runtime metadata differs from the public registry")
            drivers = registry.get("drivers", {})
            public_drivers = public_registry.get("drivers", {})
            if set(drivers) != set(public_drivers):
                errors.append(f"{label}: driver catalog differs from the public registry")
            expected = {}
            for key, jre in registry.get("jres", {}).items():
                artifact = jre.get("platforms", {}).get(platform)
                if artifact:
                    if artifact.get("format") != "tar_zstd":
                        errors.append(f"{label}: JRE {key} is not a tar.zst archive")
                    expected[f"jre/{Path(urlparse(artifact['url']).path).name}"] = artifact
            for key, driver in drivers.items():
                public = public_drivers.get(key, {})
                for field in ("version", "min_app_version", "jre"):
                    if driver.get(field) != public.get(field):
                        errors.append(f"{label}: driver {key} {field} differs from the public registry")
                artifacts = []
                jar = driver.get("jar", {})
                if jar.get("size", 0) > 0:
                    artifacts.append(jar)
                    jre = registry.get("jres", {}).get(driver.get("jre"), {})
                    if platform not in jre.get("platforms", {}):
                        errors.append(f"{label}: Java driver {key} has no compatible runtime")
                for target, artifact in driver.get("native", {}).items():
                    if target == platform or (key == "sqlite-worker" and target.startswith("linux-")):
                        artifacts.append(artifact)
                for artifact in artifacts:
                    if artifact.get("format") is not None:
                        errors.append(f"{label}: driver {key} must describe a raw offline artifact")
                    expected[f"drivers/{Path(urlparse(artifact['url']).path).name}"] = artifact

            actual = {name for name in names if name.startswith(("drivers/", "jre/"))}
            for missing in sorted(set(expected) - actual):
                errors.append(f"{label}: missing artifact {missing}")
            for extra in sorted(actual - set(expected)):
                errors.append(f"{label}: unregistered artifact {extra}")
            for name in sorted(actual & set(expected)):
                artifact = expected[name]
                if artifact.get("size") != archive.getinfo(name).file_size:
                    errors.append(f"{label}: size mismatch for {name}")
                digest = hashlib.sha256()
                with archive.open(name) as source:
                    for chunk in iter(lambda: source.read(1024 * 1024), b""):
                        digest.update(chunk)
                if artifact.get("sha256") != digest.hexdigest():
                    errors.append(f"{label}: SHA-256 mismatch for {name}")
    except (OSError, KeyError, ValueError, zipfile.BadZipFile) as error:
        errors.append(f"{label}: invalid bundle: {error}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("release_dir", type=Path)
    parser.add_argument("--tag", required=True)
    args = parser.parse_args()
    root = args.release_dir.resolve()
    version = args.tag.removeprefix("v")
    prefix = f"https://github.com/Gaussian-id/Chiron-DBMS/releases/download/{args.tag}/"
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
            check_artifact(root, value, errors, f"jre {platform}", prefix)
        drivers = registry.get("drivers", {})
        if not drivers or any(item.get("version") != version for item in drivers.values()):
            errors.append(f"every agent driver must have version {version}")
        h2 = drivers.get("h2", {})
        if not h2.get("jar") or not h2["jar"].get("sha256"):
            errors.append("H2 Java agent is absent from the release registry")
        for key, item in drivers.items():
            if item.get("jar", {}).get("size", 0):
                check_artifact(root, item["jar"], errors, f"driver {key} jar", prefix)
            for platform, value in item.get("native", {}).items():
                if platform not in PLATFORMS:
                    errors.append(f"driver {key}: unsupported native platform {platform}")
                check_artifact(root, value, errors, f"driver {key} {platform}", prefix)
        for platform in sorted(PLATFORMS):
            check_offline_bundle(root / f"chiron-horizon-agents-offline-{platform}.zip", platform, registry, errors)
    for path in root.iterdir():
        if re.search(r"(?:dbx|gauss[-_]?horizon)", path.name, re.I):
            errors.append(f"legacy product name in release asset: {path.name}")
    if errors:
        print("Release asset validation failed:\n- " + "\n- ".join(errors), file=sys.stderr)
        return 1
    print("Release assets validated: immutable registry, checksums, Java 21, and no legacy asset names.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
