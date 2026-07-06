# Reliability stress test for Deep Explore on CollabCanvas via ATTACH mode (no password).
# Prereq: run start-chrome-attach.bat and sign into CollabCanvas once (Chrome on debug port 9222).
# Runs the full login+tour+draw flow N times back-to-back and reports a pass-rate table.
param(
  [int]$Runs = 5,
  [string]$Url = "https://real-time-collaborative-digital-can.vercel.app",
  [string]$Api = "http://localhost:5000/api/v1"
)

# Sanity: is the debug Chrome actually reachable?
try { Invoke-RestMethod -Uri "http://localhost:9222/json/version" -TimeoutSec 3 | Out-Null }
catch { Write-Host "ERROR: Chrome debug port 9222 not reachable. Run start-chrome-attach.bat first." -ForegroundColor Red; exit 1 }

$results = @()
for ($run = 1; $run -le $Runs; $run++) {
  Write-Host "`n=== RUN $run / $Runs ===" -ForegroundColor Cyan
  $body = @{ targetUrl = $Url; useRealChrome = $true; maxSections = 10 } | ConvertTo-Json
  try { Invoke-RestMethod -Uri "$Api/explore/deep" -Method Post -ContentType "application/json" -Body $body | Out-Null }
  catch { Write-Host "  start failed: $($_.Exception.Message)" -ForegroundColor Red; $results += [pscustomobject]@{ Run=$run; Status="start-fail"; Steps=0; Drew=$false; Sec=0 }; continue }

  $t0 = Get-Date; $final = $null; $last = ""
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Seconds 3
    try {
      $r = Invoke-RestMethod -Uri "$Api/explore/deep/result" -TimeoutSec 4
      $msg = "$($r.status.status) | $($r.status.message)"
      if ($msg -ne $last) { Write-Host ("  [{0,3}s] {1}" -f [math]::Round(((Get-Date)-$t0).TotalSeconds), $msg); $last = $msg }
      if ($r.status.status -eq 'complete' -or $r.status.status -eq 'error') { $final = $r; break }
    } catch {}
  }

  if ($null -eq $final) {
    $results += [pscustomobject]@{ Run=$run; Status="timeout"; Steps=0; Drew=$false; Sec=0 }
  } else {
    $visited = @($final.result.visited)
    $drew = [bool]($visited | Where-Object { $_ -match 'drew' })
    $pass = ($final.status.status -eq 'complete') -and ($final.result.videoPath) -and ($visited.Count -gt 3)
    $results += [pscustomobject]@{
      Run    = $run
      Status = if ($pass) { "PASS" } else { "FAIL($($final.status.status))" }
      Steps  = $final.result.steps
      Drew   = $drew
      Sec    = [math]::Round($final.result.durationSec, 1)
    }
  }
  Start-Sleep -Seconds 2  # let deepBusy clear
}

Write-Host "`n================ SUMMARY ================" -ForegroundColor Green
$results | Format-Table -AutoSize
$passes = @($results | Where-Object { $_.Status -eq 'PASS' }).Count
$drew   = @($results | Where-Object { $_.Drew }).Count
Write-Host ("Pass rate: {0}/{1}   |   Drew on canvas: {2}/{1}" -f $passes, $Runs, $drew) -ForegroundColor Yellow
