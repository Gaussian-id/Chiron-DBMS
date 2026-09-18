import { ref, type Ref } from "vue";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/backend/safeStorage";

const PANEL_MIN_WIDTH = 240;
const DEFAULT_PANEL_MAX_WIDTH = 800;
type PanelMaxWidth = number | ((handle: HTMLElement | null) => number);

function restoredPanelWidth(storageKey: string, fallback: number): number {
  return Math.max(PANEL_MIN_WIDTH, Number(safeLocalStorageGet(storageKey)) || fallback);
}

function availableAiPanelMaxWidth(handle: HTMLElement | null) {
  const panel = handle?.parentElement;
  const flexibleContent = panel?.previousElementSibling as HTMLElement | null;
  if (!panel || !flexibleContent) return DEFAULT_PANEL_MAX_WIDTH;

  const panelRect = panel.getBoundingClientRect();
  const contentRect = flexibleContent.getBoundingClientRect();
  return Math.max(PANEL_MIN_WIDTH, panelRect.width + panelRect.left - contentRect.left);
}

export function usePanelResize() {
  const sidebarWidth = ref(restoredPanelWidth("chiron-horizon-sidebar-width", 260));
  const aiPanelWidth = ref(restoredPanelWidth("chiron-horizon-ai-panel-width", 360));
  const historyWidth = ref(restoredPanelWidth("chiron-horizon-history-width", 288));
  const sqlLibraryWidth = ref(restoredPanelWidth("chiron-horizon-sql-library-width", 288));
  const sqlFilePanelWidth = ref(restoredPanelWidth("chiron-horizon-sql-file-panel-width", 288));
  const tabBarWidth = ref(restoredPanelWidth("chiron-horizon-tab-bar-width", 240));
  const tabBarCollapsed = ref(safeLocalStorageGet("chiron-horizon-tab-bar-collapsed") === "true");

  function startPanelResize(widthRef: Ref<number>, storageKey: string, direction: "left" | "right", maxWidth: PanelMaxWidth = DEFAULT_PANEL_MAX_WIDTH) {
    return (e: PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const resizeHandle = e.currentTarget as HTMLElement | null;
      resizeHandle?.setPointerCapture(e.pointerId);
      const resizeOverlay = document.createElement("div");
      resizeOverlay.setAttribute("aria-hidden", "true");
      Object.assign(resizeOverlay.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483647",
        cursor: "col-resize",
        userSelect: "none",
        touchAction: "none",
      });
      document.body.append(resizeOverlay);
      const resolvedMaxWidth = typeof maxWidth === "function" ? maxWidth(resizeHandle) : maxWidth;
      const upperBound = Number.isFinite(resolvedMaxWidth) ? Math.max(PANEL_MIN_WIDTH, resolvedMaxWidth) : DEFAULT_PANEL_MAX_WIDTH;
      const renderedWidth = resizeHandle?.parentElement?.getBoundingClientRect().width;
      const requestedStartWidth = typeof renderedWidth === "number" && Number.isFinite(renderedWidth) && renderedWidth > 0 ? renderedWidth : widthRef.value;
      const startWidth = Math.max(PANEL_MIN_WIDTH, Math.min(upperBound, requestedStartWidth));
      widthRef.value = startWidth;
      const panelElement = resizeHandle?.parentElement;
      let currentWidth = startWidth;

      const onPointerMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX;
        currentWidth = Math.max(PANEL_MIN_WIDTH, Math.min(upperBound, startWidth + (direction === "right" ? delta : -delta)));
        panelElement?.style.setProperty("width", `${currentWidth}px`);
      };

      const finishResize = () => {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", finishResize);
        document.removeEventListener("pointercancel", finishResize);
        window.removeEventListener("blur", finishResize);
        if (resizeHandle?.hasPointerCapture(e.pointerId)) resizeHandle.releasePointerCapture(e.pointerId);
        resizeOverlay.remove();
        widthRef.value = currentWidth;
        safeLocalStorageSet(storageKey, String(widthRef.value));
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", finishResize);
      document.addEventListener("pointercancel", finishResize);
      window.addEventListener("blur", finishResize, { once: true });
    };
  }

  const startSidebarResize = startPanelResize(sidebarWidth, "chiron-horizon-sidebar-width", "right");
  const startAiPanelResize = startPanelResize(aiPanelWidth, "chiron-horizon-ai-panel-width", "left", availableAiPanelMaxWidth);
  const startHistoryResize = startPanelResize(historyWidth, "chiron-horizon-history-width", "left");
  const startSqlLibraryResize = startPanelResize(sqlLibraryWidth, "chiron-horizon-sql-library-width", "left");
  const startSqlFilePanelResize = startPanelResize(sqlFilePanelWidth, "chiron-horizon-sql-file-panel-width", "left");
  const startLeftTabBarResize = startPanelResize(tabBarWidth, "chiron-horizon-tab-bar-width", "right");
  const startRightTabBarResize = startPanelResize(tabBarWidth, "chiron-horizon-tab-bar-width", "left");

  function setTabBarCollapsed(collapsed: boolean) {
    tabBarCollapsed.value = collapsed;
    safeLocalStorageSet("chiron-horizon-tab-bar-collapsed", String(collapsed));
  }

  return {
    sidebarWidth,
    aiPanelWidth,
    historyWidth,
    sqlLibraryWidth,
    sqlFilePanelWidth,
    tabBarWidth,
    tabBarCollapsed,
    startSidebarResize,
    startAiPanelResize,
    startHistoryResize,
    startSqlLibraryResize,
    startSqlFilePanelResize,
    startLeftTabBarResize,
    startRightTabBarResize,
    setTabBarCollapsed,
  };
}
