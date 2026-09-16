param(
  [string]$RustLog = "info",
  [string]$ChironHorizonPassword = "test",
  [switch]$NoWatch,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Set-Location -LiteralPath $repoRoot

$env:RUST_LOG = $RustLog
$env:CHIRON_HORIZON_PASSWORD = $ChironHorizonPassword

Write-Host "[chiron-horizon-backend] repo: $repoRoot" -ForegroundColor Cyan
Write-Host "[chiron-horizon-backend] RUST_LOG=$env:RUST_LOG CHIRON_HORIZON_PASSWORD=$env:CHIRON_HORIZON_PASSWORD" -ForegroundColor DarkCyan

if ($DryRun) {
  if ($NoWatch) {
    Write-Host "[chiron-horizon-backend] dry run: cargo run -p chiron-horizon-web" -ForegroundColor Yellow
  } else {
    Write-Host "[chiron-horizon-backend] dry run: cargo watch -x 'run -p chiron-horizon-web' (fallback: cargo run -p chiron-horizon-web)" -ForegroundColor Yellow
  }
  exit 0
}

$watchAvailable = $false
if (-not $NoWatch) {
  try {
    & cargo watch --version *> $null
    $watchAvailable = ($LASTEXITCODE -eq 0)
  } catch {
    $watchAvailable = $false
  }
}

if ($watchAvailable) {
  Write-Host "[chiron-horizon-backend] starting: cargo watch -x 'run -p chiron-horizon-web'" -ForegroundColor Green
  & cargo watch -x "run -p chiron-horizon-web"
  exit $LASTEXITCODE
}

if (-not $NoWatch) {
  Write-Warning "cargo-watch is unavailable; falling back to cargo run -p chiron-horizon-web. Install with: cargo install cargo-watch"
}

Write-Host "[chiron-horizon-backend] starting: cargo run -p chiron-horizon-web" -ForegroundColor Green
& cargo run -p chiron-horizon-web
exit $LASTEXITCODE
