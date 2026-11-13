param([switch]$Publish)
$cfg = @{}
foreach ($n in '.env.local','.env.production','.env.production.local','.env.vercel.local') {
  $p = Join-Path $PSScriptRoot $n
  if (Test-Path $p) {
    Get-Content $p | ForEach-Object {
      if ($_ -match '^\s*([^#=\s]+)\s*=\s*(.*)$') {
        $v = $matches[2].Trim().Trim('"').Trim("'")
        if ($v) { $cfg[$matches[1]] = $v }
      }
    }
  }
}
$log = "$PSScriptRoot\publish-check.log"
function Log($m) { $l = "$(Get-Date -Format s)  $m"; Write-Host $l; Add-Content $log $l }

$SiteUrl = $cfg.Keys | Where-Object { $_ -match 'SITE_URL|APP_URL|BASE_URL' } | Select-Object -First 1 | ForEach-Object { $cfg[$_] }
if (-not $SiteUrl) { $SiteUrl = "https://YOUR-DOMAIN.com" }
$SiteUrl = $SiteUrl.TrimEnd('/')
Log "Site: $SiteUrl"

$cfg.Keys | Where-Object { $_ -match 'TELEGRAM|META|INSTAGRAM|FACEBOOK|IG_|FB_|THREADS|LINKEDIN|CRON|MARKETING|CHAT_ID' } | Sort-Object | ForEach-Object { Log "  var: $_ (len=$($cfg[$_].Length))" }

# Telegram
$tg = $cfg.Keys | Where-Object { $_ -match 'TELEGRAM.*TOKEN' } | Select-Object -First 1
if ($tg) {
  try { $r = Invoke-RestMethod "https://api.telegram.org/bot$($cfg[$tg])/getMe"; Log "Telegram OK: @$($r.result.username)" }
  catch { Log "Telegram FAIL ($tg): $($_.Exception.Message)" }
} else { Log "Telegram: no token variable found" }

# Meta / Instagram
$metaKeys = $cfg.Keys | Where-Object { $_ -match '(META|INSTAGRAM|FACEBOOK|IG_|FB_).*TOKEN' }
foreach ($k in $metaKeys) {
  try { $r = Invoke-RestMethod "https://graph.facebook.com/me?access_token=$($cfg[$k])"; Log "Meta OK ($k): $($r.name)" }
  catch {
    $msg1 = $_.ErrorDetails.Message
    try { $r = Invoke-RestMethod "https://graph.instagram.com/me?fields=username&access_token=$($cfg[$k])"; Log "Instagram OK ($k): $($r.username)" }
    catch { Log "Meta/IG FAIL ($k): $msg1" }
  }
}
if (-not $metaKeys) { Log "Meta: no token variable found" }

if ($Publish) {
  try {
    $h = @{ Authorization = "Bearer $($cfg['CRON_SECRET'])" }
    $r = Invoke-RestMethod "$SiteUrl/api/marketing/cron" -Headers $h -TimeoutSec 300
    Log ("Cron response: " + ($r | ConvertTo-Json -Compress -Depth 4))
  } catch { Log "Cron FAIL: $($_.Exception.Message)  $($_.ErrorDetails.Message)" }
}
