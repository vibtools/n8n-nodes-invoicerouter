# Safely synchronize package-lock.json root metadata with package.json.
# This script intentionally preserves package identity, version, repository,
# scripts, dependencies, and n8n registration instead of overwriting them.
if (-not $env:CI) { Clear-Host }

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot
$PackagePath = "package.json"
$LockPath = "package-lock.json"

if (-not (Test-Path -LiteralPath $PackagePath -PathType Leaf)) {
  Write-Error "package.json not found."
  exit 1
}
if (-not (Test-Path -LiteralPath $LockPath -PathType Leaf)) {
  Write-Error "package-lock.json not found. Run npm install to generate it."
  exit 1
}

try {
  $Package = Get-Content -LiteralPath $PackagePath -Raw | ConvertFrom-Json -ErrorAction Stop
  $Lock = Get-Content -LiteralPath $LockPath -Raw | ConvertFrom-Json -ErrorAction Stop
}
catch {
  Write-Error "package.json or package-lock.json contains invalid JSON."
  exit 1
}

if (-not $Lock.packages.PSObject.Properties['']) {
  Write-Error "package-lock.json does not contain the root package entry."
  exit 1
}

$Root = $Lock.packages.''
foreach ($Property in @('name', 'version', 'license', 'dependencies', 'devDependencies', 'peerDependencies', 'engines', 'funding')) {
  $Root.PSObject.Properties.Remove($Property)
  if ($Package.PSObject.Properties[$Property]) {
    $Root | Add-Member -NotePropertyName $Property -NotePropertyValue $Package.$Property
  }
}

$Lock.name = $Package.name
$Lock.version = $Package.version
$Lock | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $LockPath -Encoding utf8

Write-Host "package-lock.json root metadata synchronized safely." -ForegroundColor Green
Write-Host "Project : $($Package.name)"
Write-Host "Version : $($Package.version)"
exit 0
