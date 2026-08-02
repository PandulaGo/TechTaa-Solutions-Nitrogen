# Starts the app automatically at logon (hidden window) so it runs 24/7.
# Run once:  powershell -ExecutionPolicy Bypass -File .\scripts\install-autostart.ps1
$ErrorActionPreference = "Stop"
$root = (Split-Path -Parent $PSScriptRoot) | Split-Path -Parent
$node = (Get-Command node).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$root\scripts\start.mjs`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Days 999)
Register-ScheduledTask -TaskName "CryptoIncomeAssistant" -Action $action -Trigger $trigger -Settings $settings -Description "Crypto Income Assistant (portfolio + 24/7 scanner + Discord alerts)" -Force
Write-Output "Auto-start installed. Runs at every Windows logon."
Write-Output "Remove later with:  Unregister-ScheduledTask -TaskName CryptoIncomeAssistant"
