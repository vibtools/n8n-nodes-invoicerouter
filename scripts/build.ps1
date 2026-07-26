# ============================================
# InvoiceRouter
# Project Builder
# Version: 2.0.0
# ============================================

Clear-Host

$BuildStart = Get-Date

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " InvoiceRouter Project Builder"
Write-Host " Version 2.0"
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# Project Root
# ------------------------------------------------------------

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

# ------------------------------------------------------------
# Helper
# ------------------------------------------------------------

function Stop-Build {

    param([string]$Message)

    Write-Host ""
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    exit 1

}

# ------------------------------------------------------------
# Validation
# ------------------------------------------------------------

if (!(Test-Path "package.json")) {

    Stop-Build "package.json not found."

}

if (!(Test-Path "node_modules")) {

    Stop-Build "node_modules not found. Run .\scripts\install.ps1"

}

if (!(Get-Command npm -ErrorAction SilentlyContinue)) {

    Stop-Build "npm not found."

}

try {

    $Package = Get-Content package.json -Raw | ConvertFrom-Json

}
catch {

    Stop-Build "package.json is invalid."

}

if ($null -eq $Package.scripts.build) {

    Stop-Build "Build script missing."

}

# ------------------------------------------------------------
# Project Information
# ------------------------------------------------------------

Write-Host "Project"
Write-Host "-----------------------------------------------"

Write-Host ("Name    : {0}" -f $Package.name)
Write-Host ("Version : {0}" -f $Package.version)

Write-Host ""

# ------------------------------------------------------------
# Build
# ------------------------------------------------------------

Write-Host "Building Project..."
Write-Host ""

npm run build

$ExitCode = $LASTEXITCODE

if ($ExitCode -ne 0) {

    Write-Host ""
    Write-Host "==============================================="
    Write-Host " BUILD FAILED" -ForegroundColor Red
    Write-Host "==============================================="

    exit $ExitCode

}

# ------------------------------------------------------------
# Output
# ------------------------------------------------------------

$OutputFolder = $null

if (Test-Path "dist") {

    $OutputFolder = "dist"

}
elseif (Test-Path "build") {

    $OutputFolder = "build"

}

Write-Host ""

if ($OutputFolder) {

    $Files = Get-ChildItem $OutputFolder -Recurse -File

    $FileCount = $Files.Count

    $FolderCount = (
        Get-ChildItem $OutputFolder `
            -Recurse `
            -Directory
    ).Count

    $Size = (
        ($Files | Measure-Object Length -Sum).Sum
    )

    $SizeMB = [Math]::Round($Size / 1MB,2)

    Write-Host "Build Output"
    Write-Host "-----------------------------------------------"

    Write-Host ("Folder      : {0}" -f $OutputFolder)
    Write-Host ("Files       : {0}" -f $FileCount)
    Write-Host ("Folders     : {0}" -f $FolderCount)
    Write-Host ("Size        : {0} MB" -f $SizeMB)

}
else {

    Write-Host "[WARN] No dist/ or build/ folder found." -ForegroundColor Yellow

}

# ------------------------------------------------------------
# Time
# ------------------------------------------------------------

$BuildEnd = Get-Date

$Duration = $BuildEnd - $BuildStart

# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------

Write-Host ""
Write-Host "==============================================="

Write-Host " Build Completed Successfully" -ForegroundColor Green

Write-Host "==============================================="

Write-Host ("Started  : {0}" -f $BuildStart)

Write-Host ("Finished : {0}" -f $BuildEnd)

Write-Host ("Duration : {0:N2} Seconds" -f $Duration.TotalSeconds)

Write-Host ""

exit 0