import hashlib
import json
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path

from build_driver_zips import build_driver_zips
from verify_release_assets import PLATFORMS, check_offline_bundle


class OfflineReleaseTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.registry = {"jres": {"21": {"version": "21.0.12", "platforms": {}}}, "drivers": {}}

        def artifact(name, contents, **metadata):
            path = self.root / name
            path.write_bytes(contents)
            return dict(url=f"https://example.com/{name}", size=len(contents),
                        sha256=hashlib.sha256(contents).hexdigest(), **metadata)

        for platform in sorted(PLATFORMS):
            self.registry["jres"]["21"]["platforms"][platform] = artifact(
                f"chiron-horizon-jre-21-{platform}.tar.zst", b"fixture runtime " + platform.encode(), format="tar_zstd")
        self.jar_name = "chiron-horizon-agent-h2-0.1.6.jar"
        self.registry["drivers"]["h2"] = dict(version="0.1.6", jre="21", jar=artifact(self.jar_name, b"fixture jar"))
        native = {}
        for platform in sorted(PLATFORMS):
            suffix = ".exe" if platform.startswith("windows-") else ""
            native[platform] = artifact(f"chiron-horizon-agent-duckdb-0.1.6-{platform}{suffix}", b"fixture native " + platform.encode())
        self.registry["drivers"]["duckdb"] = dict(version="0.1.6", jre="21", native=native)
        self.worker_name = "chiron-horizon-agent-sqlite-worker-0.1.6-linux-x64"
        self.registry["drivers"]["sqlite-worker"] = dict(version="0.1.6", jre="21", native={
            "linux-x64": artifact(self.worker_name, b"fixture remote SQLite worker")})
        (self.root / "agent-registry.json").write_text(json.dumps(self.registry), encoding="utf-8")

    def build_offline(self):
        subprocess.run(["bash", str(Path(__file__).with_name("build_offline_zip.sh")), str(self.root)],
                       check=True, stdout=subprocess.DEVNULL)

    def compress_downloads(self):
        build_driver_zips(self.root)
        return json.loads((self.root / "agent-registry.json").read_text(encoding="utf-8"))

    def bundle(self, platform):
        return self.root / f"chiron-horizon-agents-offline-{platform}.zip"

    def errors(self, platform, public):
        errors = []
        check_offline_bundle(self.bundle(platform), platform, public, errors)
        return errors

    def rewrite(self, platform, transform):
        path = self.bundle(platform)
        replacement = path.with_suffix(".new.zip")
        with zipfile.ZipFile(path) as source, zipfile.ZipFile(replacement, "w") as target:
            for entry in source.infolist():
                data = transform(entry.filename, source.read(entry))
                if data is not None:
                    target.writestr(entry, data)
        replacement.replace(path)

    def test_raw_offline_registries_survive_compressed_public_downloads(self):
        self.build_offline()
        public = self.compress_downloads()
        self.assertEqual(public["drivers"]["h2"]["jar"]["format"], "tar_zstd")
        for platform in sorted(PLATFORMS):
            self.assertEqual(self.errors(platform, public), [])
            with zipfile.ZipFile(self.bundle(platform)) as archive:
                raw = json.loads(archive.read("agent-registry.json"))
                self.assertNotIn("format", raw["drivers"]["h2"]["jar"])
                self.assertIn(f"drivers/{self.worker_name}", archive.namelist())

    def test_rejects_compressing_metadata_before_raw_offline_assembly(self):
        public = self.compress_downloads()
        self.build_offline()
        for platform in sorted(PLATFORMS):
            errors = self.errors(platform, public)
            self.assertTrue(any("driver h2 must describe a raw offline artifact" in error for error in errors), errors)
            self.assertTrue(any("missing artifact drivers/" in error for error in errors), errors)

    def test_rejects_tampered_driver_bytes_even_when_size_is_unchanged(self):
        self.build_offline()
        public = self.compress_downloads()
        self.rewrite("linux-x64", lambda name, data: b"X" + data[1:] if name == f"drivers/{self.jar_name}" else data)
        self.assertTrue(any("SHA-256 mismatch" in error for error in self.errors("linux-x64", public)))

    def test_requires_remote_linux_sqlite_worker_in_mac_bundle(self):
        self.build_offline()
        public = self.compress_downloads()
        self.rewrite("macos-aarch64", lambda name, data: None if name == f"drivers/{self.worker_name}" else data)
        errors = self.errors("macos-aarch64", public)
        self.assertTrue(any(f"missing artifact drivers/{self.worker_name}" in error for error in errors), errors)

    def test_rejects_runtime_metadata_drift(self):
        self.build_offline()
        public = self.compress_downloads()
        public["jres"]["21"]["version"] = "21.0.99"
        self.assertTrue(any("runtime metadata differs" in error for error in self.errors("windows-x64", public)))


if __name__ == "__main__":
    unittest.main()
