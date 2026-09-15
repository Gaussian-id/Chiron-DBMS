@SETLOCAL
@IF NOT DEFINED NODE_PATH (
  @SET "NODE_PATH=C:\pnpm-fixture\global\5\.pnpm\@gauss-horizon+mcp-server@0.4.71\node_modules\@gauss-horizon\mcp-server\bin\node_modules;C:\pnpm-fixture\global\5\.pnpm\@gauss-horizon+mcp-server@0.4.71\node_modules\@gauss-horizon\mcp-server\node_modules;C:\pnpm-fixture\global\5\.pnpm\@gauss-horizon+mcp-server@0.4.71\node_modules\@gauss-horizon\node_modules;C:\pnpm-fixture\global\5\.pnpm\@gauss-horizon+mcp-server@0.4.71\node_modules;C:\pnpm-fixture\global\5\.pnpm\node_modules"
) ELSE (
  @SET "NODE_PATH=C:\pnpm-fixture\global\5\.pnpm\@gauss-horizon+mcp-server@0.4.71\node_modules\@gauss-horizon\mcp-server\bin\node_modules;C:\pnpm-fixture\global\5\.pnpm\@gauss-horizon+mcp-server@0.4.71\node_modules\@gauss-horizon\mcp-server\node_modules;C:\pnpm-fixture\global\5\.pnpm\@gauss-horizon+mcp-server@0.4.71\node_modules\@gauss-horizon\node_modules;C:\pnpm-fixture\global\5\.pnpm\@gauss-horizon+mcp-server@0.4.71\node_modules;C:\pnpm-fixture\global\5\.pnpm\node_modules;%NODE_PATH%"
)
@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\global\5\.pnpm\@gauss-horizon+mcp-server@0.4.71\node_modules\@gauss-horizon\mcp-server\bin\gauss-horizon-mcp-server.js" %*
) ELSE (
  @SET PATHEXT=%PATHEXT:;.JS;=;%
  node  "%~dp0\..\global\5\.pnpm\@gauss-horizon+mcp-server@0.4.71\node_modules\@gauss-horizon\mcp-server\bin\gauss-horizon-mcp-server.js" %*
)
