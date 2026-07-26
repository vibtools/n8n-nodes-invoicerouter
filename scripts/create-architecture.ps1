if (-not $env:CI) { Clear-Host }
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot
node scripts/validate-project.mjs
if ($LASTEXITCODE -ne 0) {
  Write-Error "Architecture is incomplete. Restore the protected files from version control or the audited archive."
  exit $LASTEXITCODE
}
Write-Host "Architecture already exists and is valid." -ForegroundColor Green
exit 0
