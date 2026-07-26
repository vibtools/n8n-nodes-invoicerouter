if (-not $env:CI) { Clear-Host }
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot
if (Test-Path dist) { Remove-Item dist -Recurse -Force }
tsc -p tsconfig.json
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (-not (Test-Path dist/index.js)) { Write-Error "dist/index.js was not generated."; exit 1 }
Write-Host "Build completed successfully." -ForegroundColor Green
exit 0
