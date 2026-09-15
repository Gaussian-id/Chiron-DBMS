param(
  [string]$RustLog = "info",
  [string]$GaussHorizonPassword = "test",
  [switch]$NoWatch,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Set-Location -LiteralPath $repoRoot

$env:RUST_LOG = $RustLog
$env:GAUSS_HORIZON_PASSWORD = $GaussHorizonPassword

Write-Host "[gauss-horizon-backend] repo: $repoRoot" -ForegroundColor Cyan
Write-Host "[gauss-horizon-backend] RUST_LOG=$env:RUST_LOG GAUSS_HORIZON_PASSWORD=$env:GAUSS_HORIZON_PASSWORD" -ForegroundColor DarkCyan

if ($DryRun) {
  if ($NoWatch) {
    Write-Host "[gauss-horizon-backend] dry run: cargo run -p gauss-horizon-web" -ForegroundColor Yellow
  } else {
    Write-Host "[gauss-horizon-backend] dry run: cargo watch -x 'run -p gauss-horizon-web' (fallback: cargo run -p gauss-horizon-web)" -ForegroundColor Yellow
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
  Write-Host "[gauss-horizon-backend] starting: cargo watch -x 'run -p gauss-horizon-web'" -ForegroundColor Green
  & cargo watch -x "run -p gauss-horizon-web"
  exit $LASTEXITCODE
}

if (-not $NoWatch) {
  Write-Warning "cargo-watch is unavailable; falling back to cargo run -p gauss-horizon-web. Install with: cargo install cargo-watch"
}

Write-Host "[gauss-horizon-backend] starting: cargo run -p gauss-horizon-web" -ForegroundColor Green
& cargo run -p gauss-horizon-web
exit $LASTEXITCODE
