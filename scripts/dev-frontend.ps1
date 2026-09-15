param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Set-Location -LiteralPath $repoRoot

Write-Host "[gauss-horizon-frontend] repo: $repoRoot" -ForegroundColor Cyan

if ($DryRun) {
  Write-Host "[gauss-horizon-frontend] dry run: pnpm.cmd run dev:web" -ForegroundColor Yellow
  exit 0
}

Write-Host "[gauss-horizon-frontend] starting: pnpm.cmd run dev:web" -ForegroundColor Green
& pnpm.cmd run dev:web
exit $LASTEXITCODE
