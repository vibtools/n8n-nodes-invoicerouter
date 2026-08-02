<#
InvoiceRouter Dev Clean + Verify Script
Use from project root:

PowerShell:
  powershell -ExecutionPolicy Bypass -File scripts/dev-clean-verify.ps1

Optional full dependency reset:
  powershell -ExecutionPolicy Bypass -File scripts/dev-clean-verify.ps1 -CleanNodeModules

Optional skip format write:
  powershell -ExecutionPolicy Bypass -File scripts/dev-clean-verify.ps1 -SkipFormat
#>

param(
    [switch]$CleanNodeModules,
    [switch]$SkipFormat
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "PASS: $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "WARN: $Message" -ForegroundColor Yellow
}

function Remove-PathSafe {
    param([string]$Path)

    if (Test-Path $Path) {
        Remove-Item -Recurse -Force $Path
        Write-Ok "Removed $Path"
    }
}

Write-Step "Checking project root"

if (!(Test-Path "package.json")) {
    throw "package.json not found. Run this script from the InvoiceRouter project root."
}

$package = Get-Content "package.json" -Raw | ConvertFrom-Json

if ($package.name -ne "n8n-nodes-invoicerouter") {
    throw "This does not look like InvoiceRouter. Found package name: $($package.name)"
}

Write-Ok "Project detected: $($package.name)@$($package.version)"

Write-Step "Checking required files"

$requiredFiles = @(
    "README.md",
    "CHANGELOG.md",
    "ARCHITECTURE.md",
    "PROJECT_STRUCTURE.md",
    "vibproject.ygit",
    "docs/docs.minifest.ygit",
    "package-lock.json",
    "tsconfig.json"
)

foreach ($file in $requiredFiles) {
    if (!(Test-Path $file)) {
        throw "Required file missing: $file"
    }
}

Write-Ok "Required root/docs files exist"

Write-Step "Checking private project folder ignore rule"

if (Test-Path ".gitignore") {
    $gitignore = Get-Content ".gitignore" -Raw

    if ($gitignore -notmatch "(?m)^project/$") {
        throw ".gitignore does not contain required private folder rule: project/"
    }

    Write-Ok "project/ is ignored"
} else {
    throw ".gitignore not found"
}

Write-Step "Cleaning generated/release artifacts"

Remove-PathSafe "dist"
Remove-PathSafe ".turbo"
Remove-PathSafe ".cache"
Remove-PathSafe "coverage"
Remove-PathSafe "tmp"
Remove-PathSafe "temp"
Remove-PathSafe ".pytest_cache"

Get-ChildItem -Path "." -Filter "*.tgz" -File -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item -Force $_.FullName
    Write-Ok "Removed $($_.Name)"
}

Get-ChildItem -Path "." -Filter "*.swp" -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item -Force $_.FullName
    Write-Ok "Removed swap file $($_.FullName)"
}

Get-ChildItem -Path "." -Filter "npm-debug.log*" -File -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item -Force $_.FullName
    Write-Ok "Removed $($_.Name)"
}

if ($CleanNodeModules) {
    Write-Step "Cleaning node_modules"
    Remove-PathSafe "node_modules"
}

Write-Step "Installing dependencies"

if ($CleanNodeModules -or !(Test-Path "node_modules")) {
    npm.cmd ci
} else {
    Write-Warn "node_modules exists. Skipping npm ci full reset. Use -CleanNodeModules for full clean install."
}

Write-Step "Formatting"

if ($SkipFormat) {
    Write-Warn "Skipping npm run format"
} else {
    npm.cmd run format
}

Write-Step "Running full verify"

npm.cmd run verify

Write-Step "Running n8n package diagnostic"

node scripts\diagnose-n8n-package.mjs .

Write-Step "Running provider template validation"

npm.cmd run validate:templates

Write-Step "Building npm package"

npm.cmd pack

Write-Step "Checking generated package"

$tgz = Get-ChildItem -Path "." -Filter "n8n-nodes-invoicerouter-*.tgz" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($null -eq $tgz) {
    throw "npm pack did not create a .tgz package"
}

Write-Ok "Package created: $($tgz.Name)"

Write-Step "Checking git status"

if (Test-Path ".git") {
    git status --short

    $trackedProject = git ls-files project 2>$null

    if ($trackedProject) {
        throw "project/ has tracked files. Remove them from git index before publish: git rm -r --cached project"
    }

    Write-Ok "project/ is not tracked"
} else {
    Write-Warn "No .git folder found. Git status skipped."
}

Write-Step "Final result"

Write-Ok "Clean + verify completed successfully"
Write-Host ""
Write-Host "Next safe commands:" -ForegroundColor Cyan
Write-Host "  1. Check the generated .tgz if needed"
Write-Host "  2. Delete the .tgz before committing source"
Write-Host "  3. Run the same script in repo/release folder"
Write-Host "  4. Then final forensic audit"