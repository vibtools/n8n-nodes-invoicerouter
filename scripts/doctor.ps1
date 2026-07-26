# InvoiceRouter read-only project health checker.
if (-not $env:CI) { Clear-Host }

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot
$Errors = 0
$Warnings = 0

function Show-Result {
  param([bool]$Passed, [string]$Label, [string]$Value = "")
  if ($Passed) {
    Write-Host ("[ OK ] {0,-36} {1}" -f $Label, $Value)
  }
  else {
    Write-Host ("[FAIL] {0,-36} {1}" -f $Label, $Value) -ForegroundColor Red
    $script:Errors++
  }
}

function Show-Warning {
  param([string]$Message)
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
  $script:Warnings++
}

function Read-JsonFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Show-Result $false $Path "Missing"
    return $null
  }
  try {
    $Value = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json -ErrorAction Stop
    Show-Result $true $Path "Valid JSON"
    return $Value
  }
  catch {
    Show-Result $false $Path "Invalid JSON"
    return $null
  }
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " InvoiceRouter Project Doctor" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

$Package = Read-JsonFile "package.json"
$Architecture = Read-JsonFile "manifest/architecture.json"
Read-JsonFile "manifest/auto-fix.json" | Out-Null
Read-JsonFile "manifest/PROJECT_MANIFEST.json" | Out-Null
Read-JsonFile "manifest/release.json" | Out-Null

Write-Host ""
Write-Host "Environment"
Write-Host "-----------------------------------------------"
Show-Result ($null -ne (Get-Command node -ErrorAction SilentlyContinue)) "Node.js"
Show-Result ($null -ne (Get-Command npm -ErrorAction SilentlyContinue)) "npm"
Show-Result ($null -ne (Get-Command git -ErrorAction SilentlyContinue)) "Git"
Show-Result ($null -ne (Get-Command tsc -ErrorAction SilentlyContinue)) "TypeScript"
Show-Result ($PSVersionTable.PSVersion.Major -ge 7) "PowerShell 7+" $PSVersionTable.PSVersion.ToString()

if ($Package -and (Get-Command node -ErrorAction SilentlyContinue)) {
  $NodeVersion = (& node -p "process.versions.node").Trim()
  $NodeMajor = [int]($NodeVersion.Split('.')[0])
  Show-Result ($NodeMajor -eq 24) "Node engine" "$NodeVersion (expected 24.x)"
}

if ($Architecture) {
  Write-Host ""
  Write-Host "Required Directories"
  Write-Host "-----------------------------------------------"
  foreach ($Directory in $Architecture.directories.required) {
    Show-Result (Test-Path -LiteralPath $Directory -PathType Container) $Directory
  }

  Write-Host ""
  Write-Host "Core Nodes"
  Write-Host "-----------------------------------------------"
  foreach ($NodeFolder in $Architecture.nodes.required) {
    $Base = Join-Path "nodes" $NodeFolder
    Show-Result (Test-Path -LiteralPath $Base -PathType Container) $Base
    foreach ($File in $Architecture.nodes.required_files) {
      Show-Result (Test-Path -LiteralPath (Join-Path $Base $File) -PathType Leaf) "$NodeFolder/$File"
    }
  }

  Write-Host ""
  Write-Host "Provider Scaffolds"
  Write-Host "-----------------------------------------------"
  foreach ($Provider in $Architecture.providers.supported) {
    $Base = Join-Path "providers" $Provider
    Show-Result (Test-Path -LiteralPath $Base -PathType Container) $Base
    foreach ($File in $Architecture.providers.required_files) {
      Show-Result (Test-Path -LiteralPath (Join-Path $Base $File) -PathType Leaf) "$Provider/$File"
    }
  }
}

Write-Host ""
Write-Host "Generated Outputs"
Write-Host "-----------------------------------------------"
if ($Package) {
  if (Test-Path -LiteralPath "dist" -PathType Container) {
    foreach ($Output in @($Package.main, $Package.types) + @($Package.n8n.nodes)) {
      Show-Result (Test-Path -LiteralPath $Output -PathType Leaf) $Output
    }
  }
  else {
    Show-Warning "dist is not present; run npm run build before packaging or publishing."
  }
}

Write-Host ""
Write-Host "Canonical Validator"
Write-Host "-----------------------------------------------"
& node scripts/validate-project.mjs
Show-Result ($LASTEXITCODE -eq 0) "npm run validate equivalent"

$FolderCount = (Get-ChildItem -Directory -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '[\\/]node_modules([\\/]|$)' }).Count
$FileCount = (Get-ChildItem -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '[\\/]node_modules([\\/]|$)' }).Count

Write-Host ""
Write-Host "Statistics"
Write-Host "-----------------------------------------------"
Write-Host "Folders  : $FolderCount"
Write-Host "Files    : $FileCount"
if ($Architecture) {
  Write-Host "Nodes    : $($Architecture.nodes.required.Count)"
  Write-Host "Providers: $($Architecture.providers.supported.Count)"
}

Write-Host ""
Write-Host "==============================================="
Write-Host "Warnings : $Warnings" -ForegroundColor Yellow
Write-Host "Errors   : $Errors"
if ($Errors -eq 0) {
  Write-Host "Status   : HEALTHY" -ForegroundColor Green
  exit 0
}
Write-Host "Status   : ATTENTION REQUIRED" -ForegroundColor Red
exit 1
