# ============================================
# InvoiceRouter
# TypeScript Fixer
# Version: 1.0.0
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "TypeScript Fixer" -ForegroundColor Cyan
Write-Host "---------------------------------------"

# --------------------------------------------------
# Statistics
# --------------------------------------------------

$Fixed   = 0
$Skipped = 0
$Failed  = 0

# --------------------------------------------------
# Load Configuration
# --------------------------------------------------

$ConfigFile = Join-Path $PSScriptRoot "..\..\manifest\auto-fix.json"

if (!(Test-Path $ConfigFile)) {

    Write-Host "Configuration not found." -ForegroundColor Red
    exit 1

}

try {

    $Config = Get-Content `
        $ConfigFile `
        -Raw |
        ConvertFrom-Json

}
catch {

    Write-Host "Invalid configuration file." -ForegroundColor Red
    exit 1

}

# --------------------------------------------------
# package.json
# --------------------------------------------------

if (!(Test-Path "package.json")) {

    Write-Host "package.json not found." -ForegroundColor Red
    exit 1

}

# --------------------------------------------------
# tsconfig.json
# --------------------------------------------------

if (!(Test-Path "tsconfig.json")) {

    Write-Host "tsconfig.json not found." -ForegroundColor Red
    exit 1

}

# --------------------------------------------------
# node_modules
# --------------------------------------------------

if (!(Test-Path "node_modules")) {

    Write-Host "node_modules not found." -ForegroundColor Red
    Write-Host "Run DependencyFixer first." -ForegroundColor Yellow
    exit 1

}

# --------------------------------------------------
# TypeScript Version
# --------------------------------------------------

Write-Host ""
Write-Host "[CHECK] TypeScript"

cmd /c "npx tsc --version"

if ($LASTEXITCODE -ne 0) {

    Write-Host "[FAILED] TypeScript not found." `
        -ForegroundColor Red

    exit 1

}

Write-Host "[PASS]" -ForegroundColor Green

# --------------------------------------------------
# Compile Check
# --------------------------------------------------

Write-Host ""
Write-Host "[CHECK] TypeScript Compile"

cmd /c $Config.commands.typescript

if ($LASTEXITCODE -eq 0) {

    Write-Host "[PASS]" -ForegroundColor Green
    $Skipped++

}
else {

    Write-Host "[FAILED]" -ForegroundColor Yellow
    $Failed++

}

# --------------------------------------------------
# Organize Imports (Optional)
# --------------------------------------------------

if ($Config.typescriptFixer.organizeImports) {

    Write-Host ""
    Write-Host "[INFO] organizeImports is enabled."
    Write-Host "[INFO] Automatic import organization requires an external tool (e.g. VS Code CLI or language service)."

}

# --------------------------------------------------
# Remove Unused Imports (Optional)
# --------------------------------------------------

if ($Config.typescriptFixer.removeUnusedImports) {

    Write-Host ""
    Write-Host "[INFO] removeUnusedImports is enabled."
    Write-Host "[INFO] Automatic unused import removal is not performed by this script."

}

# --------------------------------------------------
# Verify Source Files
# --------------------------------------------------

Write-Host ""
Write-Host "[SCAN] TypeScript Files"

$Files = Get-ChildItem `
    -Path "." `
    -Recurse `
    -Include *.ts,*.tsx `
    -File |
Where-Object {

    $_.FullName -notmatch "\\node_modules\\"

}

$FileCount = $Files.Count

Write-Host ("Files Found : {0}" -f $FileCount)

if ($FileCount -eq 0) {

    Write-Host "No TypeScript files found." `
        -ForegroundColor Yellow

    $Skipped++

}

# --------------------------------------------------
# Summary
# --------------------------------------------------

Write-Host ""
Write-Host "======================================="
Write-Host "TypeScript Fix Summary"
Write-Host "======================================="

Write-Host ("Fixed   : {0}" -f $Fixed)
Write-Host ("Skipped : {0}" -f $Skipped)
Write-Host ("Failed  : {0}" -f $Failed)

Write-Host ""

if ($Failed -eq 0) {

    Write-Host "Status : SUCCESS" `
        -ForegroundColor Green

    exit 0

}
else {

    Write-Host "Status : FAILED" `
        -ForegroundColor Red

    exit 1

}