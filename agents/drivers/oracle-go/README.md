# Chiron Horizon Oracle Go Agent

Experimental native Oracle agent for Chiron Horizon using `github.com/sijms/go-ora/v2`.

## Build

```bash
go build -o agent .
```

Cross-compile release builds use pure Go output:

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o chiron-horizon-agent-oracle-linux-x64 .
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -trimpath -ldflags="-s -w" -o chiron-horizon-agent-oracle-macos-aarch64 .
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o chiron-horizon-agent-oracle-windows-x64.exe .
```

## Local Chiron Horizon Test

Build the binary, then copy it into Chiron Horizon's installed Oracle driver directory:

```bash
mkdir -p ~/.chiron-horizon/agents/drivers/oracle
cp agent ~/.chiron-horizon/agents/drivers/oracle/agent
chmod +x ~/.chiron-horizon/agents/drivers/oracle/agent
```

Chiron Horizon prefers `agent` over `agent.jar`, so Oracle connections will use this Go
agent until the file is removed.

To restore the Java agent:

```bash
rm ~/.chiron-horizon/agents/drivers/oracle/agent
```
