export const COMPONENT_PLUGINS_UPDATED_EVENT = "chiron-horizon:component-plugins-updated";
export const COMPONENT_DRIVER_UPDATES_CHANGED_EVENT = "chiron-horizon:component-driver-updates-changed";
export const COMPONENT_UPDATES_CHANGED_EVENT = "chiron-horizon:component-updates-changed";

export function notifyComponentPluginsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COMPONENT_PLUGINS_UPDATED_EVENT));
}

export function notifyComponentDriverUpdatesChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COMPONENT_DRIVER_UPDATES_CHANGED_EVENT));
}

export function notifyComponentUpdatesChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COMPONENT_UPDATES_CHANGED_EVENT));
}
