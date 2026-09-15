/** Compatibility-only identifiers for reading pre-Gaussian data. Never emitted by exports. */
export const LEGACY_ENCRYPTED_FORMAT = "dbx-encrypted";
export const LEGACY_CONFIG_FORMAT = "dbx-config";
export function migrateLegacyBrowserStorage(storage: Storage): void {
  const marker = "gauss-horizon-legacy-storage-migrated-v1";
  if (storage.getItem(marker)) return;
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => !!k);
  for (const old of keys) {
    if (!/^dbx[-:]/.test(old)) continue;
    const target = "gauss-horizon" + old.slice(3);
    // New preferences always win. Original data is retained for rollback.
    if (storage.getItem(target) === null) {
      const value = storage.getItem(old);
      if (value !== null) storage.setItem(target, value);
    }
  }
  storage.setItem(marker, "1");
}

export const LEGACY_SQLSERVER_LINKED_SCHEMA_PREFIX = "__dbx_sqlserver_linked__:";
