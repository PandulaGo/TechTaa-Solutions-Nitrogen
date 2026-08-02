# Nightly Google Drive backup. Register with Task Scheduler:
#   schtasks /create /tn "CryptoBackup" /tr "powershell -ExecutionPolicy Bypass -File <this path>" /sc daily /st 02:00
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node scripts/run-nightly.mjs
} finally {
  Pop-Location
}
