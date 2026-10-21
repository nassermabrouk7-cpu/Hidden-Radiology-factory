param([string]$Token = "")
Set-Location E:\hidden-radiology-factory
Write-Host "=== Auto Fix Facebook ==="

if (-not $Token) {
  $line = Get-Content .env.local | Where-Object { $_ -like "*FACEBOOK_PAGE_ACCESS_TOKEN*" } | Select-Object -First 1
  if ($line -and $line -notlike "*[SENSITIVE]*") {
    $Token = $line.Split("=",2)[1].Trim().Trim('"').Trim("'").Trim()
  }
}

if (-not $Token -or $Token -like "*SENSITIVE*" -or $Token.Length -lt 20) {
  Write-Host "Token hidden [SENSITIVE] - Open dashboard:"
  Write-Host "https://vercel.com/hiddenradiologymedia-6907s-projects/hidden-radiology-factory/settings/environment-variables"
  $Token = Read-Host "Paste FACEBOOK_PAGE_ACCESS_TOKEN"
  $Token = $Token.Trim().Trim('"').Trim("'")
}

Write-Host "Token length: $($Token.Length)"

try {
  $data = Invoke-RestMethod -Uri "https://graph.facebook.com/v20.0/me/accounts?access_token=$Token" -ErrorAction Stop
  Write-Host "Pages found:"
  $data.data | Format-Table name, id -AutoSize
  
  $targetPage = $data.data | Where-Object { $_.name -like "*Hidden*" } | Select-Object -First 1
  if (-not $targetPage) { $targetPage = $data.data[0] }
  $realPageId = $targetPage.id
  Write-Host "REAL Page ID: $realPageId - $($targetPage.name)" -ForegroundColor Green
  
  if ($realPageId -eq "1080854664848106") {
    Write-Host "This is App ID not Page ID!" -ForegroundColor Red
    exit 1
  }
} catch {
  Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host $_.ErrorDetails.Message
  exit 1
}

Write-Host "Updating Vercel FACEBOOK_PAGE_ID..."
try { vercel env rm FACEBOOK_PAGE_ID production --yes | Out-Null } catch {}
Set-Content -Path env_temp.txt -Value $realPageId -NoNewline
Get-Content env_temp.txt | vercel env add FACEBOOK_PAGE_ID production --force
Remove-Item env_temp.txt -Force
Write-Host "Updated FACEBOOK_PAGE_ID = $realPageId" -ForegroundColor Green

Write-Host "Deploying..."
vercel --prod --yes

Write-Host "Testing after 10s..."
Start-Sleep -Seconds 10
try {
  $testBody = '{"bookId":"5b669afb-7693-48a5-a0e2-e82e194ba405","channels":["facebook"]}'
  $result = Invoke-RestMethod -Uri "https://hidden-radiology-project-chi.vercel.app/api/test-publish" -Method POST -Body $testBody -ContentType "application/json" -TimeoutSec 30
  $result | ConvertTo-Json -Depth 5 | Write-Host
} catch {
  Write-Host "Test failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host "DONE"
