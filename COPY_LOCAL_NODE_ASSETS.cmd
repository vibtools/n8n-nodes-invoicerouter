@echo off
setlocal
set "SOURCE=D:\VibTools_Workspace\16_Workflow\dev"
set "REPO=D:\VibTools_Workspace\16_Workflow\InvoiceRouter"
set "TARGET=%REPO%\assets\node-cards\v1.0"

if not exist "%SOURCE%" (
  echo ERROR: Source folder not found: %SOURCE%
  exit /b 1
)
if not exist "%REPO%\.git" (
  echo ERROR: Git repository not found: %REPO%
  exit /b 1
)
if not exist "%TARGET%" mkdir "%TARGET%"

call :copyone "Manual Trigger.png" "manual-trigger.png"
call :copyone "google-sheet.png" "google-sheets-provider.png"
call :copyone "Google Sheet email lsit.png" "google-sheets-email-list.png"
call :copyone "Provider Loader.png" "provider-loader.png"
call :copyone "Provider Selector.png" "provider-selector.png"
call :copyone "Invoice Template.png" "invoice-template.png"
call :copyone "Email List.png" "email-list.png"
call :copyone "Request Builder.png" "request-builder.png"
call :copyone "Invoice Sender.png" "invoice-sender.png"
call :copyone "Status Checker.png" "status-checker.png"
call :copyone "Status Manager.png" "status-manager.png"

echo.
echo Node-card copy completed.
exit /b 0

:copyone
if exist "%SOURCE%\%~1" (
  copy /Y "%SOURCE%\%~1" "%TARGET%\%~2" >nul
  echo COPIED: %~2
) else (
  echo MISSING: %~1
)
exit /b 0
