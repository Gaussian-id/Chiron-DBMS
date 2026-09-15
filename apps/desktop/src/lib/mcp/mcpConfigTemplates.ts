export interface McpLaunchConfig {
  command: string;
  args?: readonly string[];
  env?: Readonly<Record<string, string>>;
}

const DEFAULT_MCP_LAUNCH_CONFIG: McpLaunchConfig = {
  command: "gauss-horizon-mcp-server",
};

function launchConfig(config?: McpLaunchConfig): McpLaunchConfig {
  return config ?? DEFAULT_MCP_LAUNCH_CONFIG;
}

function withLaunchConfig(gaussHorizon: Record<string, unknown>, config?: McpLaunchConfig): Record<string, unknown> {
  const launch = launchConfig(config);
  gaussHorizon.command = launch.command;
  if (launch.args && launch.args.length > 0) {
    gaussHorizon.args = [...launch.args];
  }
  if (launch.env && Object.keys(launch.env).length > 0) {
    gaussHorizon.env = { ...launch.env };
  }
  return gaussHorizon;
}

function quotedStringArray(values: readonly string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

export function mcpWebBackendUrl(origin: string, apiPath: string): string {
  return new URL(apiPath, origin).toString().replace(/\/api\/?$/, "");
}

export function buildMcpJsonConfig(config?: McpLaunchConfig): string {
  const gaussHorizon: Record<string, unknown> = {
    ...withLaunchConfig({}, config),
  };

  return JSON.stringify({ mcpServers: { "gauss-horizon": gaussHorizon } }, null, 2);
}

export function buildMcpTraeConfig(config?: McpLaunchConfig, nativeBinPath?: string): string {
  return buildMcpJsonConfig(nativeBinPath ? { command: nativeBinPath, env: config?.env } : config);
}

export function buildMcpQoderConfig(config?: McpLaunchConfig, nativeBinPath?: string): string {
  return buildMcpTraeConfig(config, nativeBinPath);
}

export function buildMcpVsCodeConfig(config?: McpLaunchConfig): string {
  const gaussHorizon: Record<string, unknown> = {
    type: "stdio",
    ...withLaunchConfig({}, config),
  };

  return JSON.stringify({ servers: { "gauss-horizon": gaussHorizon } }, null, 2);
}

export function buildMcpCherryStudioConfig(config?: McpLaunchConfig): string {
  const launch = launchConfig(config);
  const gaussHorizon: Record<string, unknown> = {
    name: "gauss-horizon",
    description: "",
    baseUrl: "",
    command: launch.command,
    args: [...(launch.args ?? [])],
    env: { ...launch.env },
    isActive: true,
    type: "stdio",
  };

  return JSON.stringify({ mcpServers: { "gauss-horizon": gaussHorizon } }, null, 2);
}

export function buildMcpCodexConfig(config?: McpLaunchConfig): string {
  const launch = launchConfig(config);
  const lines = ['[mcp_servers."gauss-horizon"]', `command = ${JSON.stringify(launch.command)}`];

  if (launch.args && launch.args.length > 0) {
    lines.push(`args = ${quotedStringArray(launch.args)}`);
  }
  if (launch.env && Object.keys(launch.env).length > 0) {
    lines.push("", '[mcp_servers."gauss-horizon".env]');
    for (const [key, value] of Object.entries(launch.env)) {
      lines.push(`${key} = ${JSON.stringify(value)}`);
    }
  }

  return lines.join("\n");
}

export function buildMcpDeepSeekHarnessConfig(config?: McpLaunchConfig): string {
  const launch = launchConfig(config);
  const lines = ["- insert:", "    - id: mcp-gauss-horizon", "      name: '@deepseek-ai/dsh-mcp-client'", "      config:", "        serverName: gauss-horizon", "        transport: stdio", `        command: ${JSON.stringify(launch.command)}`];

  if (launch.args && launch.args.length > 0) {
    lines.push(`        args: ${quotedStringArray(launch.args)}`);
  }
  if (launch.env && Object.keys(launch.env).length > 0) {
    lines.push("        env:");
    for (const [key, value] of Object.entries(launch.env)) {
      lines.push(`          ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
    }
  }

  return lines.join("\n");
}

export function buildMcpOpenCodeConfig(config?: McpLaunchConfig): string {
  const launch = launchConfig(config);
  const gaussHorizon: Record<string, unknown> = {
    type: "local",
    command: [launch.command, ...(launch.args ?? [])],
  };
  if (launch.env && Object.keys(launch.env).length > 0) {
    gaussHorizon.environment = { ...launch.env };
  }

  return JSON.stringify({ mcp: { "gauss-horizon": gaussHorizon } }, null, 2);
}

export function buildMcpPiConfig(config?: McpLaunchConfig): string {
  return buildMcpJsonConfig(config);
}
