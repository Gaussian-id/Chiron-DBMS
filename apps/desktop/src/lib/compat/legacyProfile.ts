/** Compatibility-only identifiers for reading pre-Chiron Horizon data. Never emitted by exports. */
export const LEGACY_ENCRYPTED_FORMAT = "dbx-encrypted";
export const LEGACY_CONFIG_FORMAT = "dbx-config";
export function migrateLegacyBrowserStorage(storage: Storage): void {
  const marker = "chiron-horizon-legacy-storage-migrated-v2";
  if (storage.getItem(marker)) return;
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => !!k);
  for (const old of keys) {
    const legacyPrefix = old.startsWith("dbx-") || old.startsWith("dbx:") ? "dbx" : old.startsWith("gauss-horizon-") || old.startsWith("gauss-horizon:") ? "gauss-horizon" : null;
    if (!legacyPrefix) continue;
    const target = "chiron-horizon" + old.slice(legacyPrefix.length);
    // New preferences always win. Original data is retained for rollback.
    if (storage.getItem(target) === null) {
      const value = storage.getItem(old);
      if (value !== null) storage.setItem(target, target === "chiron-horizon-theme-palette" && value === "gaussian" ? "chiron" : value);
    }
  }
  storage.setItem(marker, "1");
}

export const LEGACY_SQLSERVER_LINKED_SCHEMA_PREFIX = "__dbx_sqlserver_linked__:";
