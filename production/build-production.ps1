<#
  Edufy Academy: production build, checks and handover package.

  Run from the project root (the folder that contains package.json, server.ts and app\):

      powershell -ExecutionPolicy Bypass -File production\build-production.ps1

  What it does (nothing is deployed, uploaded or deleted outside the output folder):
    1. Checks Node/npm and installed dependencies (website + app)
    2. Checks environment settings, printing variable NAMES only and never values
    3. Website: TypeScript check, tests, production build (vite) + backend build (esbuild)
    4. Scans the built website for secret keys, localhost addresses and source maps
    5. Starts the built backend for a few seconds and checks /api/health and page routes
    6. App: TypeScript check, tests, expo-doctor, Expo login status
    7. Creates Edufy-Academy-Production\ and Edufy-Academy-Production.zip
       (no node_modules, no .env files, no keystores)

  Options:
    -SkipMobile      skip the mobile-app checks
    -SkipServerTest  skip starting the built backend
    -SiteUrl         public website address  (default https://edufyacademy.com)
    -ApiUrl          public API address      (default https://api.edufyacademy.com)

  Hostinger output (Business plan: static website + Node.js web app on a sub-domain):
    upload-ready\hostinger-website-public_html.zip  → extract into public_html of edufyacademy.com
    upload-ready\hostinger-api-nodejs.zip           → upload as the Node.js web app on api.edufyacademy.com
#>
param([switch]$SkipMobile, [switch]$SkipServerTest, [string]$SiteUrl = 'https://edufyacademy.com', [string]$ApiUrl = 'https://api.edufyacademy.com')
$SiteUrl = $SiteUrl.TrimEnd('/')
$ApiUrl = $ApiUrl.TrimEnd('/') -replace '/api$', ''
if ($SiteUrl -notmatch '^https://[^/\s]+$' -or $ApiUrl -notmatch '^https://[^/\s]+$') {
  Write-Host "SiteUrl and ApiUrl must be https:// addresses without a path (got '$SiteUrl', '$ApiUrl')." -ForegroundColor Red
  exit 1
}

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
if (-not (Test-Path (Join-Path $Root 'server.ts')) -or -not (Test-Path (Join-Path $Root 'app\package.json'))) {
  Write-Host "Run this script from the Edufy project (production\build-production.ps1 inside it)." -ForegroundColor Red
  exit 1
}

$Out = Join-Path $Root 'Edufy-Academy-Production'
$Zip = Join-Path $Root 'Edufy-Academy-Production.zip'
if (Test-Path $Out) { Remove-Item -Recurse -Force $Out }
if (Test-Path $Zip) { Remove-Item -Force $Zip }
$LogDir = Join-Path $Out 'documentation\build-logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$Results = New-Object System.Collections.ArrayList
function Add-Result($Area, $Check, $Status, $Note) {
  [void]$Results.Add([pscustomobject]@{ Area = $Area; Check = $Check; Status = $Status; Note = $Note })
  $color = switch -Wildcard ($Status) { 'PASS' { 'Green' } 'WARN*' { 'Yellow' } 'BLOCKED' { 'Yellow' } 'INFO' { 'Gray' } default { 'Red' } }
  Write-Host ("  [{0}] {1} {2}" -f $Status, $Check, $(if ($Note) { "- $Note" } else { '' })) -ForegroundColor $color
}

function Run-Step($Area, $Name, $Dir, $Cmd) {
  Write-Host "`n=== $Area : $Name ===" -ForegroundColor Cyan
  $log = Join-Path $LogDir ((($Area + '-' + $Name) -replace '[^A-Za-z0-9]+', '-').ToLower() + '.log')
  Push-Location $Dir
  $output = & cmd /c "$Cmd 2>&1"
  $code = $LASTEXITCODE
  Pop-Location
  ("> $Cmd", "(in $Dir)", "") + $output | Out-File -FilePath $log -Encoding utf8
  $output | Select-Object -Last 12 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
  if ($code -eq 0) { Add-Result $Area $Name 'PASS' '' } else { Add-Result $Area $Name 'FAIL' "exit code $code, see build-logs\$(Split-Path $log -Leaf)" }
  return ($code -eq 0)
}

# Reads KEY=VALUE files. Values stay in memory and are never printed.
function Read-EnvFiles([string[]]$Files) {
  $map = @{}
  foreach ($f in $Files) {
    if (-not (Test-Path $f)) { continue }
    foreach ($line in Get-Content $f) {
      if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $map[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
      }
    }
  }
  return $map
}
$IsPlaceholder = { param($v) (-not $v) -or ($v -match 'your-project|YOUR-PROJECT|your[-_]|REPLACE_WITH|xxxxxxxx|placeholder') }
$DevAddress = '(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.|//10\.)'

Write-Host "Edufy Academy production build: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor White

# ---------------------------------------------------------------- 1. Tooling
Run-Step 'Tooling' 'node version' $Root 'node --version' | Out-Null
Run-Step 'Tooling' 'npm version' $Root 'npm --version' | Out-Null
$nodeMajor = 0; try { $nodeMajor = [int]((node --version) -replace '^v(\d+).*', '$1') } catch {}
if ($nodeMajor -lt 20) { Add-Result 'Tooling' 'Node.js 20 or newer' 'FAIL' "found v$nodeMajor; install Node.js 22 LTS" } else { Add-Result 'Tooling' 'Node.js 20 or newer' 'PASS' "v$nodeMajor" }

if (-not (Test-Path (Join-Path $Root 'node_modules'))) { Run-Step 'Website' 'npm ci (install)' $Root 'npm ci --no-audit --no-fund' | Out-Null }
Run-Step 'Website' 'dependencies installed (npm ls)' $Root 'npm ls --depth=0' | Out-Null

# ---------------------------------------------------------------- 2. Website environment
Write-Host "`n=== Website : environment (names only) ===" -ForegroundColor Cyan
$webEnv = Read-EnvFiles @('.env', '.env.local', '.env.production', '.env.production.local')
$supaUrl = $webEnv['VITE_SUPABASE_URL']
$supaKey = if ($webEnv['VITE_SUPABASE_PUBLISHABLE_KEY']) { $webEnv['VITE_SUPABASE_PUBLISHABLE_KEY'] } else { $webEnv['VITE_SUPABASE_ANON_KEY'] }
if ((& $IsPlaceholder $supaUrl) -or ($supaUrl -notmatch '^https://[a-z0-9-]+\.supabase\.(co|in)/?$')) { Add-Result 'Website env' 'VITE_SUPABASE_URL' 'FAIL' 'missing or not https://<ref>.supabase.co' } else { Add-Result 'Website env' 'VITE_SUPABASE_URL' 'PASS' 'set' }
if (& $IsPlaceholder $supaKey) { Add-Result 'Website env' 'VITE_SUPABASE_PUBLISHABLE_KEY' 'FAIL' 'missing' }
elseif ($supaKey -match '^sb_secret_|service_role') { Add-Result 'Website env' 'VITE_SUPABASE_PUBLISHABLE_KEY' 'FAIL' 'a SECRET key is configured as the public key' }
else { Add-Result 'Website env' 'VITE_SUPABASE_PUBLISHABLE_KEY' 'PASS' 'set (public key)' }
$secretVite = @($webEnv.Keys | Where-Object { $_ -like 'VITE_*' -and $_ -match 'SECRET|SERVICE|PRIVATE|PASSWORD' })
if ($secretVite.Count) { Add-Result 'Website env' 'no secrets in VITE_ variables' 'FAIL' ($secretVite -join ', ') } else { Add-Result 'Website env' 'no secrets in VITE_ variables' 'PASS' '' }
$devVite = @($webEnv.Keys | Where-Object { $_ -like 'VITE_*' -and $webEnv[$_] -match $DevAddress })
if ($devVite.Count) { Add-Result 'Website env' 'no localhost in VITE_ variables' 'FAIL' ($devVite -join ', ') } else { Add-Result 'Website env' 'no localhost in VITE_ variables' 'PASS' '' }
foreach ($n in 'SUPABASE_SERVICE_ROLE_KEY', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'ADILO_PUBLIC_KEY', 'ADILO_SECRET_KEY') {
  if (& $IsPlaceholder $webEnv[$n]) { Add-Result 'Backend env (local .env)' $n 'WARN' 'not set locally; must be set on the production server' } else { Add-Result 'Backend env (local .env)' $n 'PASS' 'set locally; enter the same value on the production server' }
}
if ($webEnv['RAZORPAY_KEY_ID'] -like 'rzp_test_*') { Add-Result 'Backend env (local .env)' 'Razorpay mode' 'WARN' 'TEST keys locally; use rzp_live_ keys on the production server' }

# ---------------------------------------------------------------- 3. Website checks + build
Run-Step 'Website' 'TypeScript check (tsc --noEmit)' $Root 'npx tsc --noEmit' | Out-Null
Run-Step 'Website' 'unit tests (npm test)' $Root 'npm test' | Out-Null
Run-Step 'Backend' 'push logic tests' $Root 'npx tsx --test tests/pushLogic.test.ts' | Out-Null
$built = Run-Step 'Website' 'production build (vite build + server build)' $Root 'npm run build'

# ---------------------------------------------------------------- 4. Scan the build
$Dist = Join-Path $Root 'dist'
if ($built -and (Test-Path (Join-Path $Dist 'index.html'))) {
  Write-Host "`n=== Website : scan dist ===" -ForegroundColor Cyan
  $files = Get-ChildItem -Recurse -File $Dist
  $maps = @($files | Where-Object { $_.Extension -eq '.map' })
  if ($maps.Count) { $maps | Remove-Item -Force; Add-Result 'Website build' 'source maps removed' 'PASS' "$($maps.Count) .map file(s) deleted" } else { Add-Result 'Website build' 'no source maps' 'PASS' '' }
  $files = Get-ChildItem -Recurse -File $Dist
  $sizeMb = [math]::Round((($files | Measure-Object Length -Sum).Sum / 1MB), 2)
  Add-Result 'Website build' 'files' 'PASS' "$($files.Count) files, $sizeMb MB"
  foreach ($req in 'index.html', 'config.js', '.htaccess', 'favicon.ico', 'brand\edufy-logo-192.png') {
    if (Test-Path (Join-Path $Dist $req)) { Add-Result 'Website build' "contains $req" 'PASS' '' } else { Add-Result 'Website build' "contains $req" 'FAIL' 'missing' }
  }
  $text = $files | Where-Object { $_.Extension -in '.js', '.css', '.html' }
  # sb_secret_ = new-style Supabase secret key; c2VydmljZV9yb2xl = "service_role" inside a legacy JWT key
  $hits = @($text | Select-String -CaseSensitive -Pattern 'sb_secret_[A-Za-z0-9]', 'c2VydmljZV9yb2xl' -List)
  if ($hits.Count) { Add-Result 'Website build' 'no Supabase secret keys in bundle' 'FAIL' (($hits | ForEach-Object { $_.Filename }) -join ', ') } else { Add-Result 'Website build' 'no Supabase secret keys in bundle' 'PASS' '' }
  $leaked = @()
  foreach ($n in 'SUPABASE_SERVICE_ROLE_KEY', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'ADILO_SECRET_KEY', 'EXPO_ACCESS_TOKEN') {
    $v = $webEnv[$n]
    if ($v -and $v.Length -ge 12 -and -not (& $IsPlaceholder $v)) {
      if ($text | Select-String -SimpleMatch -Pattern $v -List) { $leaked += $n }
    }
  }
  if ($leaked.Count) { Add-Result 'Website build' 'secret VALUES not in bundle' 'FAIL' ("found: " + ($leaked -join ', ')) } else { Add-Result 'Website build' 'secret VALUES not in bundle' 'PASS' 'checked against your .env' }
  # Local addresses in the bundle. Known harmless strings (never used as an address for visitors):
  #   `http://localhost`       react-router: base URL for parsing relative links
  #   `http://localhost:9999`  @supabase/auth-js: default only when no Supabase URL is given (Edufy always passes one)
  #   `http://localhost:5173`  Admin → Domain & Environment: placeholder text for the development profile
  $knownLocal = @('`http://localhost`', '`http://localhost:9999`', '`http://localhost:5173`')
  $localHits = @()
  foreach ($f in $text) {
    $raw = Get-Content $f.FullName -Raw
    foreach ($m in [regex]::Matches($raw, '.https?://(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.)[^\s"''`]*.')) {
      $localHits += [pscustomobject]@{ File = $f.Name; Value = $m.Value }
    }
  }
  $unknownLocal = @($localHits | Where-Object { $knownLocal -notcontains $_.Value })
  ($localHits | ForEach-Object { "$($_.File): $($_.Value)" }) | Out-File (Join-Path $LogDir 'website-local-address-strings.log') -Encoding utf8
  if ($unknownLocal.Count) { Add-Result 'Website build' 'no localhost addresses used by the app' 'FAIL' (($unknownLocal | ForEach-Object { "$($_.File): $($_.Value)" }) -join '; ') }
  else { Add-Result 'Website build' 'no localhost addresses used by the app' 'PASS' "$($localHits.Count) known library/placeholder string(s) only, see build-logs\website-local-address-strings.log" }
  # The production API address must be built in (the website still works if config.js is left empty)
  $apiBuilt = @($text | Select-String -SimpleMatch -Pattern "$ApiUrl/api" -List)
  if ($apiBuilt.Count) { Add-Result 'Website build' 'production API address built in' 'PASS' "$ApiUrl/api" }
  else { Add-Result 'Website build' 'production API address built in' 'WARN' "bundle default differs from $ApiUrl/api (set VITE_API_BASE_URL); the Hostinger config.js still sets $ApiUrl/api" }
  if (Test-Path (Join-Path $Root 'server-dist\server.mjs')) { Add-Result 'Backend build' 'server-dist\server.mjs' 'PASS' '' } else { Add-Result 'Backend build' 'server-dist\server.mjs' 'FAIL' 'missing' }
} else {
  Add-Result 'Website build' 'dist folder' 'FAIL' 'build did not produce dist\index.html'
}

# ---------------------------------------------------------------- 5. Smoke-test the built backend
if (-not $SkipServerTest -and (Test-Path (Join-Path $Root 'server-dist\server.mjs'))) {
  Write-Host "`n=== Backend : start built server (production mode, port 3999) ===" -ForegroundColor Cyan
  $env:NODE_ENV = 'production'; $env:PORT = '3999'; $env:PUSH_WORKER_ENABLED = 'false'
  $srvLog = Join-Path $LogDir 'backend-smoke-test.log'
  $proc = Start-Process -FilePath 'node' -ArgumentList 'server-dist/server.mjs' -WorkingDirectory $Root -PassThru -WindowStyle Hidden -RedirectStandardOutput $srvLog -RedirectStandardError "$srvLog.err"
  Start-Sleep -Seconds 6
  $checks = @(
    @{ Path = '/api/health'; Expect = 'json' },
    @{ Path = '/api/settings/public'; Expect = 'json' },
    @{ Path = '/robots.txt'; Expect = 'text' },
    @{ Path = '/'; Expect = 'html' },
    @{ Path = '/courses'; Expect = 'html' },
    @{ Path = '/blog'; Expect = 'html' },
    @{ Path = '/admin/categories'; Expect = 'html' },
    @{ Path = '/api/this-route-does-not-exist'; Expect = 'json404' }
  )
  foreach ($c in $checks) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing -Uri ("http://localhost:3999" + $c.Path) -TimeoutSec 15
      $ok = switch ($c.Expect) { 'json' { $r.Content.TrimStart().StartsWith('{') } 'html' { $r.Content -match '<div id="root">' } 'text' { $r.Content -match 'User-agent' } default { $false } }
      if ($ok) { Add-Result 'Backend smoke test' "GET $($c.Path)" 'PASS' "HTTP $($r.StatusCode)" } else { Add-Result 'Backend smoke test' "GET $($c.Path)" 'FAIL' "unexpected response (HTTP $($r.StatusCode))" }
    } catch {
      $code = $null; try { $code = [int]$_.Exception.Response.StatusCode } catch {}
      if ($c.Expect -eq 'json404' -and $code -eq 404) { Add-Result 'Backend smoke test' "GET $($c.Path)" 'PASS' 'JSON 404' }
      else { Add-Result 'Backend smoke test' "GET $($c.Path)" 'FAIL' $_.Exception.Message }
    }
  }
  try { $h = Invoke-RestMethod -Uri 'http://localhost:3999/api/health' -TimeoutSec 15; ($h | ConvertTo-Json -Depth 6) | Out-File (Join-Path $LogDir 'backend-health.json') -Encoding utf8 } catch {}
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
  Remove-Item Env:NODE_ENV, Env:PORT, Env:PUSH_WORKER_ENABLED -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------- 6. Mobile app
$App = Join-Path $Root 'app'
if (-not $SkipMobile) {
  if (-not (Test-Path (Join-Path $App 'node_modules'))) { Run-Step 'Mobile' 'npm ci (install)' $App 'npm ci --no-audit --no-fund' | Out-Null }
  Run-Step 'Mobile' 'dependencies installed (npm ls)' $App 'npm ls --depth=0' | Out-Null
  Run-Step 'Mobile' 'TypeScript check (tsc --noEmit)' $App 'npx tsc --noEmit' | Out-Null
  Run-Step 'Mobile' 'unit tests (npm test)' $App 'npm test' | Out-Null
  Run-Step 'Mobile' 'expo-doctor' $App 'npx --yes expo-doctor' | Out-Null
  Run-Step 'Mobile' 'Expo SDK packages match (expo install --check)' $App 'npx expo install --check' | Out-Null
  Run-Step 'Mobile' 'resolved app config (expo config)' $App 'npx expo config --type public --json' | Out-Null
  Write-Host "`n=== Mobile : Expo account ===" -ForegroundColor Cyan
  Push-Location $App
  $who = & cmd /c "npx --yes eas-cli whoami 2>&1"
  Pop-Location
  $who | Out-File (Join-Path $LogDir 'mobile-eas-whoami.log') -Encoding utf8
  if ($LASTEXITCODE -eq 0 -and ($who -join ' ') -notmatch 'Not logged in') { Add-Result 'Mobile' 'Expo (EAS) login' 'PASS' 'logged in' } else { Add-Result 'Mobile' 'Expo (EAS) login' 'BLOCKED' 'run: npx eas-cli login' }
  $appEnv = Read-EnvFiles @((Join-Path $App '.env'), (Join-Path $App '.env.local'))
  if ($appEnv['EAS_PROJECT_ID'] -or $appEnv['EXPO_PUBLIC_EAS_PROJECT_ID']) { Add-Result 'Mobile' 'EAS project id' 'PASS' 'set' } else { Add-Result 'Mobile' 'EAS project id' 'BLOCKED' 'run: npx eas-cli init (needed for push + builds)' }
  if ($appEnv['EXPO_PUBLIC_API_URL'] -match $DevAddress -or $appEnv['EXPO_PUBLIC_API_URL'] -notmatch '^https://') { Add-Result 'Mobile' 'app .env API address' 'INFO' 'local development address (expected). Production builds use the EAS environment variables.' }
  if (Test-Path (Join-Path $App 'google-services.json')) { Add-Result 'Mobile' 'google-services.json (Android push)' 'PASS' 'present (kept out of the package)' } else { Add-Result 'Mobile' 'google-services.json (Android push)' 'BLOCKED' 'download from Firebase; needed for Android push' }
}

# ---------------------------------------------------------------- 7. Assemble the handover package
Write-Host "`n=== Package : Edufy-Academy-Production ===" -ForegroundColor Cyan
$P = $PSScriptRoot
function Copy-Tree($From, $To, [string[]]$ExcludeDirs = @(), [string[]]$ExcludeFiles = @()) {
  $rc = @($From, $To, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1')
  if ($ExcludeDirs.Count) { $rc += '/XD'; $rc += $ExcludeDirs }
  if ($ExcludeFiles.Count) { $rc += '/XF'; $rc += $ExcludeFiles }
  & robocopy @rc | Out-Null
}
$NeverShip = @('.env', '.env.local', '.env.*.local', '.env.production', '.env.development', '*.jks', '*.keystore', '*.p8', '*.p12', '*.key', '*.pem', 'google-services.json', 'GoogleService-Info.plist', '*.log')

# website
New-Item -ItemType Directory -Force -Path "$Out\website" | Out-Null
if (Test-Path $Dist) { Copy-Tree $Dist "$Out\website\dist" @() @('*.map') }
Copy-Item "$P\readme\website-README.md" "$Out\website\README.md"
Copy-Item "$P\templates\website.env.example" "$Out\website\.env.example"

# backend (Hostinger Node.js web app / VPS). Ready-to-upload folder + zip
$B = "$Out\backend"
New-Item -ItemType Directory -Force -Path "$B\server-dist", "$B\server" | Out-Null
if (Test-Path "$Root\server-dist\server.mjs") { Copy-Item "$Root\server-dist\server.mjs" "$B\server-dist\" }
Copy-Item "$Root\server.ts", "$Root\package.json", "$Root\package-lock.json", "$Root\tsconfig.json" $B
Copy-Item "$Root\server\*.ts" "$B\server\"
New-Item -ItemType Directory -Force -Path "$B\scripts" | Out-Null
Copy-Item "$Root\scripts\verify-prebuilt.mjs" "$B\scripts\"
Copy-Item "$P\templates\backend.env.example" "$B\.env.example"
Copy-Item "$P\readme\backend-README.md" "$B\README.md"
if (Test-Path "$Root\supabase") { Copy-Tree "$Root\supabase" "$B\supabase" @('.temp', '.branches') $NeverShip }
# optional all-in-one variant: backend + website in one Node.js app
$C = "$Out\backend-with-website"
Copy-Tree $B $C
if (Test-Path $Dist) { Copy-Tree $Dist "$C\dist" @() @('*.map') }
# all-in-one: the same Node.js app serves the website and the API → API on the same address
if (Test-Path "$C\dist") { @('/* Edufy Academy: website and API served by one Node.js app. */', 'window.EDUFY_CONFIG = {', '  apiBaseUrl: "/api",', "  siteUrl: `"$SiteUrl`"", '};') | Out-File "$C\dist\config.js" -Encoding utf8 }

# mobile app source (no node_modules / native folders / secrets)
Copy-Tree $App "$Out\mobile-app" @('node_modules', 'android', 'ios', '.expo', 'dist', 'web-build', '.test-build') $NeverShip
Copy-Item "$P\templates\mobile.env.example" "$Out\mobile-app\.env.example" -Force
Copy-Item "$P\readme\mobile-app-README.md" "$Out\mobile-app\README-PRODUCTION.md"

# ---------------- Hostinger Business packages
# (a) website for public_html: production config.js (API on the sub-domain), .htaccess, robots.txt
$HW = "$Out\hostinger\website-public_html"
if (Test-Path $Dist) {
  Copy-Tree $Dist $HW @() @('*.map')
  Copy-Item "$P\hostinger\website.htaccess" "$HW\.htaccess" -Force
  @(
    '/* Edufy Academy: production deployment settings (public values only; editable in Hostinger File Manager). */',
    'window.EDUFY_CONFIG = {',
    "  apiBaseUrl: `"$ApiUrl/api`",",
    "  siteUrl: `"$SiteUrl`"",
    '};'
  ) | Out-File "$HW\config.js" -Encoding utf8
  @('User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /instructor', 'Disallow: /student', 'Disallow: /auth/') | Out-File "$HW\robots.txt" -Encoding ascii
  $cfg = Get-Content "$HW\config.js" -Raw
  if ($cfg -match $DevAddress) { Add-Result 'Hostinger website' 'config.js' 'FAIL' 'contains a development address' } else { Add-Result 'Hostinger website' 'config.js' 'PASS' "API $ApiUrl/api, site $SiteUrl" }
  foreach ($req in 'index.html', '.htaccess', 'config.js', 'favicon.ico', 'robots.txt') {
    if (Test-Path "$HW\$req") { Add-Result 'Hostinger website' "contains $req" 'PASS' '' } else { Add-Result 'Hostinger website' "contains $req" 'FAIL' 'missing' }
  }
  $assets = @(Get-ChildItem "$HW\assets" -File -ErrorAction SilentlyContinue)
  $js = @($assets | Where-Object { $_.Extension -eq '.js' }).Count; $css = @($assets | Where-Object { $_.Extension -eq '.css' }).Count
  if ($js -and $css) { Add-Result 'Hostinger website' 'assets (JS/CSS)' 'PASS' "$js JS, $css CSS" } else { Add-Result 'Hostinger website' 'assets (JS/CSS)' 'FAIL' "$js JS, $css CSS" }
} else {
  Add-Result 'Hostinger website' 'package' 'FAIL' 'no dist folder (website build failed)'
}
# (b) API as a Hostinger Node.js web app: prebuilt bundle + only the 5 runtime packages
$HA = "$Out\hostinger\api-nodejs-app"
New-Item -ItemType Directory -Force -Path "$HA\server-dist" | Out-Null
if (Test-Path "$Root\server-dist\server.mjs") { Copy-Item "$Root\server-dist\server.mjs" "$HA\server-dist\" ; Add-Result 'Hostinger API' 'server-dist\server.mjs' 'PASS' '' } else { Add-Result 'Hostinger API' 'server-dist\server.mjs' 'FAIL' 'missing (backend build failed)' }
Copy-Item "$P\hostinger\backend-package.json" "$HA\package.json"
Copy-Item "$P\templates\backend.env.example" "$HA\.env.example"
Copy-Item "$P\readme\hostinger-api-README.md" "$HA\README.md"
Push-Location $HA
$lock = & cmd /c "npm install --package-lock-only --omit=dev --ignore-scripts --no-audit --no-fund 2>&1"
$lockCode = $LASTEXITCODE
Pop-Location
if ($lockCode -eq 0 -and (Test-Path "$HA\package-lock.json")) { Add-Result 'Hostinger API' 'package-lock.json' 'PASS' 'pinned dependency tree' } else { Add-Result 'Hostinger API' 'package-lock.json' 'WARN' 'not created; Hostinger will resolve versions from package.json' }
if (-not $SkipServerTest -and (Test-Path "$HA\server-dist\server.mjs")) {
  # Prove the slim package starts on its own: install the 5 packages into a temp copy and hit /api/health
  $T = Join-Path $env:TEMP ('edufy-api-check-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
  Copy-Tree $HA $T
  Push-Location $T
  & cmd /c "npm install --omit=dev --ignore-scripts --no-audit --no-fund 2>&1" | Out-File (Join-Path $LogDir 'hostinger-api-install.log') -Encoding utf8
  $env:NODE_ENV = 'production'; $env:PORT = '3998'
  $api = Start-Process -FilePath 'node' -ArgumentList 'server-dist/server.mjs' -WorkingDirectory $T -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $LogDir 'hostinger-api-start.log') -RedirectStandardError (Join-Path $LogDir 'hostinger-api-start.err.log')
  Remove-Item Env:PORT; Remove-Item Env:NODE_ENV
  $ok = $false
  for ($i = 0; $i -lt 20 -and -not $ok; $i++) { Start-Sleep -Milliseconds 750; try { $r = Invoke-RestMethod -Uri 'http://localhost:3998/api/health' -TimeoutSec 3; $ok = $true } catch {} }
  if ($api -and -not $api.HasExited) { Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue }
  Pop-Location
  Remove-Item -Recurse -Force $T -ErrorAction SilentlyContinue
  if ($ok) { Add-Result 'Hostinger API' 'starts with only production packages' 'PASS' '/api/health answered' } else { Add-Result 'Hostinger API' 'starts with only production packages' 'FAIL' 'see build-logs\hostinger-api-start*.log' }
}

# android builds: filled after EAS build
New-Item -ItemType Directory -Force -Path "$Out\android-builds" | Out-Null
Copy-Item "$P\readme\android-builds-README.md" "$Out\android-builds\README.md"
Get-ChildItem -Path "$Root\*" -Include '*.aab', '*.apk' -File -ErrorAction SilentlyContinue | Copy-Item -Destination "$Out\android-builds\"

# documentation
Copy-Item "$P\docs\*.md" "$Out\documentation\"

# safety: make sure no secret files slipped in
$bad = @(Get-ChildItem -Recurse -File -Force $Out | Where-Object { $_.Name -match '^\.env($|\.(?!example$))' -or $_.Name -match '\.(jks|keystore|p8|p12|pem)$' -or $_.Name -eq 'google-services.json' } )
if ($bad.Count) { $bad | Remove-Item -Force; Add-Result 'Package' 'secret files excluded' 'WARN' "$($bad.Count) removed" } else { Add-Result 'Package' 'secret files excluded' 'PASS' '' }
if (Get-ChildItem -Recurse -Directory -Force $Out -Filter node_modules) { Add-Result 'Package' 'no node_modules' 'FAIL' '' } else { Add-Result 'Package' 'no node_modules' 'PASS' '' }

# summary file
$summary = Join-Path $Out 'documentation\BUILD_RESULTS.md'
$lines = @("# Build results", "", "Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm') on $env:COMPUTERNAME (Node $(node --version)).", "", "| Area | Check | Status | Note |", "|---|---|---|---|")
foreach ($r in $Results) { $lines += "| $($r.Area) | $($r.Check) | $($r.Status) | $($r.Note -replace '\|', '/') |" }
$lines | Out-File $summary -Encoding utf8

# zips (built with forward-slash paths so Linux servers such as Hostinger unpack them correctly)
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
function New-Zip($SourceDir, $ZipPath, $Prefix = '') {
  if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
  $zip = [System.IO.Compression.ZipFile]::Open($ZipPath, 'Create')
  try {
    $base = (Resolve-Path $SourceDir).Path.TrimEnd('\') + '\'
    Get-ChildItem -Recurse -File -Force $SourceDir | Where-Object { $_.FullName -ne $ZipPath } | ForEach-Object {
      $rel = $Prefix + ($_.FullName.Substring($base.Length) -replace '\\', '/')
      [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal)
    }
  } finally { $zip.Dispose() }
}
$Up = "$Out\upload-ready"
New-Item -ItemType Directory -Force -Path $Up | Out-Null
if (Test-Path "$Out\website\dist") { New-Zip "$Out\website\dist" "$Up\website-dist.zip" }
New-Zip $B "$Up\backend-api.zip"
New-Zip $C "$Up\backend-with-website.zip"
if (Test-Path "$HW\index.html") { New-Zip $HW "$Up\hostinger-website-public_html.zip" }
New-Zip $HA "$Up\hostinger-api-nodejs.zip"
New-Zip $Out $Zip 'Edufy-Academy-Production/'
Add-Result 'Package' 'ZIP files created' 'PASS' 'upload-ready\*.zip + Edufy-Academy-Production.zip'

$fail = @($Results | Where-Object { $_.Status -eq 'FAIL' }).Count
$warn = @($Results | Where-Object { $_.Status -like 'WARN*' -or $_.Status -eq 'BLOCKED' }).Count
Write-Host "`n================ SUMMARY ================" -ForegroundColor White
$Results | Format-Table -AutoSize | Out-String -Width 220 | Write-Host
Write-Host "Failures: $fail   Warnings/blocked: $warn" -ForegroundColor $(if ($fail) { 'Red' } else { 'Green' })
Write-Host "Package : $Out"
Write-Host "ZIP     : $Zip"
Write-Host "Results : $summary"
