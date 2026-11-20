[CmdletBinding()]
param([switch]$Setup, [switch]$Build, [switch]$Register)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '../..')
$root = (Get-Location).Path
$node = (Get-Command node.exe).Source
$store = Join-Path $env:LOCALAPPDATA 'GPT-to-search\windows-host'
$credentialPath = Join-Path $store 'worker.credential.xml'

if ($Setup) {
    New-Item -ItemType Directory -Force $store | Out-Null
    $entry = Get-Credential -Message 'Supabase app owner login for the local update worker'
    if (!$entry) { throw 'Owner login setup cancelled' }
    $entry | Export-Clixml -Path $credentialPath
}
if ($Register) {
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File "' + $PSCommandPath + '"') -WorkingDirectory $root
    $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
    $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName 'GPT to research PC' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
}
if ($Build) {
    & npm.cmd ci
    if ($LASTEXITCODE) { throw 'npm ci failed' }
    & npm.cmd run build
    if ($LASTEXITCODE) { throw 'Production build failed' }
}
if (!(Test-Path '.next/BUILD_ID')) { throw 'Production build missing. Run start.ps1 -Build first.' }
if (!(Test-Path $credentialPath)) { throw 'Run start.ps1 -Setup for this Windows user.' }
$owner = Import-Clixml $credentialPath
$env:WINDOWS_PC_HOST = '1'
$env:NODE_ENV = 'production'
$env:WORKER_LOCAL_URL = 'http://127.0.0.1:3000'
Remove-Item Env:WORKER_OWNER_PASSWORD, Env:WORKER_OWNER_EMAIL -ErrorAction SilentlyContinue
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,3000)
try { $listener.Start() } finally { $listener.Stop() }
$app = $null
$worker = $null
try {
    $app = Start-Process -FilePath $node -ArgumentList 'node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3000' -NoNewWindow -PassThru
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        if ($app.HasExited) { throw 'Next server exited' }
        try {
            $mode = Invoke-RestMethod 'http://127.0.0.1:3000/api/mode' -TimeoutSec 2
            if ($mode.localWorker -and !$mode.mock) { $ready = $true; break }
        } catch { }
        Start-Sleep -Seconds 1
    }
    if (!$ready) { throw 'Windows production server did not become ready' }
    try {
        $env:WORKER_OWNER_EMAIL = $owner.UserName
        $env:WORKER_OWNER_PASSWORD = $owner.GetNetworkCredential().Password
        $worker = Start-Process -FilePath $node -ArgumentList 'scripts/update-worker.mjs' -NoNewWindow -PassThru
    } finally {
        Remove-Item Env:WORKER_OWNER_PASSWORD, Env:WORKER_OWNER_EMAIL -ErrorAction SilentlyContinue
        $owner = $null
    }
    Write-Host 'Local app and update worker running at http://127.0.0.1:3000'
    while (!$app.HasExited -and !$worker.HasExited) { Start-Sleep -Seconds 3 }
    throw 'A host process stopped. Restart the host.'
} finally {
    foreach ($child in @($worker,$app)) {
        if ($null -ne $child -and !$child.HasExited) { $child.Kill(); $child.WaitForExit() }
    }
}
