if (-not $env:CI) { Clear-Host }
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot
node scripts/validate-project.mjs
exit $LASTEXITCODE
