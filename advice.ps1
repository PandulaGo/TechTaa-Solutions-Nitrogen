# Fetches portfolio / analysis data from the local app for OpenCode advice.
# Usage:
#   .\advice.ps1                     -> full portfolio summary
#   .\advice.ps1 -Symbol DOGE        -> deep analysis of one coin (candles, indicators, signals)
param(
  [string]$Symbol = "",
  [string]$BaseUrl = "http://127.0.0.1:10061"
)
$ErrorActionPreference = "Stop"

if ($Symbol) {
  $data = Invoke-RestMethod -Uri "$BaseUrl/api/analysis/$($Symbol.ToUpper())"
  $data | ConvertTo-Json -Depth 6
} else {
  $p = Invoke-RestMethod -Uri "$BaseUrl/api/portfolio"
  $p | ConvertTo-Json -Depth 6
}
