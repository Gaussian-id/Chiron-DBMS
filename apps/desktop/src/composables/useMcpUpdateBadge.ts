import { ref } from "vue";
import * as api from "@/lib/backend/api";
import { beginMcpStatusRequest, isLatestMcpStatusRequest, mcpUpdateAvailability } from "@/lib/mcp/mcpUpdateStatus";

interface UseMcpUpdateBadgeOptions {
  isDesktop: boolean;
  updateNotificationsEnabled: () => boolean;
}

/**
 * MCP status badge state.
 *
 * The npm package is deferred in 0.1.0, so this observes local desktop
 * status only and never contacts an external package registry.
 */
export function useMcpUpdateBadge(options: UseMcpUpdateBadgeOptions) {
  const mcpUpdateAvailable = ref(false);

  async function refreshMcpUpdateStatus() {
    if (!options.isDesktop || !options.updateNotificationsEnabled()) return;
    const requestId = beginMcpStatusRequest();
    try {
      const status = await api.checkMcpServerStatus();
      if (!isLatestMcpStatusRequest(requestId)) return;
      if (!options.updateNotificationsEnabled()) return;
      const updateAvailable = mcpUpdateAvailability(status);
      if (updateAvailable !== null) mcpUpdateAvailable.value = updateAvailable;
    } catch {
      // A local status failure leaves the badge unchanged.
    }
  }

  /**
   * The Settings dialog supplies the already-read local state and invalidates
   * any in-flight status request.
   */
  function applyMcpStatus(updateAvailable: boolean, requestId?: number) {
    if (requestId !== undefined) {
      if (!isLatestMcpStatusRequest(requestId)) return;
    } else {
      beginMcpStatusRequest();
    }
    mcpUpdateAvailable.value = updateAvailable;
  }

  function handleMcpStatusChanged(event: Event) {
    const detail = (event as CustomEvent<{ updateAvailable?: boolean | null; requestId?: number } | null | undefined>).detail;
    if (detail && typeof detail.updateAvailable === "boolean") {
      applyMcpStatus(detail.updateAvailable, detail.requestId);
    } else if (detail && typeof detail.requestId === "number") {
      return;
    } else {
      void refreshMcpUpdateStatus();
    }
  }

  return {
    mcpUpdateAvailable,
    refreshMcpUpdateStatus,
    handleMcpStatusChanged,
    applyMcpStatus,
  };
}
