<#
  Edufy Academy - push the website and the API code to GitHub.
  Hostinger deploys both automatically after each push to "main".

  Run it with PUSH-TO-GITHUB.cmd in the project folder (double-click), or:
    powershell -ExecutionPolicy Bypass -File production\github\push-to-github.ps1 -Message "What changed"

  Website -> https://github.com/cellicella/edufyacademy-website  (private; this whole project folder)
  API     -> https://github.com/cellicella/edufyacademy-api      (private; generated from server.ts, server\ and the server tests)
  Both repositories are created automatically (private) on the first run if they do not exist yet.

  Safety: .env files, keys, zips and build output are never committed (.gitignore), and the staged files are
  scanned for secrets before every commit. Nothing is pushed if the scan finds something.
  Requires Git for Windows (https://git-scm.com/download/win). The first push opens a GitHub sign-in window.
#>
param(
  [string]$Message = '',
  [string]$WebsiteRepo = 'https://github.com/cellicella/edufyacademy-website.git',
  [string]$ApiRepo = 'https://github.com/cellicella/edufyacademy-api.git',
  [string]$Branch = 'main',
  [switch]$WebsiteOnly,
  [switch]$ApiOnly
)

$ErrorActionPreference = 'Continue'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $Message) { $Message = 'Update Edufy Academy (' + (Get-Date -Format 'yyyy-MM-dd HH:mm') + ')' }
$NoReplyName = 'cellicella'
$NoReplyEmail = '127194900+cellicella@users.noreply.github.com'

function Step([string]$Text) { Write-Host ''; Write-Host ('== ' + $Text) -ForegroundColor Cyan }
function Ok([string]$Text) { Write-Host ('   ' + $Text) -ForegroundColor Green }
function Stop-Push([string]$Text) {
  Write-Host ''
  Write-Host ('STOPPED: ' + $Text) -ForegroundColor Red
  exit 1
}
# Simple function on purpose: every argument (including -C, -q, -m) goes straight to git.
function Invoke-Git {
  & git @args
  if ($LASTEXITCODE -ne 0) { Stop-Push ('git ' + ($args -join ' ') + ' failed (see the message above).') }
}

# ---------------------------------------------------------------- GitHub repositories
# Uses the GitHub sign-in that Git for Windows stores (Git Credential Manager); the token stays in memory only.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$script:GhToken = $null
$script:GhLogin = $null

function Invoke-GitHub([string]$Method, [string]$Path, $Body) {
  $headers = @{ Authorization = ('token ' + $script:GhToken); Accept = 'application/vnd.github+json'; 'User-Agent' = 'edufy-push-script' }
  $uri = 'https://api.github.com' + $Path
  if ($Body) { return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body ($Body | ConvertTo-Json) -ContentType 'application/json' }
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
}

function Connect-GitHub {
  if ($script:GhToken) { return }
  Write-Host '   signing in to GitHub (a browser window may open)...'
  $cred = "protocol=https`nhost=github.com`n`n" | & git credential fill
  foreach ($line in $cred) { if ($line -like 'password=*') { $script:GhToken = $line.Substring(9) } }
  if (-not $script:GhToken) { Stop-Push 'GitHub sign-in did not complete. Run PUSH-TO-GITHUB.cmd again and finish the sign-in.' }
  try { $me = Invoke-GitHub 'GET' '/user' $null }
  catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    if ($code -eq 401) {
      ("protocol=https`nhost=github.com`n`n") | & git credential reject
      Stop-Push 'GitHub did not accept the saved sign-in. It was cleared; run PUSH-TO-GITHUB.cmd again and sign in as cellicella.'
    }
    Stop-Push ('could not reach GitHub: ' + $_.Exception.Message)
  }
  ($cred -join "`n") + "`n`n" | & git credential approve
  $script:GhLogin = $me.login
  Ok ('signed in to GitHub as ' + $script:GhLogin)
}

