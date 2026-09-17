# Dot-source this file to complete Chiron Horizon database Make targets and DB=<product>@<version> values.

$script:ChironHorizonMakeRepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path

function Get-ChironHorizonMakeDatabaseSelector {
    & node (Join-Path $script:ChironHorizonMakeRepositoryRoot 'scripts\database-env.mjs') selectors 2>$null
}

function Get-ChironHorizonMakeTarget {
    & node (Join-Path $script:ChironHorizonMakeRepositoryRoot 'scripts\database-env.mjs') make-targets 2>$null
}

function New-ChironHorizonMakeCompletionResult {
    param([string]$Value, [string]$ToolTip = $Value)
    [System.Management.Automation.CompletionResult]::new(
        $Value,
        $Value,
        [System.Management.Automation.CompletionResultType]::ParameterValue,
        $ToolTip
    )
}

$script:ChironHorizonMakeDatabaseTargets = @('db', 'db-verify', 'db-down', 'db-reset')

$script:ChironHorizonMakeNativeCompleter = {
    param($wordToComplete, $commandAst, $cursorPosition)

    $elements = @($commandAst.CommandElements | ForEach-Object { $_.Extent.Text })
    $target = if ($elements.Count -gt 1) { $elements[1] } else { '' }
    $currentPath = (Resolve-Path -LiteralPath (Get-Location)).Path

    if (-not [StringComparer]::OrdinalIgnoreCase.Equals($currentPath, $script:ChironHorizonMakeRepositoryRoot)) { return }

    if ($elements.Count -le 2) {
        Get-ChironHorizonMakeTarget |
            Where-Object { $_ -like "$wordToComplete*" } |
            ForEach-Object { New-ChironHorizonMakeCompletionResult $_ 'Make target' }
        return
    }

    if ($target -notin $script:ChironHorizonMakeDatabaseTargets) { return }
    if ($wordToComplete -like 'DB=*') {
        $prefix = 'DB='
        Get-ChironHorizonMakeDatabaseSelector |
            Where-Object { "$prefix$_" -like "$wordToComplete*" } |
            ForEach-Object { New-ChironHorizonMakeCompletionResult "$prefix$_" 'Database recipe' }
        return
    }
    if ($wordToComplete -like 'CONFIRM=*') {
        New-ChironHorizonMakeCompletionResult 'CONFIRM=1' 'Required by db-reset'
        return
    }

    $parameters = @('DB=', 'DB_BIND_ADDRESS=', 'DB_PORT=', 'DB_PASSWORD=')
    if ($target -eq 'db-reset') { $parameters += 'CONFIRM=1' }
    $parameters |
        Where-Object { $_ -like "$wordToComplete*" } |
        ForEach-Object { New-ChironHorizonMakeCompletionResult $_ 'Chiron Horizon database parameter' }
}

$register = Get-Command Register-ArgumentCompleter
if ($register.Parameters.ContainsKey('Native')) {
    Register-ArgumentCompleter -Native -CommandName make -ScriptBlock $script:ChironHorizonMakeNativeCompleter
} else {
    Register-ArgumentCompleter -CommandName make -ScriptBlock {
        param($commandName, $parameterName, $wordToComplete, $commandAst, $fakeBoundParameters)
        & $script:ChironHorizonMakeNativeCompleter $wordToComplete $commandAst $null
    }
}
