if (-not $env:CI) { Clear-Host }
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot
$steps = @(
  @{ Name = "Validate"; Command = @("node", "scripts/validate-project.mjs") },
  @{ Name = "Install"; Command = @("npm", "ci") },
  @{ Name = "Format Check"; Command = @("node", "scripts/format.mjs", "--check") },
  @{ Name = "Lint"; Command = @("node", "scripts/lint.mjs") },
  @{ Name = "Type Check"; Command = @("tsc", "--noEmit") },
  @{ Name = "Build"; Command = @("tsc", "-p", "tsconfig.json") },
  @{ Name = "Test"; Command = @("node", "--test", "tests/smoke.test.cjs") }
)
foreach ($step in $steps) {
  Write-Host "[$($step.Name)]" -ForegroundColor Cyan
  & $step.Command[0] $step.Command[1..($step.Command.Count - 1)]
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Write-Host "Bootstrap completed successfully." -ForegroundColor Green
exit 0
