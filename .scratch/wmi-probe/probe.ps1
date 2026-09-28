<#
    cowa — 一次性可行性探针（PROTOTYPE，用完即删）

    只回答一个问题：我们范围清单里的每一格，在**这台机器上**到底拿不拿得到，各要多久。
    不产出生产代码，不做打磨。产物是这张表。

    跑法：bun run probe:wmi
#>

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'

$script:Budget = 3   # 秒，模拟「查询上限」
$script:Total  = [System.Diagnostics.Stopwatch]::StartNew()

function Write-Head([string]$t) {
    Write-Host ""
    Write-Host ("=" * 78) -ForegroundColor DarkGray
    Write-Host "  $t" -ForegroundColor Cyan
    Write-Host ("=" * 78) -ForegroundColor DarkGray
}

function Show-Row($obj) {
    if ($null -eq $obj) { Write-Host "      <null>" -ForegroundColor DarkYellow; return }
    foreach ($k in $obj.Keys) {
        $v = $obj[$k]
        if ($null -eq $v -or ($v -is [string] -and $v.Trim() -eq '')) {
            Write-Host ("      {0,-26} " -f $k) -NoNewline
            Write-Host "<空>" -ForegroundColor DarkYellow
        }
        else {
            if ($v -is [array]) { $v = ($v -join ', ') }
            Write-Host ("      {0,-26} " -f $k) -NoNewline
            Write-Host $v
        }
    }
}

