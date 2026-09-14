import { computed } from "vue";
import { useToast } from "@/composables/useToast";
import { CONNECTION_PICKER_OPTIONS, CONNECTION_PROFILES } from "@/types/generated/connectionProfiles";
import { databaseManifestEntry } from "@/lib/database/databaseDriverManifest";
import type { DatabaseType } from "@/types/database";

const deferredCategories = new Set(["sql", "analytics", "domestic", "lightweight"]);
const profiles: Record<string, { type: DatabaseType }> = CONNECTION_PROFILES;
const deferredTypes = new Set(
  CONNECTION_PICKER_OPTIONS.filter((option) => deferredCategories.has(option.category))
    .map((option) => profiles[option.value]?.type)
    .filter(Boolean),
);

/** Product availability only: keep upstream drivers and saved configurations intact. */
export function relationalComingSoon(typeOrProfile?: string): boolean {
  if (!typeOrProfile) return false;
  const type = profiles[typeOrProfile]?.type ?? (typeOrProfile as DatabaseType);
  // Manticore's SQL-compatible search surface is not a relational database.
  return type !== "manticoresearch" && (deferredTypes.has(type) || Boolean(databaseManifestEntry(type)?.dialect));
}

/** Keeps all entry points (including shortcuts and restored panels) unavailable. */
export function relationalComingSoonPanel() {
  return computed({
    get: () => false,
    set: (open: boolean) => {
      if (open) useToast().toast("Relational database tools · Coming Soon");
    },
  });
}
