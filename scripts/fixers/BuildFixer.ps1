if (-not $env:CI) { Clear-Host }
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $ProjectRoot
tsc -p tsconfig.json
exit $LASTEXITCODE
