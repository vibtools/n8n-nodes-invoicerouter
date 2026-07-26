# InvoiceRouter generated-output cleaner.
if (-not $env:CI) { Clear-Host }

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot
$Deleted = 0

$Targets = @(
  "dist",
  "build",
  "coverage",
  "release",
  ".nyc_output",
  ".turbo",
  ".cache",
  ".tmp",
  "temp/backups",
  "logs/automation",
  "logs/build",
  "logs/docs",
  "logs/release"
)

foreach ($Target in $Targets) {
  if (Test-Path -LiteralPath $Target) {
    Remove-Item -LiteralPath $Target -Recurse -Force
    Write-Host "[DELETE] $Target" -ForegroundColor Green
    $Deleted++
  }
}

foreach ($Root in @("logs", "temp")) {
  if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
    New-Item -ItemType Directory -Path $Root | Out-Null
  }
}

Get-ChildItem -Path "." -File -Include "*.tgz", "*.log", "*.tmp", "*.cache" -ErrorAction SilentlyContinue |
  ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Force
    Write-Host "[DELETE] $($_.Name)" -ForegroundColor Green
    $Deleted++
  }

Write-Host "Clean completed. Removed $Deleted generated target(s)." -ForegroundColor Green
exit 0
