if (-not $env:CI) { Clear-Host }
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

try {
  $Config = Get-Content "manifest/auto-fix.json" -Raw | ConvertFrom-Json -ErrorAction Stop
}
catch {
  Write-Error "manifest/auto-fix.json is invalid."
  exit 2
}

if (-not $Config.enabled -or -not $Config.autoFix.enabled) {
  Write-Host "Auto-fix is disabled."
  exit 0
}

$LogFolder = Join-Path $ProjectRoot $Config.autoFix.reportDirectory
New-Item -ItemType Directory -Force -Path $LogFolder | Out-Null
$ReportPath = Join-Path $LogFolder "auto-fix-report.md"
$Started = Get-Date
$Results = [System.Collections.Generic.List[string]]::new()

if ($Config.autoFix.backupBeforeFix -and $Config.backup.enabled) {
  $BackupRoot = Join-Path $ProjectRoot $Config.backup.directory
  $BackupPath = Join-Path $BackupRoot (Get-Date -Format "yyyyMMdd-HHmmss")
  New-Item -ItemType Directory -Force -Path $BackupPath | Out-Null
  foreach ($Item in @("package.json", "package-lock.json", "tsconfig.json", ".github", "manifest", "scripts")) {
    if (Test-Path -LiteralPath $Item) {
      Copy-Item -LiteralPath $Item -Destination $BackupPath -Recurse -Force
    }
  }
  $Results.Add("- Backup: $BackupPath")
}

$HostExecutable = (Get-Process -Id $PID).Path
$Failed = 0
foreach ($Fixer in ($Config.fixers | Sort-Object priority)) {
  if (-not $Fixer.enabled) { continue }
  if (-not (Test-Path -LiteralPath $Fixer.script -PathType Leaf)) {
    $Results.Add("- FAIL: $($Fixer.name) (missing script)")
    $Failed++
    if (-not $Config.autoFix.continueOnError) { break }
    continue
  }

  if ($Config.autoFix.dryRun) {
    $Results.Add("- DRY RUN: $($Fixer.name)")
    continue
  }

  & $HostExecutable -NoProfile -ExecutionPolicy Bypass -File $Fixer.script
  if ($LASTEXITCODE -eq 0) {
    $Results.Add("- PASS: $($Fixer.name)")
  }
  else {
    $Results.Add("- FAIL: $($Fixer.name) (exit $LASTEXITCODE)")
    $Failed++
    if (-not $Config.autoFix.continueOnError) { break }
  }
}

@"
# Auto-Fix Report

Started: $($Started.ToString('yyyy-MM-dd HH:mm:ss K'))
Completed: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss K'))
Failures: $Failed

$($Results -join "`n")
"@ | Set-Content -LiteralPath $ReportPath -Encoding utf8

if ($Failed -gt 0) { exit 2 }
Write-Host "Auto-fix completed successfully." -ForegroundColor Green
exit 0
