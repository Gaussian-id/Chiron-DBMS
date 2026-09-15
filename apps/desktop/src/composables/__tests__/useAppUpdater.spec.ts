// @vitest-environment happy-dom
import { createApp, defineComponent, h, reactive, nextTick, type App } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { useAppUpdater } from "@/composables/useAppUpdater";
const mocks = vi.hoisted(() => ({
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  cancelUpdateDownload: vi.fn(),
  installDownloadedUpdate: vi.fn(),
  getDownloadedUpdate: vi.fn(),
  discardDownloadedUpdate: vi.fn(),
  getAppVersion: vi.fn(),
  listen: vi.fn(),
  relaunch: vi.fn(),
  persist: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/lib/backend/api", () => mocks);
vi.mock("@/lib/backend/tauriRuntime", () => ({ isTauriRuntime: () => true }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mocks.listen }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mocks.relaunch }));
vi.mock("@/composables/useToast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
const settings = reactive({ updateDownloadSource: "official", ignoredUpdateVersion: "", updateNotificationsEnabled: true });
vi.mock("@/stores/settingsStore", () => ({ useSettingsStore: () => ({ editorSettings: settings, updateEditorSettingsAndPersist: mocks.persist }) }));
const info = { current_version: "1.0.0", latest_version: "1.1.0", update_available: true, portable_mode: false, manual_update_only: false, release_name: "v1.1.0", release_url: "https://example.com", release_notes: "Changes" };
const cache = { cache_id: "cached", version: "1.1.0", portable_mode: false, release_url: "https://example.com", release_notes: "Changes", downloaded_at: 1 };
let app: App;
function mount(options: Parameters<typeof useAppUpdater>[0] = {}) {
  let updater!: ReturnType<typeof useAppUpdater>;
  app = createApp(
    defineComponent({
      setup() {
        updater = useAppUpdater(options);
        return () => h("div");
      },
    }),
  );
  app.use(i18n);
  app.mount(document.createElement("div"));
  return updater;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
  await nextTick();
}
beforeEach(() => {
  vi.resetAllMocks();
  settings.updateDownloadSource = "official";
  settings.ignoredUpdateVersion = "";
  settings.updateNotificationsEnabled = true;
  mocks.checkForUpdates.mockResolvedValue(info);
  mocks.downloadUpdate.mockResolvedValue(cache);
  mocks.getDownloadedUpdate.mockResolvedValue(null);
  mocks.getAppVersion.mockResolvedValue("1.0.0");
  mocks.listen.mockResolvedValue(vi.fn());
  mocks.persist.mockImplementation(async (values) => Object.assign(settings, values));
});
afterEach(() => {
  app?.unmount();
  vi.useRealTimers();
});
describe("Gaussian 0.1.0 distribution disabled", () => {
  it("does not check, schedule or restore cached updates on startup", async () => {
    vi.useFakeTimers();
    mocks.getDownloadedUpdate.mockResolvedValue(cache);
    const updater = mount();
    await updater.initialize();
    await vi.advanceTimersByTimeAsync(7_200_000);
    expect(mocks.checkForUpdates).not.toHaveBeenCalled();
    expect(mocks.getDownloadedUpdate).not.toHaveBeenCalled();
    expect(updater.hasUpdateAvailable.value).toBe(false);
  });
  it("blocks manual check, download, installation and relaunch", async () => {
    const updater = mount();
    updater.updateInfo.value = info;
    await updater.checkUpdates();
    await updater.downloadUpdateInBackground();
    await updater.installDownloadedUpdate();
    await updater.restartApp();
    expect(mocks.checkForUpdates).not.toHaveBeenCalled();
    expect(mocks.downloadUpdate).not.toHaveBeenCalled();
    expect(mocks.installDownloadedUpdate).not.toHaveBeenCalled();
    expect(mocks.relaunch).not.toHaveBeenCalled();
  });
  it("cannot re-enable upstream distribution through preferences", async () => {
    const updater = mount();
    await updater.initialize();
    settings.updateNotificationsEnabled = false;
    await flush();
    settings.updateNotificationsEnabled = true;
    await flush();
    await updater.changeUpdateDownloadSource("cnb");
    expect(mocks.checkForUpdates).not.toHaveBeenCalled();
    expect(mocks.downloadUpdate).not.toHaveBeenCalled();
  });
});
