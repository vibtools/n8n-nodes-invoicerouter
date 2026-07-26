# InvoiceRouter dependency installer.
if (-not $env:CI) { Clear-Host }

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js is not installed. Node.js 24.x is required."
  exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm is not installed."
  exit 1
}

$NodeVersion = (& node -p "process.versions.node").Trim()
$NodeMajor = [int]($NodeVersion.Split('.')[0])
if ($NodeMajor -ne 24) {
  Write-Error "Unsupported Node.js version $NodeVersion. Use Node.js 24.x."
  exit 1
}

Write-Host "Node.js: $NodeVersion"
Write-Host "npm: $(& npm --version)"

if (Test-Path -LiteralPath "package-lock.json" -PathType Leaf) {
  Write-Host "Installing exact locked dependencies with npm ci..."
  & npm ci
}
else {
  Write-Warning "package-lock.json is missing; using npm install."
  & npm install
}

if ($LASTEXITCODE -ne 0) {
  Write-Error "Dependency installation failed."
  exit $LASTEXITCODE
}

& node scripts/validate-project.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Installation completed successfully." -ForegroundColor Green
exit 0
