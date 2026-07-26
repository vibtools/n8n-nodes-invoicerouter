# ============================================
# InvoiceRouter
# Package.json Auto Updater
# Version: 1.0
# ============================================

$PackageFile = Join-Path $PSScriptRoot "..\package.json"

if (!(Test-Path $PackageFile)) {
    Write-Host ""
    Write-Host "package.json not found."
    exit 1
}

$package = Get-Content $PackageFile -Raw | ConvertFrom-Json

# -------------------------------------------------
# Project Information
# -------------------------------------------------

$package.name = "n8n-nodes-invoice-router"
$package.version = "0.1.0"

$package.description = "Universal Invoice Provider Router for n8n."

$package.license = "MIT"

$package.author = ""

$package.homepage = ""

$package.repository = @{
    type = "git"
    url = ""
}

$package.bugs = @{
    url = ""
}

# -------------------------------------------------
# Node Engine
# -------------------------------------------------

$package.engines = @{
    node = ">=20.15"
}

# -------------------------------------------------
# Keywords
# -------------------------------------------------

$package.keywords = @(
    "n8n",
    "n8n-community-node",
    "invoice",
    "router",
    "automation",
    "billing",
    "stripe",
    "zoho",
    "invoice-ninja",
    "erpnext",
    "xero",
    "quickbooks",
    "odoo"
)

# -------------------------------------------------
# Files
# -------------------------------------------------

$package.files = @(
    "dist",
    "README.md",
    "LICENSE"
)

# -------------------------------------------------
# Save
# -------------------------------------------------

$package | ConvertTo-Json -Depth 100 | Set-Content $PackageFile -Encoding UTF8

Write-Host ""
Write-Host "========================================="
Write-Host " package.json Updated Successfully"
Write-Host "========================================="
Write-Host ""
Write-Host "Project : $($package.name)"
Write-Host "Version : $($package.version)"
Write-Host ""