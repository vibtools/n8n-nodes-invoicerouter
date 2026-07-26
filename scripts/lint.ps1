if (-not $env:CI) { Clear-Host }
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot
node scripts/lint.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
tsc --noEmit
exit $LASTEXITCODE
