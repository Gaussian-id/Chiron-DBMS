import type { WebDavConfig } from "@/lib/backend/api";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/backend/safeStorage";

export const WEB_DAV_AUTO_UPLOAD_STORAGE_KEYS = ["gauss-horizon-webdav-endpoint", "gauss-horizon-webdav-username", "gauss-horizon-webdav-remote-path", "gauss-horizon-webdav-auto-upload-enabled", "gauss-horizon-webdav-auto-upload-interval-minutes"] as const;

export const DEFAULT_WEB_DAV_REMOTE_PATH = "Gauss Horizon/sync/snapshot.json";
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
  const endpoint = safeLocalStorageGet("gauss-horizon-webdav-endpoint")?.trim() || "";
  const username = safeLocalStorageGet("gauss-horizon-webdav-username")?.trim() || "";
  const remotePath = safeLocalStorageGet("gauss-horizon-webdav-remote-path")?.trim() || DEFAULT_WEB_DAV_REMOTE_PATH;

  return {
    enabled: safeLocalStorageGet("gauss-horizon-webdav-auto-upload-enabled") === "true",
    intervalMinutes: normalizedWebDavAutoUploadInterval(safeLocalStorageGet("gauss-horizon-webdav-auto-upload-interval-minutes")),
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
  safeLocalStorageSet("gauss-horizon-webdav-endpoint", config.endpoint.trim());
  safeLocalStorageSet("gauss-horizon-webdav-username", config.username?.trim() || "");
  safeLocalStorageSet("gauss-horizon-webdav-remote-path", config.remotePath?.trim() || DEFAULT_WEB_DAV_REMOTE_PATH);
  safeLocalStorageSet("gauss-horizon-webdav-auto-upload-enabled", String(autoUpload.enabled));
  safeLocalStorageSet("gauss-horizon-webdav-auto-upload-interval-minutes", String(normalizedWebDavAutoUploadInterval(autoUpload.intervalMinutes)));
}
