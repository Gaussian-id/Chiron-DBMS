# Gauss Horizon Xugu Agent

Native XuguDB agent for Gauss Horizon using `gitee.com/XuguDB/go-xugu-driver`.

## Build

```bash
go build -o agent .
```

Cross-compile release builds use pure Go output:

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o gauss-horizon-agent-xugu-linux-x64 .
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -trimpath -ldflags="-s -w" -o gauss-horizon-agent-xugu-macos-aarch64 .
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o gauss-horizon-agent-xugu-windows-x64.exe .
```

## Local Gauss Horizon Test

Build the binary, then copy it into Gauss Horizon's installed XuguDB driver directory:

```bash
mkdir -p ~/.gauss-horizon/agents/drivers/xugu
cp agent ~/.gauss-horizon/agents/drivers/xugu/agent
chmod +x ~/.gauss-horizon/agents/drivers/xugu/agent
```

Gauss Horizon prefers `agent` over `agent.jar`, so XuguDB connections will use this Go
agent until the file is removed.

To restore the Java/JDBC agent:

```bash
rm ~/.gauss-horizon/agents/drivers/xugu/agent
```