function Probe {
    param(
        [string]   $Label,
        [string]   $Class,
        [string]   $Namespace = 'root/cimv2',
        [string[]] $Props     = @(),
        [switch]   $All,
        [switch]   $Quiet
    )

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $status = 'OK'; $items = @()
    try {
        $items = @(Get-CimInstance -Namespace $Namespace -ClassName $Class `
                    -OperationTimeoutSec $script:Budget -ErrorAction Stop)
    }
    catch {
        $status = 'FAIL: ' + ($_.Exception.Message -split "`r?`n")[0]
    }
    $sw.Stop()
    $n = $items.Count
    if ($status -eq 'OK' -and $n -eq 0) { $status = 'EMPTY (类存在，但 0 个实例)' }

    Write-Host ("`n  [{0}]  {1}" -f $Label, "$Namespace`:$Class") -ForegroundColor White
    $color = if ($status -eq 'OK') { 'Green' } else { 'Red' }
    Write-Host ("      -> {0} 实例  |  {1} ms  |  {2}" -f $n, $sw.ElapsedMilliseconds, $status) -ForegroundColor $color
    Write-Host ("      {0,-26} {1}" -f '查询耗时', "$($sw.ElapsedMilliseconds) ms") -ForegroundColor DarkGray

    if ($Quiet) { return }

    $take = if ($All) { $items } else { @($items | Select-Object -First 1) }
    $idx = 0
    foreach ($i in $take) {
        $idx++
        if ($All -and $items.Count -gt 1) { Write-Host "      -- 实例 #$idx --" -ForegroundColor DarkGray }
        $o = [ordered]@{}
        if ($Props.Count -gt 0) {
            foreach ($p in $Props) {
                $val = $null
                try { $val = $i.$p } catch { $val = $null }
                $o[$p] = $val
            }
        }
        else {
            foreach ($p in $i.CimInstanceProperties) { $o[$p.Name] = $p.Value }
        }
        Show-Row $o
    }
}

# ---------------------------------------------------------------- 开场
Write-Head "cowa · WMI 可行性探针  (PROTOTYPE — 用完即删)"
Write-Host "  机器      : $env:COMPUTERNAME"
Write-Host "  时间      : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "  PowerShell: $($PSVersionTable.PSVersion)"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Host "  管理员    : $isAdmin"
Write-Host "  查询上限  : $script:Budget 秒（模拟）"

# ---------------------------------------------------------------- 卡片三张
Write-Head "1. 顶行三张卡"

Probe -Label '型号信息 ← 设备型号' -Class 'Win32_ComputerSystem' -Props @(
    'Name','Manufacturer','Model','SystemType','PCSystemType','TotalPhysicalMemory','NumberOfProcessors')

Probe -Label '型号信息 备用（SMBIOS 产品名）' -Class 'Win32_ComputerSystemProduct' -Props @(
    'Vendor','Name','Version','IdentifyingNumber')

Probe -Label '系统信息 ← OS 版本 + 位数' -Class 'Win32_OperatingSystem' -Props @(
    'Caption','Version','BuildNumber','OSArchitecture','LastBootUpTime','InstallDate')

# ---------------------------------------------------------------- 详情八行
Write-Head "2. 详细信息的行 —— 单值"

Probe -Label '处理器' -Class 'Win32_Processor' -Props @(
    'Name','Manufacturer','MaxClockSpeed','CurrentClockSpeed','NumberOfCores','NumberOfLogicalProcessors')

Probe -Label '主板' -Class 'Win32_BaseBoard' -Props @(
    'Manufacturer','Product','Version','SerialNumber')

Probe -Label 'BIOS' -Class 'Win32_BIOS' -Props @(
    'Manufacturer','SMBIOSBIOSVersion','ReleaseDate','Version')

Write-Head "3. 详细信息的行 —— 多值"

Probe -Label '内存（逐条）' -Class 'Win32_PhysicalMemory' -All -Props @(
    'Manufacturer','Capacity','Speed','ConfiguredClockSpeed','PartNumber','DeviceLocator','BankLabel','SMBIOSMemoryType','FormFactor')

Probe -Label '内存 备用（合计/插槽）' -Class 'Win32_PhysicalMemoryArray' -Props @(
    'MemoryDevices','MaxCapacityEx','MemoryErrorCorrection')

Probe -Label '显卡（逐块）' -Class 'Win32_VideoController' -All -Props @(
    'Name','AdapterCompatibility','AdapterRAM','DriverVersion','VideoProcessor',
    'CurrentHorizontalResolution','CurrentVerticalResolution','CurrentRefreshRate','PNPDeviceID')

Probe -Label '显示器（Win32_DesktopMonitor）' -Class 'Win32_DesktopMonitor' -All -Props @(
    'Name','ScreenWidth','ScreenHeight','MonitorManufacturer','PNPDeviceID','Availability')

Probe -Label '磁盘（逐块）' -Class 'Win32_DiskDrive' -All -Props @(
    'Model','Size','InterfaceType','MediaType','Partitions','PNPDeviceID')

Probe -Label '声卡（逐个）' -Class 'Win32_SoundDevice' -All -Props @(
    'Name','Manufacturer','Status')

Probe -Label '网卡（逐个）' -Class 'Win32_NetworkAdapter' -All -Props @(
    'Name','AdapterType','MACAddress','Speed','NetConnectionID','NetEnabled','PNPDeviceID')

Probe -Label '电池（Win32_Battery）' -Class 'Win32_Battery' -All -Props @(
    'Name','DeviceID','EstimatedChargeRemaining','BatteryStatus','DesignVoltage')

# ---------------------------------------------------------------- root/wmi
Write-Head "4. root\wmi —— 更深命名空间（显示器 EDID / 电池）"

Probe -Label '显示器 EDID 身份（型号/厂商/英寸来源）' -Class 'WmiMonitorID' -Namespace 'root/wmi' -All -Props @(
    'InstanceName','ManufacturerName','ProductCodeID','UserFriendlyName','SerialNumberID','YearOfManufacture')

Probe -Label '显示器 物理尺寸（EDID）' -Class 'WmiMonitorBasicDisplayParams' -Namespace 'root/wmi' -All -Props @(
    'InstanceName','MaxHorizontalImageSize','MaxVerticalImageSize')

Probe -Label '显示器 连接方式' -Class 'WmiMonitorConnectionParams' -Namespace 'root/wmi' -All -Props @(
    'InstanceName','VideoOutputTechnology')

Probe -Label '★ 电池循环次数' -Class 'BatteryCycleCount' -Namespace 'root/wmi' -All
Probe -Label '★ 电池静态数据（含 DesignedCapacity）' -Class 'BatteryStaticData' -Namespace 'root/wmi' -All
Probe -Label '★ 电池满充容量' -Class 'BatteryFullChargedCapacity' -Namespace 'root/wmi' -All
Probe -Label '电池（MS 版）' -Class 'MSBatteryStaticData' -Namespace 'root/wmi' -All -Quiet
Probe -Label '电池（MS 满充）' -Class 'MSBatteryFullChargedCapacity' -Namespace 'root/wmi' -All -Quiet

# ---------------------------------------------------------------- 存储健康
Write-Head "5. 存储 —— ★通电时间只能走这里"

$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $disks = @(Get-PhysicalDisk -ErrorAction Stop)
    $sw.Stop()
    Write-Host ("`n  [物理磁盘]  Get-PhysicalDisk") -ForegroundColor White
    Write-Host ("      -> {0} 个  |  {1} ms  |  OK" -f $disks.Count, $sw.ElapsedMilliseconds) -ForegroundColor Green
    $i = 0
    foreach ($d in $disks) {
        $i++
        Write-Host "      -- 磁盘 #$i --" -ForegroundColor DarkGray
        Show-Row ([ordered]@{
            FriendlyName = $d.FriendlyName; Size = $d.Size; MediaType = $d.MediaType
            BusType = $d.BusType; HealthStatus = $d.HealthStatus
        })
    }
}
catch {
    $sw.Stop()
    Write-Host ("`n  [物理磁盘]  Get-PhysicalDisk") -ForegroundColor White
    Write-Host ("      -> FAIL: {0}  ({1} ms)" -f ($_.Exception.Message -split "`r?`n")[0], $sw.ElapsedMilliseconds) -ForegroundColor Red
}

$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $phys = @(Get-PhysicalDisk -ErrorAction Stop)
    $rel  = @($phys | ForEach-Object { Get-StorageReliabilityCounter -PhysicalDisk $_ -ErrorAction Stop })
    $sw.Stop()
    Write-Host ("`n  [★通电时间]  Get-StorageReliabilityCounter") -ForegroundColor White
    Write-Host ("      -> {0} 条  |  {1} ms  |  OK" -f $rel.Count, $sw.ElapsedMilliseconds) -ForegroundColor Green
    $i = 0
    foreach ($r in $rel) {
        $i++
        Write-Host "      -- 磁盘 #$i --" -ForegroundColor DarkGray
        Show-Row ([ordered]@{
            'FriendlyName' = $phys[$i-1].FriendlyName
            '★ PowerOnHours' = $r.PowerOnHours
            'Wear' = $r.Wear; 'Temperature' = $r.Temperature
            'StartStopCycleCount' = $r.StartStopCycleCount
            'ReadErrorsTotal' = $r.ReadErrorsTotal
        })
    }
}
catch {
    $sw.Stop()
    Write-Host ("`n  [★通电时间]  Get-StorageReliabilityCounter") -ForegroundColor White
    Write-Host ("      -> FAIL: {0}  ({1} ms)" -f ($_.Exception.Message -split "`r?`n")[0], $sw.ElapsedMilliseconds) -ForegroundColor Red
}

# ---------------------------------------------------------------- 多显示器
Write-Head "6. ★多显示器：分辨率 / 刷新率 到底按谁报？"

Write-Host "`n  [A] Win32_VideoController 报的分辨率（按显卡，不是按显示器）" -ForegroundColor White
try {
    Get-CimInstance Win32_VideoController -ErrorAction Stop | ForEach-Object {
        Write-Host ("      {0}" -f $_.Name)
        Write-Host ("        分辨率 = {0}x{1}   刷新率 = {2} Hz" -f `
            $_.CurrentHorizontalResolution, $_.CurrentVerticalResolution, $_.CurrentRefreshRate)
    }
} catch { Write-Host "      FAIL: $($_.Exception.Message)" -ForegroundColor Red }

Write-Host "`n  [B] .NET Screen.AllScreens —— 能拿到几块显示器、各自尺寸" -ForegroundColor White
try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    $scr = [System.Windows.Forms.Screen]::AllScreens
    Write-Host ("      -> {0} 块" -f $scr.Count) -ForegroundColor Green
    $i = 0
    foreach ($s in $scr) {
        $i++
        Write-Host ("      #{0} {1}  {2}x{3}  Primary={4}" -f `
            $i, $s.DeviceName, $s.Bounds.Width, $s.Bounds.Height, $s.Primary)
    }
}
catch { Write-Host "      FAIL: $($_.Exception.Message)" -ForegroundColor Red }

Write-Host "`n  [C] EnumDisplaySettings —— 逐显示器拿 分辨率 + 刷新率（需要 P/Invoke）" -ForegroundColor White
try {
    Add-Type -ErrorAction Stop -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class CowaDisp {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DEVMODE {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
        public short dmSpecVersion, dmDriverVersion, dmSize, dmDriverExtra;
        public int dmFields;
        public int dmPositionX, dmPositionY;
        public int dmDisplayOrientation, dmDisplayFixedOutput;
        public short dmColor, dmDuplex, dmYResolution, dmTTOption, dmCollate;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
        public short dmLogPixels;
        public int dmBitsPerPel, dmPelsWidth, dmPelsHeight, dmDisplayFlags, dmDisplayFrequency;
        public int dmICMMethod, dmICMIntent, dmMediaType, dmDitherType, dmReserved1, dmReserved2, dmPanningWidth, dmPanningHeight;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DISPLAY_DEVICE {
        public int cb;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]  public string DeviceName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceString;
        public int StateFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceID;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceKey;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern bool EnumDisplayDevices(string lpDevice, uint iDevNum, ref DISPLAY_DEVICE lpDisplayDevice, uint dwFlags);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern bool EnumDisplaySettings(string lpszDeviceName, int iModeNum, ref DEVMODE lpDevMode);

    public const int ENUM_CURRENT_SETTINGS = -1;
    public const int DISPLAY_DEVICE_ATTACHED_TO_DESKTOP = 0x00000001;

    public static string Report() {
        var sb = new System.Text.StringBuilder();
        uint i = 0;
        var dd = new DISPLAY_DEVICE(); dd.cb = Marshal.SizeOf(typeof(DISPLAY_DEVICE));
        while (EnumDisplayDevices(null, i, ref dd, 0)) {
            bool attached = (dd.StateFlags & DISPLAY_DEVICE_ATTACHED_TO_DESKTOP) != 0;
            if (attached) {
                var dm = new DEVMODE();
                bool ok = EnumDisplaySettings(dd.DeviceName, ENUM_CURRENT_SETTINGS, ref dm);
                sb.AppendLine(string.Format("      #{0} {1}", i, dd.DeviceString));
                sb.AppendLine(string.Format("         DeviceName = {0}", dd.DeviceName));
                if (ok) {
                    sb.AppendLine(string.Format("         {0}x{1} @ {2} Hz  ({3} bit)", dm.dmPelsWidth, dm.dmPelsHeight, dm.dmDisplayFrequency, dm.dmBitsPerPel));
                } else {
                    sb.AppendLine("         EnumDisplaySettings 失败");
                }
            }
            dd = new DISPLAY_DEVICE(); dd.cb = Marshal.SizeOf(typeof(DISPLAY_DEVICE));
            i++;
        }
        return sb.ToString();
    }
}
'@
    Write-Host (([CowaDisp]::Report())) -ForegroundColor Green
}
catch { Write-Host "      FAIL: $($_.Exception.Message)" -ForegroundColor Red }

# ---------------------------------------------------------------- 传输开销
Write-Head "7. 传输开销 —— 「一条命令说清全部」要多久？"

$probeStartup = {
    $x = Get-CimInstance Win32_Processor -OperationTimeoutSec 3
    $y = Get-CimInstance Win32_BaseBoard -OperationTimeoutSec 3
    $z = Get-CimInstance Win32_PhysicalMemory -OperationTimeoutSec 3
    $null = $x, $y, $z
}
foreach ($exe in @('powershell', 'pwsh')) {
    try {
        $cmd = Get-Command $exe -ErrorAction Stop
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        & $cmd.Source -NoProfile -NonInteractive -Command $probeStartup | Out-Null
        $sw.Stop()
        Write-Host ("      {0,-12} 冷启动 + 3 个查询 = {1} ms" -f $exe, $sw.ElapsedMilliseconds) -ForegroundColor Green
    }
    catch { Write-Host ("      {0,-12} 不可用" -f $exe) -ForegroundColor DarkYellow }
}

$script:Total.Stop()
Write-Head "探针结束"
Write-Host ("  总耗时: {0} ms`n" -f $script:Total.ElapsedMilliseconds) -ForegroundColor Cyan
