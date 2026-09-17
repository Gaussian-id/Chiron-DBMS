param(
  [string]$RustLog = "info",
  [string]$ChironHorizonPassword = "test",
  [switch]$NoWatch,
  [switch]$DryRun,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

$ErrorActionPreference = "Stop"

for ($i = 0; $i -lt $RemainingArgs.Count; $i++) {
  switch ($RemainingArgs[$i]) {
    "--" { }
    "-DryRun" { $DryRun = $true }
    "-NoWatch" { $NoWatch = $true }
    "-RustLog" {
      $i++
      if ($i -ge $RemainingArgs.Count) { throw "Missing value for -RustLog" }
      $RustLog = $RemainingArgs[$i]
    }
    "-ChironHorizonPassword" {
      $i++
      if ($i -ge $RemainingArgs.Count) { throw "Missing value for -ChironHorizonPassword" }
      $ChironHorizonPassword = $RemainingArgs[$i]
    }
    default { throw "Unknown argument: $($RemainingArgs[$i])" }
  }
}

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$backendScript = Join-Path $PSScriptRoot "dev-backend.ps1"
$frontendScript = Join-Path $PSScriptRoot "dev-frontend.ps1"

$shellCommand = Get-Command pwsh.exe -ErrorAction SilentlyContinue
if (-not $shellCommand) {
  $shellCommand = Get-Command powershell.exe -ErrorAction Stop
}
$shell = $shellCommand.Source

$backendArgs = @(
  "-NoExit",
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", $backendScript,
  "-RustLog", $RustLog,
  "-ChironHorizonPassword", $ChironHorizonPassword
)
if ($NoWatch) {
  $backendArgs += "-NoWatch"
}

$frontendArgs = @(
  "-NoExit",
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", $frontendScript
)

if ($DryRun) {
  Write-Host "[chiron-horizon-dev] repo: $repoRoot" -ForegroundColor Cyan
  Write-Host "[chiron-horizon-dev] shell: $shell" -ForegroundColor Cyan
  Write-Host "[chiron-horizon-dev] backend window: $shell $($backendArgs -join ' ')" -ForegroundColor Yellow
  Write-Host "[chiron-horizon-dev] frontend window: $shell $($frontendArgs -join ' ')" -ForegroundColor Yellow
  & $shell -NoProfile -ExecutionPolicy Bypass -File $backendScript -RustLog $RustLog -ChironHorizonPassword $ChironHorizonPassword -NoWatch:$NoWatch -DryRun
  & $shell -NoProfile -ExecutionPolicy Bypass -File $frontendScript -DryRun
  exit 0
}

Write-Host "[chiron-horizon-dev] starting backend and frontend in separate windows..." -ForegroundColor Green
Write-Host "[chiron-horizon-dev] backend: RUST_LOG=$RustLog CHIRON_HORIZON_PASSWORD=$ChironHorizonPassword" -ForegroundColor DarkCyan
Write-Host "[chiron-horizon-dev] frontend: http://127.0.0.1:5173" -ForegroundColor DarkCyan

Start-Process -FilePath $shell -ArgumentList $backendArgs -WorkingDirectory $repoRoot
Start-Process -FilePath $shell -ArgumentList $frontendArgs -WorkingDirectory $repoRoot
