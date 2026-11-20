#requires -Version 5.1
# From the application folder:
# powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\hosting\windows\measure.ps1
# Requires Node >=22.16, npm and Supabase/Plus already connected for this Windows user.
# The unique benchmark project and its public source remain available for inspection.
param(
    [ValidateRange(1024,65535)][int]$Port = 43219,
    [string]$OutputPath = (Join-Path $env:TEMP ("gpt-research-measure-" + [guid]::NewGuid() + ".json"))
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$scratch = Join-Path ([IO.Path]::GetTempPath()) ("gpt-measure-" + [guid]::NewGuid())
$OutputPath = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $OutputPath) { throw "Output path already exists. Choose a new path." }
$node = (Get-Command node.exe -CommandType Application).Source
if ([version]((& $node --version).TrimStart('v')) -lt [version]'22.16.0') { throw "Node 22.16 or newer required." }
$null = Get-Command npm.cmd -CommandType Application
$logical = [int](Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
if ($logical -lt 1) { throw "Cannot determine the processor count." }

# Job-level accounting includes completed build workers. Only processes assigned to
# our job are terminated when it closes, including on failure or interruption.
if (-not ('ResearchBenchJob' -as [type])) {
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public sealed class ResearchBenchJob : IDisposable {
    [StructLayout(LayoutKind.Sequential)] struct Limits {
        public long processTime, jobTime; public uint flags; public UIntPtr minWS, maxWS;
        public uint activeLimit; public UIntPtr affinity; public uint priority, scheduling;
    }
    [StructLayout(LayoutKind.Sequential)] struct Extended {
        public Limits basic;
        public ulong readOps, writeOps, otherOps, readBytes, writeBytes, otherBytes;
        public UIntPtr processMemory, jobMemory, peakProcessMemory, peakJobMemory;
    }
    [StructLayout(LayoutKind.Sequential)] struct Accounting {
        public long user, kernel, periodUser, periodKernel; public uint faults, total, active, ended;
    }
    [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
    static extern SafeFileHandle CreateJobObject(IntPtr security, string name);
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool SetInformationJobObject(SafeFileHandle j, int kind, ref Extended data, int size);
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool QueryInformationJobObject(SafeFileHandle j, int kind, IntPtr data, int size, out int used);
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool AssignProcessToJobObject(SafeFileHandle j, IntPtr process);
    SafeFileHandle job;
    static void Check(bool ok) { if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error()); }
    public ResearchBenchJob(Process p) {
        job = CreateJobObject(IntPtr.Zero, null);
        try {
            Check(!job.IsInvalid);
            Extended limits = new Extended(); limits.basic.flags = 0x2000;
            Check(SetInformationJobObject(job, 9, ref limits, Marshal.SizeOf(typeof(Extended))));
            Check(AssignProcessToJobObject(job, p.Handle));
        } catch { job.Dispose(); throw; }
    }
    public long CpuTicks() {
        int size = Marshal.SizeOf(typeof(Accounting)), used; IntPtr data = Marshal.AllocHGlobal(size);
        try {
            Check(QueryInformationJobObject(job, 1, data, size, out used));
            Accounting a = (Accounting)Marshal.PtrToStructure(data, typeof(Accounting));
            return a.user + a.kernel;
        } finally { Marshal.FreeHGlobal(data); }
    }
    public int[] Processes() {
        for (int count=32; count<=65536; count*=2) {
            int size=8+IntPtr.Size*count, used; IntPtr data=Marshal.AllocHGlobal(size);
            try {
                if (!QueryInformationJobObject(job, 3, data, size, out used)) {
                    if (Marshal.GetLastWin32Error()==234) continue;
                    Check(false);
                }
                int[] ids = new int[Marshal.ReadInt32(data,4)];
                for(int i=0;i<ids.Length;i++) ids[i]=Marshal.ReadIntPtr(data,8+i*IntPtr.Size).ToInt32();
                return ids;
            } finally { Marshal.FreeHGlobal(data); }
        }
        throw new InvalidOperationException("Process list too large.");
    }
    public long WorkingSet() {
        long sum=0;
        foreach(int id in Processes()) {
            try { using(Process p=Process.GetProcessById(id)) sum+=p.WorkingSet64; }
            catch(ArgumentException) {} catch(InvalidOperationException) {}
        }
        return sum;
    }
    public void Dispose() { job.Dispose(); }
}
'@
}

function Save-Phase($name, $startTime, $startCpu, $peak, $endTime, $endCpu) {
    $seconds = ($endTime - $startTime).TotalSeconds
    if ($seconds -gt 0) {
        $phases.Add([ordered]@{
            phase = $name
            seconds = [math]::Round($seconds,3)
            cpuPercentOfMachine = [math]::Round(100 * ($endCpu-$startCpu) / 1e7 / $seconds / $logical,3)
            peakSampledWorkingSetMiB = [math]::Round($peak / 1MB,2)
        })
    }
}
$phases = New-Object 'System.Collections.Generic.List[object]'
$result = @{ok=$false; failureStep='setup'}
$runner = $null
$job = $null
$phaseName = $null
try {
    $null = New-Item -Type Directory -Path $scratch
    # Copy only build inputs. The runner loads Next env configuration from the
    # original folder, in memory, after npm ci. Preserve existing builds and caches.
    foreach ($item in @('src','public','prompts','scripts','supabase','tests','playwright.config.ts','vitest.config.mts','package.json','package-lock.json',
        'tsconfig.json','next-env.d.ts','next.config.ts','postcss.config.mjs','components.json')) {
        $from = Join-Path $root $item
        if (Test-Path -LiteralPath $from) { Copy-Item -LiteralPath $from -Destination $scratch -Recurse }
    }
    $email = Read-Host 'Supabase owner email (local input)'
    $password = Read-Host 'Supabase owner password (local input)' -AsSecureString
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $node
    $helper = Join-Path $PSScriptRoot 'measure-run.mjs'
    $info.Arguments = ('"{0}" "{1}" "{2}" {3}' -f $helper,$root,$scratch,$Port)
    $info.WorkingDirectory = $scratch
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardInput = $true
    $runner = [Diagnostics.Process]::Start($info)
    $job = New-Object ResearchBenchJob -ArgumentList $runner
    $plain = [Net.NetworkCredential]::new('', $password).Password
    $payload = @{email=$email; password=$plain} | ConvertTo-Json -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
    $runner.StandardInput.BaseStream.Write($bytes,0,$bytes.Length)
    $runner.StandardInput.BaseStream.Close()
    [Array]::Clear($bytes,0,$bytes.Length)
    $plain = $payload = $null
    $password.Dispose()
    $clock = [Diagnostics.Stopwatch]::StartNew()
    $statusFile = Join-Path $scratch 'measure-phase.json'
    while (-not $runner.HasExited) {
        $observed = $null
        if ([IO.File]::Exists($statusFile)) { $observed = ([IO.File]::ReadAllText($statusFile) | ConvertFrom-Json).name }
        $now = $clock.Elapsed
        $cpu = $job.CpuTicks()
        $ws = $job.WorkingSet()
        if ($observed -and $observed -ne $phaseName) {
            if ($phaseName) { Save-Phase $phaseName $phaseStart $firstCpu $peak $now $cpu }
            $phaseName = $observed
            $phaseStart = $now
            $firstCpu = $cpu
            $peak = $ws
            Write-Host ("Measuring " + $phaseName)
            if ($phaseName -eq 'prepare') {
                $ownerPid = (Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $Port -State Listen).OwningProcess
                if ($job.Processes() -notcontains $ownerPid) { throw "Refusing login on a port owned by a different process." }
            }
            [IO.File]::WriteAllText($statusFile + '.ack',$phaseName,[Text.Encoding]::ASCII)
        } elseif ($phaseName) { $peak = [Math]::Max([long]$peak,[long]$ws) }
        if ($clock.Elapsed.TotalMinutes -gt 45) { throw "Benchmark timed out." }
        Start-Sleep -Milliseconds 200
    }
    if ($phaseName) { Save-Phase $phaseName $phaseStart $firstCpu $peak $clock.Elapsed ($job.CpuTicks()) }
    $result = [IO.File]::ReadAllText((Join-Path $scratch 'measure-result.json')) | ConvertFrom-Json
} finally {
    if ($job) { $job.Dispose() }
    elseif ($runner -and -not $runner.HasExited) { $runner.Kill() }
    if ($runner) { $null = $runner.WaitForExit(5000); $runner.Dispose() }
    [ordered]@{
        utc = [DateTime]::UtcNow.ToString('o')
        logicalProcessors = $logical
        sampleIntervalMs = 200
        scope = 'Job tree CPU and sampled aggregate working set; npm ci is separate from build. No remote AI server resources are measured.'
        phases = $phases.ToArray()
        result = $result
    } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    Write-Host ("Result JSON: " + $OutputPath)
    if (Test-Path -LiteralPath $scratch) { Remove-Item -LiteralPath $scratch -Recurse -Force }
}
if (-not $result.ok) { throw ("Benchmark incomplete at " + $result.failureStep + ". See result JSON.") }
