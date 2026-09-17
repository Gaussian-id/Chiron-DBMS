# syntax=docker/dockerfile:1

# Stage 1: Build frontend (native, no emulation)
FROM --platform=$BUILDPLATFORM node:22-slim AS frontend
WORKDIR /app
RUN npm i -g pnpm
# Keep the workspace package available because Vite resolves it directly from source.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/mongo-shell/ packages/mongo-shell/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY apps/desktop/ apps/desktop/
# The vite connection-types plugin runs scripts/sync-connection-types.mjs during
# `pnpm build`, which reads plugins/connection-types + plugins/dialects and
# regenerates the manifest and generated TS types in place.
COPY scripts/ scripts/
COPY plugins/ plugins/
COPY crates/chiron-horizon-core/assets/database-drivers.manifest.json crates/chiron-horizon-core/assets/database-drivers.manifest.json
RUN pnpm build

# Stage 2: Cross-compile Rust backend for the requested platform (native, no emulation)
FROM --platform=$BUILDPLATFORM rust:1-bookworm AS backend
ARG TARGETARCH
WORKDIR /app
RUN dpkg --add-architecture arm64 \
    && apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake pkg-config perl python3-pip gcc-aarch64-linux-gnu \
    libfontconfig-dev:arm64 libfreetype-dev:arm64 \
    && pip3 install --break-system-packages ziglang \
    && cargo install cargo-zigbuild \
    && rustup target add x86_64-unknown-linux-gnu aarch64-unknown-linux-gnu \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests only and create dummy sources to pre-compile dependencies.
# This layer is cached by GHA as long as Cargo.toml/Cargo.lock don't change.
COPY Cargo.toml Cargo.lock ./
COPY crates/chiron-horizon-core/Cargo.toml crates/chiron-horizon-core/
COPY crates/chiron-horizon-web/Cargo.toml crates/chiron-horizon-web/
COPY crates/chiron-horizon-mcp/Cargo.toml crates/chiron-horizon-mcp/
COPY crates/chiron-horizon-cli/Cargo.toml crates/chiron-horizon-cli/
COPY src-tauri/Cargo.toml src-tauri/
# Copy every vendored crate: root Cargo.toml [patch.crates-io] points at
# vendor/{ctor,rumqttc,dirs-sys,pageant,wry}; omitting any breaks the offline build.
COPY vendor/ vendor/
RUN mkdir -p crates/chiron-horizon-core/src && echo '' > crates/chiron-horizon-core/src/lib.rs \
    && mkdir -p crates/chiron-horizon-web/src && echo 'fn main() {}' > crates/chiron-horizon-web/src/main.rs \
    && mkdir -p crates/chiron-horizon-mcp/src && echo '' > crates/chiron-horizon-mcp/src/lib.rs && echo 'fn main() {}' > crates/chiron-horizon-mcp/src/main.rs \
    && mkdir -p crates/chiron-horizon-cli/src && echo 'fn main() {}' > crates/chiron-horizon-cli/src/main.rs \
    && mkdir -p src-tauri/src && echo 'fn main() {}' > src-tauri/src/main.rs && echo 'pub fn run() {}' > src-tauri/src/lib.rs

COPY src-tauri/build.rs src-tauri/
COPY src-tauri/tauri.conf.json src-tauri/

RUN case "$TARGETARCH" in \
      amd64) rust_target=x86_64-unknown-linux-gnu; lib_arch=x86_64-linux-gnu ;; \
      arm64) rust_target=aarch64-unknown-linux-gnu; lib_arch=aarch64-linux-gnu ;; \
      *) echo "Unsupported TARGETARCH: $TARGETARCH" >&2; exit 1 ;; \
    esac && \
    LIBRARY_PATH="/usr/lib/$lib_arch" \
    PKG_CONFIG_PATH="/usr/lib/$lib_arch/pkgconfig" \
    PKG_CONFIG_SYSROOT_DIR="/" \
    RUSTFLAGS="-L native=/usr/lib/$lib_arch" \
    cargo zigbuild --release -p chiron-horizon-web --target "$rust_target" || true

# Copy real sources and rebuild (only application code recompiles)
COPY crates/ crates/
# chiron-horizon-core's build.rs embeds plugins/dialects (SQL dialects) and
# plugins/connection-types (database manifest + DatabaseType enum);
# either directory missing makes the build script panic.
COPY plugins/dialects/ plugins/dialects/
COPY plugins/connection-types/ plugins/connection-types/

# Docker COPY preserves original file timestamps, which may be older than the
# dummy-source binary compiled above. Touch all .rs files so cargo detects the
# source change and recompiles instead of reusing the dummy binary.
RUN find crates/ -name '*.rs' -exec touch {} +

RUN case "$TARGETARCH" in \
      amd64) rust_target=x86_64-unknown-linux-gnu; lib_arch=x86_64-linux-gnu ;; \
      arm64) rust_target=aarch64-unknown-linux-gnu; lib_arch=aarch64-linux-gnu ;; \
      *) echo "Unsupported TARGETARCH: $TARGETARCH" >&2; exit 1 ;; \
    esac && \
    LIBRARY_PATH="/usr/lib/$lib_arch" \
    PKG_CONFIG_PATH="/usr/lib/$lib_arch/pkgconfig" \
    PKG_CONFIG_SYSROOT_DIR="/" \
    RUSTFLAGS="-L native=/usr/lib/$lib_arch" \
    cargo zigbuild --release -p chiron-horizon-web --target "$rust_target" && \
    mkdir -p "/out/linux/$TARGETARCH" && \
    cp "/app/target/$rust_target/release/chiron-horizon-web" "/out/linux/$TARGETARCH/"

# Stage 3: Final image
FROM debian:bookworm-slim
ARG TARGETPLATFORM
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fontconfig \
    fonts-dejavu-core \
    libfreetype6 \
    libssl3 \
    openjdk-17-jre-headless \
    && rm -rf /var/lib/apt/lists/*
COPY --from=backend /out/${TARGETPLATFORM}/chiron-horizon-web /usr/local/bin/
COPY --from=frontend /app/dist /app/static
ENV CHIRON_HORIZON_STATIC_DIR=/app/static
ENV CHIRON_HORIZON_DATA_DIR=/app/data
ENV CHIRON_HORIZON_JAVA_BIN=/usr/bin/java
EXPOSE 4224
CMD ["chiron-horizon-web"]
