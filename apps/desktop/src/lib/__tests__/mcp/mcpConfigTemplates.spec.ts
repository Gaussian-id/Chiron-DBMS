import { describe, expect, it } from "vitest";
import { buildMcpCherryStudioConfig, buildMcpCodexConfig, buildMcpDeepSeekHarnessConfig, buildMcpJsonConfig, buildMcpOpenCodeConfig, buildMcpPiConfig, buildMcpQoderConfig, buildMcpTraeConfig, buildMcpVsCodeConfig, mcpWebBackendUrl } from "@/lib/mcp/mcpConfigTemplates";

describe("MCP config templates", () => {
  it("builds the standard mcpServers JSON used by Claude, Cursor, TRAE, and Windsurf", () => {
    const config = JSON.parse(buildMcpJsonConfig());

    expect(config).toEqual({
      mcpServers: {
        "gauss-horizon": {
          command: "gauss-horizon-mcp-server",
        },
      },
    });
  });

  it("preserves the standard mcpServers launch config for ZCode full configuration", () => {
    const launch = {
      command: "node",
      args: ["C:\\gauss-horizon\\mcp\\dist\\index.js"],
      env: { GAUSS_HORIZON_DATA_DIR: "D:\\Gauss Horizon Data" },
    };
    const config = JSON.parse(buildMcpJsonConfig(launch));

    expect(config).toEqual({ mcpServers: { "gauss-horizon": launch } });
    expect(config).not.toHaveProperty("mcp");
  });

  it("builds the standard mcpServers JSON used by the Pi agent", () => {
    expect(JSON.parse(buildMcpPiConfig())).toEqual({
      mcpServers: {
        "gauss-horizon": {
          command: "gauss-horizon-mcp-server",
        },
      },
    });
    expect(buildMcpPiConfig({ command: "npx", args: ["-y", "@gauss-horizon/mcp-server"] })).toContain('"npx"');
  });

  it("builds standard JSON configs with a direct node launch command", () => {
    const config = JSON.parse(buildMcpJsonConfig({ command: "C:\\Program Files\\nodejs\\node.exe", args: ["C:\\Users\\zhiyo\\AppData\\Roaming\\npm\\node_modules\\@gauss-horizon\\mcp-server\\dist\\index.js"] }));

    expect(config).toEqual({
      mcpServers: {
        "gauss-horizon": {
          command: "C:\\Program Files\\nodejs\\node.exe",
          args: ["C:\\Users\\zhiyo\\AppData\\Roaming\\npm\\node_modules\\@gauss-horizon\\mcp-server\\dist\\index.js"],
        },
      },
    });
  });

  it("uses the native binary for TRAE when Windows Node lives under Program Files", () => {
    const nodeLaunch = {
      command: "C:\\Program Files\\nodejs\\node.exe",
      args: ["C:\\Users\\supervisor\\AppData\\Roaming\\npm\\node_modules\\@gauss-horizon\\mcp-server\\bin\\gauss-horizon-mcp-server.js"],
      env: { GAUSS_HORIZON_DATA_DIR: "D:\\GreenSoft\\Gauss Horizon\\data" },
    };
    const nativeBinPath = "C:\\Users\\supervisor\\AppData\\Roaming\\npm\\node_modules\\@gauss-horizon\\mcp-win32-x64\\bin\\gauss-horizon-mcp.exe";

    expect(JSON.parse(buildMcpTraeConfig(nodeLaunch, nativeBinPath))).toEqual({
      mcpServers: { "gauss-horizon": { command: nativeBinPath, env: nodeLaunch.env } },
    });
    expect(JSON.parse(buildMcpTraeConfig(nodeLaunch))).toEqual({
      mcpServers: { "gauss-horizon": nodeLaunch },
    });
  });

  it("builds the Qoder config with the same launch shape as TRAE", () => {
    const launch = {
      command: "C:\\Program Files\\nodejs\\node.exe",
      args: ["C:\\gauss-horizon\\mcp\\dist\\index.js"],
      env: { GAUSS_HORIZON_DATA_DIR: "D:\\Gauss Horizon Data" },
    };
    const nativeBinPath = "C:\\Users\\supervisor\\AppData\\Roaming\\npm\\node_modules\\@gauss-horizon\\mcp-win32-x64\\bin\\gauss-horizon-mcp.exe";

    expect(JSON.parse(buildMcpQoderConfig(launch, nativeBinPath))).toEqual({
      mcpServers: { "gauss-horizon": { command: nativeBinPath, env: launch.env } },
    });
  });

  it("includes Web runtime settings without restoring permission environment variables", () => {
    const launch = {
      command: "gauss-horizon-mcp-server",
      env: {
        GAUSS_HORIZON_WEB_URL: "https://gauss-horizon.example.com/tools/gauss-horizon",
        GAUSS_HORIZON_WEB_PASSWORD: "your-web-login-password",
      },
    };

    expect(JSON.parse(buildMcpJsonConfig(launch))).toEqual({
      mcpServers: { "gauss-horizon": { command: "gauss-horizon-mcp-server", env: launch.env } },
    });
    expect(buildMcpCodexConfig(launch)).toContain('[mcp_servers."gauss-horizon".env]\nGAUSS_HORIZON_WEB_URL = "https://gauss-horizon.example.com/tools/gauss-horizon"');
    expect(JSON.parse(buildMcpOpenCodeConfig(launch)).mcp["gauss-horizon"].environment).toEqual(launch.env);
    expect(buildMcpJsonConfig(launch)).not.toContain("GAUSS_HORIZON_MCP_ALLOW_WRITES");
  });

  it("includes the portable Gauss Horizon data directory in JSON and Codex configs", () => {
    const launch = {
      command: "gauss-horizon-mcp-server",
      env: { GAUSS_HORIZON_DATA_DIR: "D:\\GreenSoft\\Gauss Horizon\\data" },
    };

    expect(JSON.parse(buildMcpJsonConfig(launch)).mcpServers["gauss-horizon"].env).toEqual(launch.env);
    expect(buildMcpCodexConfig(launch)).toContain('GAUSS_HORIZON_DATA_DIR = "D:\\\\GreenSoft\\\\Gauss Horizon\\\\data"');
  });

  it("keeps a deployed Web base path in GAUSS_HORIZON_WEB_URL", () => {
    expect(mcpWebBackendUrl("https://gauss-horizon.example.com", "/tools/gauss-horizon/api")).toBe("https://gauss-horizon.example.com/tools/gauss-horizon");
  });

  it("builds VS Code MCP config with the servers root and no policy environment", () => {
    const config = JSON.parse(buildMcpVsCodeConfig());

    expect(config).toEqual({
      servers: {
        "gauss-horizon": {
          type: "stdio",
          command: "gauss-horizon-mcp-server",
        },
      },
    });
  });

  it("builds VS Code config with a direct node launch command", () => {
    const config = JSON.parse(buildMcpVsCodeConfig({ command: "node", args: ["C:\\gauss-horizon\\mcp\\dist\\index.js"] }));

    expect(config).toEqual({
      servers: {
        "gauss-horizon": {
          type: "stdio",
          command: "node",
          args: ["C:\\gauss-horizon\\mcp\\dist\\index.js"],
        },
      },
    });
  });

  it("builds the Cherry Studio stdio configuration", () => {
    const config = JSON.parse(
      buildMcpCherryStudioConfig({
        command: "/opt/homebrew/bin/node",
        args: ["/opt/gauss-horizon/mcp-server/dist/index.js"],
        env: { GAUSS_HORIZON_WEB_URL: "https://gauss-horizon.example.com" },
      }),
    );

    expect(config).toEqual({
      mcpServers: {
        "gauss-horizon": {
          name: "gauss-horizon",
          description: "",
          baseUrl: "",
          command: "/opt/homebrew/bin/node",
          args: ["/opt/gauss-horizon/mcp-server/dist/index.js"],
          env: { GAUSS_HORIZON_WEB_URL: "https://gauss-horizon.example.com" },
          isActive: true,
          type: "stdio",
        },
      },
    });
  });

  it("builds Codex TOML config without policy environment", () => {
    expect(buildMcpCodexConfig()).toBe(['[mcp_servers."gauss-horizon"]', 'command = "gauss-horizon-mcp-server"'].join("\n"));
  });

  it("builds Codex TOML config with a direct node launch command", () => {
    expect(buildMcpCodexConfig({ command: "node", args: ["C:\\gauss-horizon\\mcp\\dist\\index.js"] })).toBe(['[mcp_servers."gauss-horizon"]', 'command = "node"', 'args = ["C:\\\\gauss-horizon\\\\mcp\\\\dist\\\\index.js"]'].join("\n"));
  });

  it("builds the DeepSeek Harness Cordis insert patch", () => {
    expect(buildMcpDeepSeekHarnessConfig()).toBe(["- insert:", "    - id: mcp-gauss-horizon", "      name: '@deepseek-ai/dsh-mcp-client'", "      config:", "        serverName: gauss-horizon", "        transport: stdio", '        command: "gauss-horizon-mcp-server"'].join("\n"));
  });

  it("includes launch arguments and explicit environment in the DeepSeek Harness patch", () => {
    expect(
      buildMcpDeepSeekHarnessConfig({
        command: "C:\\Program Files\\nodejs\\node.exe",
        args: ["C:\\Users\\zhiyo\\AppData\\Roaming\\npm\\node_modules\\@gauss-horizon\\mcp-server\\dist\\index.js"],
        env: { GAUSS_HORIZON_DATA_DIR: "D:\\Gauss Horizon Data" },
      }),
    ).toContain(
      ['        command: "C:\\\\Program Files\\\\nodejs\\\\node.exe"', '        args: ["C:\\\\Users\\\\zhiyo\\\\AppData\\\\Roaming\\\\npm\\\\node_modules\\\\@gauss-horizon\\\\mcp-server\\\\dist\\\\index.js"]', "        env:", '          "GAUSS_HORIZON_DATA_DIR": "D:\\\\Gauss Horizon Data"'].join(
        "\n",
      ),
    );
  });

  it("builds OpenCode config without policy environment", () => {
    const config = JSON.parse(buildMcpOpenCodeConfig());

    expect(config).toEqual({
      mcp: {
        "gauss-horizon": {
          type: "local",
          command: ["gauss-horizon-mcp-server"],
        },
      },
    });
  });

  it("builds OpenCode config with a direct node launch command", () => {
    const config = JSON.parse(buildMcpOpenCodeConfig({ command: "node", args: ["C:\\gauss-horizon\\mcp\\dist\\index.js"] }));

    expect(config).toEqual({
      mcp: {
        "gauss-horizon": {
          type: "local",
          command: ["node", "C:\\gauss-horizon\\mcp\\dist\\index.js"],
        },
      },
    });
  });
});
