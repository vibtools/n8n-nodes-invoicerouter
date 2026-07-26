# ============================================
# InvoiceRouter
# Format Source Code
# Version: 1.0
# ============================================

Clear-Host

Write-Host ""
Write-Host "==========================================="
Write-Host "      InvoiceRouter Code Formatter"
Write-Host "==========================================="
Write-Host ""

# ------------------------------------------------------------
# Project Root
# ------------------------------------------------------------

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Set-Location $ProjectRoot

# ------------------------------------------------------------
# Check package.json
# ------------------------------------------------------------

if (!(Test-Path "package.json")) {

    Write-Host "[ERROR] package.json not found." -ForegroundColor Red
    exit 1

}

# ------------------------------------------------------------
# Check node_modules
# ------------------------------------------------------------

if (!(Test-Path "node_modules")) {

    Write-Host "[ERROR] node_modules not found." -ForegroundColor Red
    Write-Host ""
    Write-Host "Run:"
    Write-Host "    .\scripts\install.ps1"
    Write-Host ""
    exit 1

}

# ------------------------------------------------------------
# Check Prettier
# ------------------------------------------------------------

$Prettier = Join-Path $ProjectRoot "node_modules\.bin\prettier.cmd"

if (!(Test-Path $Prettier)) {

    Write-Host "[ERROR] Prettier is not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Run:"
    Write-Host "    npm install"
    Write-Host ""
    exit 1

}

# ------------------------------------------------------------
# Files
# ------------------------------------------------------------

$Targets = @(
    "nodes",
    "providers",
    "shared",
    "tests",
    "scripts",
    "*.ts",
    "*.js",
    "*.json",
    "*.md"
)

# ------------------------------------------------------------
# Run Formatter
# ------------------------------------------------------------

Write-Host "Formatting project..."
Write-Host ""

& $Prettier `
    --write `
    "nodes/**/*.ts" `
    "providers/**/*.ts" `
    "shared/**/*.ts" `
    "tests/**/*.ts" `
    "*.json" `
    "*.md"

$ExitCode = $LASTEXITCODE

Write-Host ""

# ------------------------------------------------------------
# Result
# ------------------------------------------------------------

if ($ExitCode -eq 0) {

    Write-Host "===========================================" -ForegroundColor Green
    Write-Host " Formatting Completed Successfully" -ForegroundColor Green
    Write-Host "===========================================" -ForegroundColor Green

}
else {

    Write-Host "===========================================" -ForegroundColor Red
    Write-Host " Formatting Failed" -ForegroundColor Red
    Write-Host "===========================================" -ForegroundColor Red

}

Write-Host ""

exit $ExitCode