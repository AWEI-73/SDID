param(
    [string]$Iteration,
    [string]$Story,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$homeScript = Join-Path $scriptRoot 'sdid-core\home.cjs'
$projectRoot = (Get-Location).Path

$args = @($homeScript, "--target=$projectRoot")
if ($Iteration) { $args += "--iteration=$Iteration" }
if ($Story) { $args += "--story=$Story" }
if ($Json) { $args += '--json' }

& node @args
