import type { WebDavConfig } from "@/lib/backend/api";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/backend/safeStorage";

export const WEB_DAV_AUTO_UPLOAD_STORAGE_KEYS = ["chiron-horizon-webdav-endpoint", "chiron-horizon-webdav-username", "chiron-horizon-webdav-remote-path", "chiron-horizon-webdav-auto-upload-enabled", "chiron-horizon-webdav-auto-upload-interval-minutes"] as const;

export const DEFAULT_WEB_DAV_REMOTE_PATH = "Chiron Horizon/sync/snapshot.json";
export const DEFAULT_WEB_DAV_AUTO_UPLOAD_INTERVAL_MINUTES = 30;

export interface WebDavAutoUploadConfig {
  enabled: boolean;
  intervalMinutes: number;
  webDavConfig: WebDavConfig | null;
}

export function normalizedWebDavAutoUploadInterval(value: unknown): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return DEFAULT_WEB_DAV_AUTO_UPLOAD_INTERVAL_MINUTES;
  return Math.max(1, Math.min(1440, Math.round(numberValue)));
}

export function readWebDavAutoUploadConfig(): WebDavAutoUploadConfig {
  const endpoint = safeLocalStorageGet("chiron-horizon-webdav-endpoint")?.trim() || "";
  const username = safeLocalStorageGet("chiron-horizon-webdav-username")?.trim() || "";
  const remotePath = safeLocalStorageGet("chiron-horizon-webdav-remote-path")?.trim() || DEFAULT_WEB_DAV_REMOTE_PATH;

  return {
    enabled: safeLocalStorageGet("chiron-horizon-webdav-auto-upload-enabled") === "true",
    intervalMinutes: normalizedWebDavAutoUploadInterval(safeLocalStorageGet("chiron-horizon-webdav-auto-upload-interval-minutes")),
    webDavConfig: endpoint
      ? {
          endpoint,
          username: username || undefined,
          remotePath,
        }
      : null,
  };
}

export function writeWebDavAutoUploadFields(config: WebDavConfig, autoUpload: { enabled: boolean; intervalMinutes: unknown }) {
  safeLocalStorageSet("chiron-horizon-webdav-endpoint", config.endpoint.trim());
  safeLocalStorageSet("chiron-horizon-webdav-username", config.username?.trim() || "");
  safeLocalStorageSet("chiron-horizon-webdav-remote-path", config.remotePath?.trim() || DEFAULT_WEB_DAV_REMOTE_PATH);
  safeLocalStorageSet("chiron-horizon-webdav-auto-upload-enabled", String(autoUpload.enabled));
  safeLocalStorageSet("chiron-horizon-webdav-auto-upload-interval-minutes", String(normalizedWebDavAutoUploadInterval(autoUpload.intervalMinutes)));
}
