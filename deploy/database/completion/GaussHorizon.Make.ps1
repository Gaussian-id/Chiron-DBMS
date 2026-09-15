# Dot-source this file to complete Gauss Horizon database Make targets and DB=<product>@<version> values.

$script:GaussHorizonMakeRepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path

function Get-GaussHorizonMakeDatabaseSelector {
    & node (Join-Path $script:GaussHorizonMakeRepositoryRoot 'scripts\database-env.mjs') selectors 2>$null
}

function Get-GaussHorizonMakeTarget {
    & node (Join-Path $script:GaussHorizonMakeRepositoryRoot 'scripts\database-env.mjs') make-targets 2>$null
}

function New-GaussHorizonMakeCompletionResult {
    param([string]$Value, [string]$ToolTip = $Value)
    [System.Management.Automation.CompletionResult]::new(
        $Value,
        $Value,
        [System.Management.Automation.CompletionResultType]::ParameterValue,
        $ToolTip
    )
}

$script:GaussHorizonMakeDatabaseTargets = @('db', 'db-verify', 'db-down', 'db-reset')

$script:GaussHorizonMakeNativeCompleter = {
    param($wordToComplete, $commandAst, $cursorPosition)

    $elements = @($commandAst.CommandElements | ForEach-Object { $_.Extent.Text })
    $target = if ($elements.Count -gt 1) { $elements[1] } else { '' }
    $currentPath = (Resolve-Path -LiteralPath (Get-Location)).Path

    if (-not [StringComparer]::OrdinalIgnoreCase.Equals($currentPath, $script:GaussHorizonMakeRepositoryRoot)) { return }

    if ($elements.Count -le 2) {
        Get-GaussHorizonMakeTarget |
            Where-Object { $_ -like "$wordToComplete*" } |
            ForEach-Object { New-GaussHorizonMakeCompletionResult $_ 'Make target' }
        return
    }

    if ($target -notin $script:GaussHorizonMakeDatabaseTargets) { return }
    if ($wordToComplete -like 'DB=*') {
        $prefix = 'DB='
        Get-GaussHorizonMakeDatabaseSelector |
            Where-Object { "$prefix$_" -like "$wordToComplete*" } |
            ForEach-Object { New-GaussHorizonMakeCompletionResult "$prefix$_" 'Database recipe' }
        return
    }
    if ($wordToComplete -like 'CONFIRM=*') {
        New-GaussHorizonMakeCompletionResult 'CONFIRM=1' 'Required by db-reset'
        return
    }

    $parameters = @('DB=', 'DB_BIND_ADDRESS=', 'DB_PORT=', 'DB_PASSWORD=')
    if ($target -eq 'db-reset') { $parameters += 'CONFIRM=1' }
    $parameters |
        Where-Object { $_ -like "$wordToComplete*" } |
        ForEach-Object { New-GaussHorizonMakeCompletionResult $_ 'Gauss Horizon database parameter' }
}

$register = Get-Command Register-ArgumentCompleter
if ($register.Parameters.ContainsKey('Native')) {
    Register-ArgumentCompleter -Native -CommandName make -ScriptBlock $script:GaussHorizonMakeNativeCompleter
} else {
    Register-ArgumentCompleter -CommandName make -ScriptBlock {
        param($commandName, $parameterName, $wordToComplete, $commandAst, $fakeBoundParameters)
        & $script:GaussHorizonMakeNativeCompleter $wordToComplete $commandAst $null
    }
}