function Confirm-Repository([string]$Url, [string]$Description) {
  if ($Url -notmatch 'github\.com[/:]([^/]+)/([^/]+?)(\.git)?$') { return }
  $owner = $Matches[1]; $name = $Matches[2]
  Connect-GitHub
  try {
    $repo = Invoke-GitHub 'GET' ('/repos/' + $owner + '/' + $name) $null
    Ok ('repository ' + $owner + '/' + $name + ' exists (private: ' + $repo.private + ')')
    return
  }
  catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    if ($code -ne 404) { Stop-Push ('could not check ' + $owner + '/' + $name + ' on GitHub: ' + $_.Exception.Message) }
  }
  if ($script:GhLogin -ne $owner) { Stop-Push ('you are signed in to GitHub as ' + $script:GhLogin + ', but the repository belongs to ' + $owner + '. Sign in as ' + $owner + '.') }
  Invoke-GitHub 'POST' '/user/repos' @{ name = $name; private = $true; description = $Description; auto_init = $false } | Out-Null
  Ok ('created the private repository ' + $owner + '/' + $name)
}

# Files that must never be committed, and secret-looking values in staged content.
$BlockedPath = '(^|/)(\.env(\..+)?|[^/]+\.env)$|\.(pem|key|p8|p12|jks|keystore|zip)$|(^|/)(google-services\.json|GoogleService-Info\.plist|service-account[^/]*\.json)$|(^|/)node_modules/|(^|/)Claude outputs/'
$AllowedPath = '(^|/)[^/]*\.env\.example$'
$SecretPattern = 'sb_secret_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(SERVICE_ROLE_KEY|KEY_SECRET|WEBHOOK_SECRET|ENCRYPTION_KEY|CRON_SECRET|SMTP_PASSWORD|EMAIL_API_KEY|HOOK_SECRET|MANAGEMENT_TOKEN|ACCESS_TOKEN|SECRET_KEY|GEMINI_API_KEY|DEMO_PASSWORD).?[[:space:]]*[:=][[:space:]]*.?[A-Za-z0-9+/=_.-]{20,}'
$PlaceholderValue = 'REPLACE|your[-_]|choose-a|example|placeholder|process\.env|xxxx|XXXX|<'

function Test-StagedFiles([string]$Repo) {
  $problems = @()
  $names = & git -C $Repo diff --cached --name-only --diff-filter=ACMR
  foreach ($n in $names) {
    if ($n -match $BlockedPath -and $n -notmatch $AllowedPath) { $problems += ('file must not be committed: ' + $n) }
  }
  $hits = & git -C $Repo grep --cached -n -I -E $SecretPattern 2>$null
  foreach ($h in $hits) {
    if ($h -notmatch $PlaceholderValue) { $problems += ('looks like a secret: ' + ($h.Substring(0, [Math]::Min(120, $h.Length)))) }
  }
  if ($problems.Count -gt 0) {
    & git -C $Repo reset -q
    Write-Host ''
    $problems | ForEach-Object { Write-Host ('   ' + $_) -ForegroundColor Yellow }
    Stop-Push 'possible secrets found, nothing was committed. Remove them (or add the file to .gitignore) and run again.'
  }
  Ok 'secret check passed'
}

function Set-Identity([string]$Repo) {
  $name = & git config --global user.name
  if (-not $name) { & git -C $Repo config user.name $NoReplyName; & git -C $Repo config user.email $NoReplyEmail }
}

function Commit-And-Push([string]$Repo, [string]$Label) {
  Invoke-Git -C $Repo add -A
  Test-StagedFiles $Repo
  & git -C $Repo diff --cached --quiet
  if ($LASTEXITCODE -eq 0) { Ok ('no changes to commit for the ' + $Label) }
  else {
    Invoke-Git -C $Repo commit -q -m $Message
    Ok ('committed: ' + $Message)
  }
  & git -C $Repo rev-parse --verify -q ('refs/remotes/origin/' + $Branch) *> $null
  if ($LASTEXITCODE -eq 0) {
    & git -C $Repo merge-base --is-ancestor ('origin/' + $Branch) HEAD
    if ($LASTEXITCODE -ne 0) {
      & git -C $Repo pull -q --rebase origin $Branch
      if ($LASTEXITCODE -ne 0) {
        & git -C $Repo rebase --abort *> $null
        Stop-Push ('GitHub has newer changes in the ' + $Label + ' repository that conflict with yours. Your commit is saved locally; ask Claude to merge them.')
      }
      Ok 'brought in newer changes from GitHub'
    }
  }
  Invoke-Git -C $Repo push -u origin ('HEAD:refs/heads/' + $Branch)
  Ok ('pushed to ' + $Branch)
}

