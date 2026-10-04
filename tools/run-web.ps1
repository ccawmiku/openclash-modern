param([ValidateSet('install','build','dev','preview','test','browser-install','browser-test','router-test','help-audit','migration-test','extended-test','ui-test','record-test','privacy-test')][string]$Task='build')
$ErrorActionPreference = 'Stop'
$env:NODE_OPTIONS = '--max-old-space-size=384'
$env:RAYON_NUM_THREADS = '2'
$env:UV_THREADPOOL_SIZE = '2'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class LimitedWeb {
  [StructLayout(LayoutKind.Sequential)] struct Basic { public long PerProcessUserTimeLimit, PerJobUserTimeLimit; public uint LimitFlags; public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize; public uint ActiveProcessLimit; public UIntPtr Affinity; public uint PriorityClass, SchedulingClass; }
  [StructLayout(LayoutKind.Sequential)] struct IO { public ulong ReadOperationCount,WriteOperationCount,OtherOperationCount,ReadTransferCount,WriteTransferCount,OtherTransferCount; }
  [StructLayout(LayoutKind.Sequential)] struct Extended { public Basic BasicLimitInformation; public IO IoInfo; public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed; }
  [StructLayout(LayoutKind.Sequential)] struct CPU { public uint ControlFlags, CpuRate; }
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct Startup { public uint cb; public string lpReserved,lpDesktop,lpTitle; public uint dwX,dwY,dwXSize,dwYSize,dwXCountChars,dwYCountChars,dwFillAttribute,dwFlags; public short wShowWindow,cbReserved2; public IntPtr lpReserved2,hStdInput,hStdOutput,hStdError; }
  [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr process,thread; public uint pid,tid; }
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr a,string name);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr h,int cls,IntPtr p,uint size);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr h,IntPtr p);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcess(string app,StringBuilder cmd,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref Startup si,out ProcessInfo pi);
  [DllImport("kernel32.dll")] static extern uint ResumeThread(IntPtr t);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr p,uint ms);
  [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr p,out uint code);
  [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr p,uint code);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  static void Check(bool result) { if(!result) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()); }
  static void Set<T>(IntPtr job,int cls,T info) { int size=Marshal.SizeOf(typeof(T)); IntPtr ptr=Marshal.AllocHGlobal(size); try { Marshal.StructureToPtr(info,ptr,false); Check(SetInformationJobObject(job,cls,ptr,(uint)size)); } finally { Marshal.FreeHGlobal(ptr); } }
  public static int Run(string cwd,string cmd,string logfile) {
    IntPtr job=CreateJobObject(IntPtr.Zero,null); if(job==IntPtr.Zero) Check(false);
    ProcessInfo pi=new ProcessInfo();
    try {
      var limits=new Extended(); limits.BasicLimitInformation.LimitFlags=0x2000|0x200; limits.JobMemoryLimit=(UIntPtr)(768UL*1024*1024); Set(job,9,limits);
      Set(job,15,new CPU { ControlFlags=5,CpuRate=1250 });
      var si=new Startup(); si.cb=(uint)Marshal.SizeOf(typeof(Startup));
      var command=new StringBuilder("cmd.exe /d /s /c \""+cmd+" > \""+logfile+"\" 2>&1\"");
      Check(CreateProcess(null,command,IntPtr.Zero,IntPtr.Zero,false,0x08000000|0x4|0x4000,IntPtr.Zero,cwd,ref si,out pi));
      try { Check(AssignProcessToJobObject(job,pi.process)); } catch { TerminateProcess(pi.process,1); throw; }
      ResumeThread(pi.thread); WaitForSingleObject(pi.process,0xffffffff); uint code; GetExitCodeProcess(pi.process,out code); return (int)code;
    } finally { if(pi.thread!=IntPtr.Zero) CloseHandle(pi.thread); if(pi.process!=IntPtr.Zero) CloseHandle(pi.process); CloseHandle(job); }
  }
}
'@
$webRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../web'))
$logRoot = Join-Path $PSScriptRoot '../artifacts'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$logfile = [IO.Path]::GetFullPath((Join-Path $logRoot "web-$Task.log"))
$command = switch ($Task) {
  'install' { 'npm.cmd install --no-audit --no-fund' }
  'browser-install' { 'npx.cmd playwright install chromium' }
  'browser-test' { 'node tools/browser-test.mjs' }
  'router-test' { 'node tools/router-browser-test.mjs' }
  'help-audit' { 'node tools/help-audit.mjs' }
  'migration-test' { 'node tools/migration-test.mjs' }
  'extended-test' { 'node tools/extended-test.mjs' }
  'ui-test' { 'node tools/ui-test.mjs' }
  'record-test' { 'node tools/record-test.mjs' }
  'privacy-test' { 'node tools/privacy-test.mjs' }
  default { "npm.cmd run $Task" }
}
Write-Host "Web $Task : CPU <=12.5% of host, process-tree memory <=768MB, BelowNormal. Log: $logfile"
$code = [LimitedWeb]::Run($webRoot, $command, $logfile)
Get-Content -LiteralPath $logfile -Encoding utf8 -Tail 70
exit $code
