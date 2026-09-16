export type McpExecutionMode = "read_only" | "safe_write" | "high_risk_write";

export interface McpCapabilityRow {
  labelKey: string;
  read_only: boolean;
  safe_write: boolean;
  high_risk_write: boolean;
}

export const MCP_EXECUTION_MODE_COLUMNS: ReadonlyArray<{ mode: McpExecutionMode; labelKey: string }> = [
  { mode: "read_only", labelKey: "settings.mcpExecutionModeReadOnly" },
  { mode: "safe_write", labelKey: "settings.mcpExecutionModeSafeWrite" },
  { mode: "high_risk_write", labelKey: "settings.mcpExecutionModeHighRiskWrite" },
];

export const MCP_CAPABILITY_ROWS: readonly McpCapabilityRow[] = [
  { labelKey: "settings.mcpCapabilityRead", read_only: true, safe_write: true, high_risk_write: true },
  { labelKey: "settings.mcpCapabilityScopedMutation", read_only: false, safe_write: true, high_risk_write: true },
  { labelKey: "settings.mcpCapabilityBroadMutation", read_only: false, safe_write: false, high_risk_write: true },
  { labelKey: "settings.mcpCapabilitySchemaAdmin", read_only: false, safe_write: false, high_risk_write: true },
  { labelKey: "settings.mcpCapabilityConnectionManagement", read_only: false, safe_write: true, high_risk_write: true },
];

export const MCP_TOOL_OPTIONS = [
  { name: "chiron_horizon_list_connections", labelKey: "settings.mcpToolListConnections" },
  { name: "chiron_horizon_list_databases", labelKey: "settings.mcpToolListDatabases" },
  { name: "chiron_horizon_list_tables", labelKey: "settings.mcpToolListTables" },
  { name: "chiron_horizon_describe_table", labelKey: "settings.mcpToolDescribeTable" },
  { name: "chiron_horizon_list_routines", labelKey: "settings.mcpToolListRoutines" },
  { name: "chiron_horizon_get_routine_source", labelKey: "settings.mcpToolGetRoutineSource" },
  { name: "chiron_horizon_get_schema_context", labelKey: "settings.mcpToolGetSchemaContext" },
  { name: "chiron_horizon_execute_query", labelKey: "settings.mcpToolExecuteQuery" },
  { name: "chiron_horizon_execute_batch", labelKey: "settings.mcpToolExecuteBatch" },
  { name: "chiron_horizon_open_session", labelKey: "settings.mcpToolOpenSession" },
  { name: "chiron_horizon_close_session", labelKey: "settings.mcpToolCloseSession" },
  { name: "chiron_horizon_execute_redis_command", labelKey: "settings.mcpToolExecuteRedisCommand" },
  { name: "chiron_horizon_peek_messages", labelKey: "settings.mcpToolPeekMessages" },
  { name: "chiron_horizon_send_message", labelKey: "settings.mcpToolSendMessage" },
  { name: "chiron_horizon_add_connection", labelKey: "settings.mcpToolAddConnection" },
  { name: "chiron_horizon_duplicate_connection", labelKey: "settings.mcpToolDuplicateConnection" },
  { name: "chiron_horizon_remove_connection", labelKey: "settings.mcpToolRemoveConnection" },
  { name: "chiron_horizon_open_table", labelKey: "settings.mcpToolOpenTable" },
  { name: "chiron_horizon_execute_and_show", labelKey: "settings.mcpToolExecuteAndShow" },
] as const;

export interface McpExecutionPolicyFields {
  readOnly: boolean;
  allowDangerousSql: boolean;
}

export interface McpPolicyMutationState {
  loading: boolean;
  saving: boolean;
  loadError: string;
}

export interface McpScopeConnectionLike {
  id: string;
}

export interface McpScopeConnectionGroups<T extends McpScopeConnectionLike> {
  allowed: T[];
  available: T[];
  unavailableAllowedIds: string[];
}

export function isMcpPolicyMutationBlocked(state: McpPolicyMutationState): boolean {
  return state.loading || state.saving || state.loadError.length > 0;
}

export function matchesMcpSearchQuery(rawQuery: string, values: readonly unknown[]): boolean {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return true;
  return values.some((value) => value !== null && value !== undefined && String(value).toLocaleLowerCase().includes(query));
}

export function groupMcpScopeConnections<T extends McpScopeConnectionLike>(connections: readonly T[], allowedConnectionIds: readonly string[] | null): McpScopeConnectionGroups<T> {
  if (allowedConnectionIds === null) {
    return {
      allowed: [...connections],
      available: [],
      unavailableAllowedIds: [],
    };
  }

  const allowedIds = new Set(allowedConnectionIds);
  const connectionIds = new Set(connections.map((connection) => connection.id));
  return {
    allowed: connections.filter((connection) => allowedIds.has(connection.id)),
    available: connections.filter((connection) => !allowedIds.has(connection.id)),
    unavailableAllowedIds: allowedConnectionIds.filter((id) => !connectionIds.has(id)),
  };
}

export function mcpExecutionModeFromPolicy(policy: McpExecutionPolicyFields): McpExecutionMode {
  if (policy.readOnly) return "read_only";
  return policy.allowDangerousSql ? "high_risk_write" : "safe_write";
}

export function mcpPolicyFieldsForExecutionMode(mode: McpExecutionMode): McpExecutionPolicyFields {
  switch (mode) {
    case "read_only":
      return { readOnly: true, allowDangerousSql: false };
    case "safe_write":
      return { readOnly: false, allowDangerousSql: false };
    case "high_risk_write":
      return { readOnly: false, allowDangerousSql: true };
  }
}

export function toggleMcpAllowedConnectionId(current: readonly string[] | null, availableConnectionIds: readonly string[], connectionId: string, allowed: boolean): string[] {
  return updateMcpAllowedConnectionIds(current, availableConnectionIds, [connectionId], allowed);
}

export function toggleMcpAllowedToolName(current: readonly string[] | null, toolName: string, allowed: boolean): string[] {
  const selected = new Set(current === null ? MCP_TOOL_OPTIONS.map((tool) => tool.name) : current);
  if (allowed) selected.add(toolName);
  else selected.delete(toolName);
  return [...selected];
}

export function updateMcpAllowedConnectionIds(current: readonly string[] | null, availableConnectionIds: readonly string[], connectionIds: readonly string[], allowed: boolean): string[] {
  const selected = new Set(current === null ? availableConnectionIds : current);
  for (const connectionId of connectionIds) {
    if (allowed) selected.add(connectionId);
    else selected.delete(connectionId);
  }
  return [...selected];
}