# ---------------------------------------------------------------- checks
Step 'Checking Git'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Stop-Push 'Git is not installed. Install Git for Windows from https://git-scm.com/download/win (default options), close this window and run PUSH-TO-GITHUB.cmd again.'
}
Ok (& git --version)

# ---------------------------------------------------------------- website
if (-not $ApiOnly) {
  Step ('Website -> ' + $WebsiteRepo)
  Confirm-Repository $WebsiteRepo 'Edufy Academy website (React + Vite), deployed to https://edufyacademy.com'
  if (-not (Test-Path (Join-Path $Root '.git'))) {
    Invoke-Git -C $Root init -q
    Invoke-Git -C $Root symbolic-ref HEAD ('refs/heads/' + $Branch)
    Ok 'created the local Git repository'
  }
  Set-Identity $Root
  & git -C $Root remote get-url origin *> $null
  if ($LASTEXITCODE -ne 0) { Invoke-Git -C $Root remote add origin $WebsiteRepo } else { Invoke-Git -C $Root remote set-url origin $WebsiteRepo }

  & git -C $Root fetch -q origin $Branch 2>$null
  $remoteExists = ($LASTEXITCODE -eq 0)
  & git -C $Root rev-parse --verify -q HEAD *> $null
  $hasLocalCommits = ($LASTEXITCODE -eq 0)
  if ($remoteExists -and -not $hasLocalCommits) {
    # Start from the history already on GitHub; the files in this folder become the next commit.
    Invoke-Git -C $Root reset -q ('origin/' + $Branch)
    Ok 'linked to the existing GitHub history'
  }
  Commit-And-Push $Root 'website'
}

# ---------------------------------------------------------------- API
if (-not $WebsiteOnly) {
  Step ('API -> ' + $ApiRepo)
  Confirm-Repository $ApiRepo 'Edufy Academy API (Express), deployed to https://api.edufyacademy.com'
  $Work = Join-Path $env:TEMP 'edufyacademy-api-push'
  if (Test-Path $Work) { Remove-Item -Recurse -Force $Work }
  & git clone -q $ApiRepo $Work
  if ($LASTEXITCODE -ne 0) {
    Stop-Push 'could not download the API repository from GitHub (see the message above).'
  }
  & git -C $Work rev-parse --verify -q HEAD *> $null
  if ($LASTEXITCODE -ne 0) { Invoke-Git -C $Work symbolic-ref HEAD ('refs/heads/' + $Branch) }
  Set-Identity $Work

  # Replace the repository contents with the current API source (keep .git and the lock file).
  Get-ChildItem -LiteralPath $Work -Force | Where-Object { $_.Name -ne '.git' -and $_.Name -ne 'package-lock.json' } | Remove-Item -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $Root 'server.ts') -Destination $Work
  Copy-Item -LiteralPath (Join-Path $Root 'server') -Destination $Work -Recurse
  New-Item -ItemType Directory -Path (Join-Path $Work 'tests') | Out-Null
  foreach ($t in @('backend', 'cron', 'emailSystem', 'pushLogic', 'settings', 'smtp')) {
    Copy-Item -LiteralPath (Join-Path $Root ('tests\' + $t + '.test.ts')) -Destination (Join-Path $Work 'tests')
  }
  Get-ChildItem -LiteralPath (Join-Path $Root 'production\api-repo') -Force | Copy-Item -Destination $Work -Recurse
  Copy-Item -LiteralPath (Join-Path $Root 'production\templates\backend.env.example') -Destination (Join-Path $Work '.env.example')

  if (Get-Command npm -ErrorAction SilentlyContinue) {
    Push-Location $Work
    & npm install --package-lock-only --ignore-scripts --no-audit --no-fund --loglevel=error
    if ($LASTEXITCODE -eq 0) { Ok 'package-lock.json updated' } else { Write-Host '   (could not update package-lock.json; Hostinger will resolve versions itself)' -ForegroundColor Yellow }
    Pop-Location
  }
  Commit-And-Push $Work 'API'
  Remove-Item -Recurse -Force $Work
}

Step 'Done'
Ok 'Hostinger now builds and deploys the new version (about 1-3 minutes):'
Ok '  website  https://edufyacademy.com'
Ok '  API      https://api.edufyacademy.com/api/health'
