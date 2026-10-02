# Chiron Horizon for fnOS

This directory packages the existing Chiron Horizon Web container as a native fnOS
application package. The FPK contains the application metadata and Docker
Compose integration; the Chiron Horizon image is pulled from the CNB registry when the
application is installed.

## Build

Run from the repository root:

```bash
./deploy/fnos/build.sh
```

The script reads the version from `crates/chiron-horizon-web/Cargo.toml`, downloads and
verifies the official `fnpack` binary when one is not already available, and
writes these artifacts to `dist/fnos/`:

- `CHIRON_HORIZON_<version>_fnos.fpk`
- `CHIRON_HORIZON_<version>_fnos.fpk.sha256`

Optional overrides:

```bash
CHIRON_HORIZON_FNOS_VERSION=0.6.25 \
CHIRON_HORIZON_FNOS_IMAGE=docker.cnb.cool/chiron-horizonio.com/chiron_horizon:0.6.25 \
CHIRON_HORIZON_FNOS_CHANGELOG='升级至 Chiron Horizon 0.6.25。' \
FNPACK_BIN=/path/to/fnpack \
./deploy/fnos/build.sh
```

Release builds must use an immutable version tag. The build rejects `latest`
and verifies that the package version matches the image tag by default.

## Runtime layout

- Host port: `4224`
- Container port: `4224`
- Persistent application data: `${TRIM_PKGVAR}` -> `/app/data`
- Persistent backups: `${TRIM_PKGVAR}/backups` -> `/app/backups`
- Container name: `chiron-horizon-fnos`
- Desktop entry: opens Chiron Horizon in a browser tab

Chiron Horizon password protection remains enabled. Users set the initial password from
the Chiron Horizon Web interface; the package never enables `CHIRON_HORIZON_DISABLE_PASSWORD`.

The draft application-center copy, support details, and privacy disclosure are
maintained in `store-listing.zh-CN.md`.

## Device validation still required

Before submitting a release to the fnOS application center, validate on a
clean fnOS device:

1. Install the generated FPK.
2. Confirm the versioned CNB image is pulled for the device architecture.
3. Open Chiron Horizon from the desktop and set the initial password.
4. Create and reconnect to a database connection.
5. Restart Chiron Horizon and confirm connections persist.
6. Upgrade from the previous FPK and confirm data remains intact.
7. Stop and start the application from the application center.
8. Uninstall and confirm the displayed data-removal behavior matches fnOS.
