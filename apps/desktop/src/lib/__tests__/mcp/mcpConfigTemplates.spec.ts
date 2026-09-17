import { describe, expect, it } from "vitest";
import { buildMcpCherryStudioConfig, buildMcpCodexConfig, buildMcpDeepSeekHarnessConfig, buildMcpJsonConfig, buildMcpOpenCodeConfig, buildMcpPiConfig, buildMcpQoderConfig, buildMcpTraeConfig, buildMcpVsCodeConfig, buildMcpWorkBuddyConfig, mcpWebBackendUrl } from "@/lib/mcp/mcpConfigTemplates";

describe("MCP config templates", () => {
  it("builds the standard mcpServers JSON used by Claude, Cursor, TRAE, and Windsurf", () => {
    const config = JSON.parse(buildMcpJsonConfig());

    expect(config).toEqual({
      mcpServers: {
        "chiron-horizon": {
          command: "chiron-horizon-mcp-server",
        },
      },
    });
  });

  it("preserves the standard mcpServers launch config for ZCode full configuration", () => {
    const launch = {
      command: "node",
      args: ["C:\\chiron-horizon\\mcp\\dist\\index.js"],
      env: { CHIRON_HORIZON_DATA_DIR: "D:\\Chiron Horizon Data" },
    };
    const config = JSON.parse(buildMcpJsonConfig(launch));

    expect(config).toEqual({ mcpServers: { "chiron-horizon": launch } });
    expect(config).not.toHaveProperty("mcp");
  });

  it("builds the standard mcpServers JSON used by the Pi agent", () => {
    expect(JSON.parse(buildMcpPiConfig())).toEqual({
      mcpServers: {
        "chiron-horizon": {
          command: "chiron-horizon-mcp-server",
        },
      },
    });
    expect(buildMcpPiConfig({ command: "npx", args: ["-y", "@chiron-horizon/mcp-server"] })).toContain('"npx"');
  });

  it("builds the standard mcpServers JSON used by WorkBuddy", () => {
    const launch = { command: "dbx-mcp-server", env: { DBX_DATA_DIR: "D:\\DBX Data" } };

    expect(JSON.parse(buildMcpWorkBuddyConfig(launch))).toEqual({
      mcpServers: {
        dbx: launch,
      },
    });
  });

  it("builds standard JSON configs with a direct node launch command", () => {
    const config = JSON.parse(buildMcpJsonConfig({ command: "C:\\Program Files\\nodejs\\node.exe", args: ["C:\\Users\\zhiyo\\AppData\\Roaming\\npm\\node_modules\\@chiron-horizon\\mcp-server\\dist\\index.js"] }));

    expect(config).toEqual({
      mcpServers: {
        "chiron-horizon": {
          command: "C:\\Program Files\\nodejs\\node.exe",
          args: ["C:\\Users\\zhiyo\\AppData\\Roaming\\npm\\node_modules\\@chiron-horizon\\mcp-server\\dist\\index.js"],
        },
      },
    });
  });

  it("uses the native binary for TRAE when Windows Node lives under Program Files", () => {
    const nodeLaunch = {
      command: "C:\\Program Files\\nodejs\\node.exe",
      args: ["C:\\Users\\supervisor\\AppData\\Roaming\\npm\\node_modules\\@chiron-horizon\\mcp-server\\bin\\chiron-horizon-mcp-server.js"],
      env: { CHIRON_HORIZON_DATA_DIR: "D:\\GreenSoft\\Chiron Horizon\\data" },
    };
    const nativeBinPath = "C:\\Users\\supervisor\\AppData\\Roaming\\npm\\node_modules\\@chiron-horizon\\mcp-win32-x64\\bin\\chiron-horizon-mcp.exe";

    expect(JSON.parse(buildMcpTraeConfig(nodeLaunch, nativeBinPath))).toEqual({
      mcpServers: { "chiron-horizon": { command: nativeBinPath, env: nodeLaunch.env } },
    });
    expect(JSON.parse(buildMcpTraeConfig(nodeLaunch))).toEqual({
      mcpServers: { "chiron-horizon": nodeLaunch },
    });
  });

  it("builds the Qoder config with the same launch shape as TRAE", () => {
    const launch = {
      command: "C:\\Program Files\\nodejs\\node.exe",
      args: ["C:\\chiron-horizon\\mcp\\dist\\index.js"],
      env: { CHIRON_HORIZON_DATA_DIR: "D:\\Chiron Horizon Data" },
    };
    const nativeBinPath = "C:\\Users\\supervisor\\AppData\\Roaming\\npm\\node_modules\\@chiron-horizon\\mcp-win32-x64\\bin\\chiron-horizon-mcp.exe";

    expect(JSON.parse(buildMcpQoderConfig(launch, nativeBinPath))).toEqual({
      mcpServers: { "chiron-horizon": { command: nativeBinPath, env: launch.env } },
    });
  });

  it("includes Web runtime settings without restoring permission environment variables", () => {
    const launch = {
      command: "chiron-horizon-mcp-server",
      env: {
        CHIRON_HORIZON_WEB_URL: "https://chiron-horizon.example.com/tools/chiron-horizon",
        CHIRON_HORIZON_WEB_PASSWORD: "your-web-login-password",
      },
    };

    expect(JSON.parse(buildMcpJsonConfig(launch))).toEqual({
      mcpServers: { "chiron-horizon": { command: "chiron-horizon-mcp-server", env: launch.env } },
    });
    expect(buildMcpCodexConfig(launch)).toContain('[mcp_servers."chiron-horizon".env]\nCHIRON_HORIZON_WEB_URL = "https://chiron-horizon.example.com/tools/chiron-horizon"');
    expect(JSON.parse(buildMcpOpenCodeConfig(launch)).mcp["chiron-horizon"].environment).toEqual(launch.env);
    expect(buildMcpJsonConfig(launch)).not.toContain("CHIRON_HORIZON_MCP_ALLOW_WRITES");
  });

  it("includes the portable Chiron Horizon data directory in JSON and Codex configs", () => {
    const launch = {
      command: "chiron-horizon-mcp-server",
      env: { CHIRON_HORIZON_DATA_DIR: "D:\\GreenSoft\\Chiron Horizon\\data" },
    };

    expect(JSON.parse(buildMcpJsonConfig(launch)).mcpServers["chiron-horizon"].env).toEqual(launch.env);
    expect(buildMcpCodexConfig(launch)).toContain('CHIRON_HORIZON_DATA_DIR = "D:\\\\GreenSoft\\\\Chiron Horizon\\\\data"');
  });

  it("keeps a deployed Web base path in CHIRON_HORIZON_WEB_URL", () => {
    expect(mcpWebBackendUrl("https://chiron-horizon.example.com", "/tools/chiron-horizon/api")).toBe("https://chiron-horizon.example.com/tools/chiron-horizon");
  });

  it("builds VS Code MCP config with the servers root and no policy environment", () => {
    const config = JSON.parse(buildMcpVsCodeConfig());

    expect(config).toEqual({
      servers: {
        "chiron-horizon": {
          type: "stdio",
          command: "chiron-horizon-mcp-server",
        },
      },
    });
  });

  it("builds VS Code config with a direct node launch command", () => {
    const config = JSON.parse(buildMcpVsCodeConfig({ command: "node", args: ["C:\\chiron-horizon\\mcp\\dist\\index.js"] }));

    expect(config).toEqual({
      servers: {
        "chiron-horizon": {
          type: "stdio",
          command: "node",
          args: ["C:\\chiron-horizon\\mcp\\dist\\index.js"],
        },
      },
    });
  });

  it("builds the Cherry Studio stdio configuration", () => {
    const config = JSON.parse(
      buildMcpCherryStudioConfig({
        command: "/opt/homebrew/bin/node",
        args: ["/opt/chiron-horizon/mcp-server/dist/index.js"],
        env: { CHIRON_HORIZON_WEB_URL: "https://chiron-horizon.example.com" },
      }),
    );

    expect(config).toEqual({
      mcpServers: {
        "chiron-horizon": {
          name: "chiron-horizon",
          description: "",
          baseUrl: "",
          command: "/opt/homebrew/bin/node",
          args: ["/opt/chiron-horizon/mcp-server/dist/index.js"],
          env: { CHIRON_HORIZON_WEB_URL: "https://chiron-horizon.example.com" },
          isActive: true,
          type: "stdio",
        },
      },
    });
  });

  it("builds Codex TOML config without policy environment", () => {
    expect(buildMcpCodexConfig()).toBe(['[mcp_servers."chiron-horizon"]', 'command = "chiron-horizon-mcp-server"'].join("\n"));
  });

  it("builds Codex TOML config with a direct node launch command", () => {
    expect(buildMcpCodexConfig({ command: "node", args: ["C:\\chiron-horizon\\mcp\\dist\\index.js"] })).toBe(['[mcp_servers."chiron-horizon"]', 'command = "node"', 'args = ["C:\\\\chiron-horizon\\\\mcp\\\\dist\\\\index.js"]'].join("\n"));
  });

  it("builds the DeepSeek Harness Cordis insert patch", () => {
    expect(buildMcpDeepSeekHarnessConfig()).toBe(["- insert:", "    - id: mcp-chiron-horizon", "      name: '@deepseek-ai/dsh-mcp-client'", "      config:", "        serverName: chiron-horizon", "        transport: stdio", '        command: "chiron-horizon-mcp-server"'].join("\n"));
  });

  it("includes launch arguments and explicit environment in the DeepSeek Harness patch", () => {
    expect(
      buildMcpDeepSeekHarnessConfig({
        command: "C:\\Program Files\\nodejs\\node.exe",
        args: ["C:\\Users\\zhiyo\\AppData\\Roaming\\npm\\node_modules\\@chiron-horizon\\mcp-server\\dist\\index.js"],
        env: { CHIRON_HORIZON_DATA_DIR: "D:\\Chiron Horizon Data" },
      }),
    ).toContain(
      ['        command: "C:\\\\Program Files\\\\nodejs\\\\node.exe"', '        args: ["C:\\\\Users\\\\zhiyo\\\\AppData\\\\Roaming\\\\npm\\\\node_modules\\\\@chiron-horizon\\\\mcp-server\\\\dist\\\\index.js"]', "        env:", '          "CHIRON_HORIZON_DATA_DIR": "D:\\\\Chiron Horizon Data"'].join(
        "\n",
      ),
    );
  });

  it("builds OpenCode config without policy environment", () => {
    const config = JSON.parse(buildMcpOpenCodeConfig());

    expect(config).toEqual({
      mcp: {
        "chiron-horizon": {
          type: "local",
          command: ["chiron-horizon-mcp-server"],
        },
      },
    });
  });

  it("builds OpenCode config with a direct node launch command", () => {
    const config = JSON.parse(buildMcpOpenCodeConfig({ command: "node", args: ["C:\\chiron-horizon\\mcp\\dist\\index.js"] }));

    expect(config).toEqual({
      mcp: {
        "chiron-horizon": {
          type: "local",
          command: ["node", "C:\\chiron-horizon\\mcp\\dist\\index.js"],
        },
      },
    });
  });
});
