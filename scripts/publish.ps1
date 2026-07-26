if (-not $env:CI) { Clear-Host }
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot
if (-not (Test-Path dist/index.js)) { Write-Error "Build output is missing. Run npm run build."; exit 1 }
if (-not $env:NODE_AUTH_TOKEN) { Write-Error "NODE_AUTH_TOKEN is not set."; exit 1 }
npm publish --access public
exit $LASTEXITCODE
