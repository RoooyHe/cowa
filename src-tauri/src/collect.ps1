# cowa 采集脚本。
#
# Rust 侧只 spawn 这一个进程（见 docs/adr/0004），脚本每解析出一个字段就吐一行
# JSON，Rust 逐行读出、逐条发给前端。绝不整份一次性返回——`骨架` 要逐格填满。
#
# issue #4 覆盖：三张卡（型号信息 / 系统信息 / 运行时间）+ 处理器 / 主板 /
# 内存 / 磁盘 四行。
# issue #5 覆盖：显卡 / 显示器 / 声卡 / 网卡 / 电池 五行——这一票引入
# `设备树枚举`（一次 Win32_PnPEntity）与 `实例过滤`（真实总线前缀白名单）。
#
# 跨字段的规矩：
#   1. `并陈`    —— 磁盘容量写出 `512GB` 与 `476.9 GiB` 两个真值。
#   2. `枚举翻译` —— 采集侧只吐 WMI 的原始枚举值（`enum`），翻成人话是 UI 的事
#                    （见 docs/adr/0006）。
#   3. `查询上限` —— 每个字段各有自己的上限（$BudgetMs），不是一个全局值。
#   4. `实例过滤` —— 多值行只列 `物理设备`（白名单前缀），`虚拟设备` 默认排除
#                    （见 docs/adr/0003）。
#
# 任何失败（查询超过该字段的查询上限、属性为空、没有实例）都降级为 `未知`，
# 脚本永不抛。

$ErrorActionPreference = 'Stop'

# 中文要经过 stdout 原样到达 Rust（BufReader 按 UTF-8 读）。
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Emit-Field([string] $Field, $Values) {
  [pscustomobject]@{ field = $Field; values = $Values } | ConvertTo-Json -Compress -Depth 8
}

# 契约里的三种写法：整个值（value / unknown / parts）+ 组合值里的段（text / enum）。
function New-Value([string] $Text) {
  [pscustomobject]@{ kind = 'value'; text = $Text }
}

function New-Unknown {
  [pscustomobject]@{ kind = 'unknown' }
}

function New-Composite($Parts) {
  [pscustomobject]@{ kind = 'parts'; parts = $Parts }
}

function New-TextPart([string] $Text) {
  [pscustomobject]@{ kind = 'text'; text = $Text }
}

function New-EnumPart([string] $Table, [int] $Code) {
  [pscustomobject]@{ kind = 'enum'; table = $Table; code = $Code }
}

# `查询上限`（查询允许等待的最长时间，毫秒）——每个字段各有一个。
# 数值取自 prototype/wmi-probe 的实测（处理器 1295 ms、主板 8 ms……），留了余量；
# 超过上限就放弃该字段，写 `未知`。具体数字待真机继续标定。
$BudgetMs = @{
  model     = 1000
  system    = 800
  uptime    = 800
  processor = 3000
  mainboard = 500
  memory    = 500
  disk      = 1500
  gpu       = 3000
  display   = 3000
  sound     = 3000
  network   = 3000
  battery   = 1500
}

# 显卡 / 显示器 / 磁盘 / 声卡 / 网卡 五行共用**一次**设备树枚举（issue #5），于是也
# 共用它的上限——取五行各自上限里最紧的那个。这与「每个查询各有一个上限」不冲突：
# 五行是一次查询，不是五次。
$DeviceTreeBudgetMs = [Math]::Min(
  [Math]::Min($BudgetMs['gpu'], $BudgetMs['display']),
  [Math]::Min([Math]::Min($BudgetMs['disk'], $BudgetMs['sound']), $BudgetMs['network']))

# 命名空间连一次就复用：每个 Searcher 各自连一遍 root\cimv2，15 个字段就是
# 十几趟连接开销（实测一趟约 46 ms，缓存后约 5 ms）。
$Scopes = @{}
function Get-Scope([string] $Namespace) {
  if (-not $Scopes.ContainsKey($Namespace)) {
    $scope = New-Object System.Management.ManagementScope($Namespace)
    $scope.Connect()
    $Scopes[$Namespace] = $scope
  }
  return $Scopes[$Namespace]
}

# 一次 WMI 查询，按给定的上限等待（System.Management 而不是 Get-CimInstance：
# 前者的 Options.Timeout 是 TimeSpan，能表达毫秒级的上限，后者只有整秒）。
function Query-Ms([string] $Namespace, [string] $Class, [int] $LimitMs) {
  $searcher = New-Object System.Management.ManagementObjectSearcher((Get-Scope $Namespace), "SELECT * FROM $Class")
  $searcher.Options.Timeout = [TimeSpan]::FromMilliseconds($LimitMs)
  return @($searcher.Get())
}

# 按该字段自己的上限查。
function Query([string] $Field, [string] $Class, [string] $Namespace = 'root\cimv2') {
  if (-not $BudgetMs.ContainsKey($Field)) {
    throw "字段 $Field 没有查询上限"
  }
  return Query-Ms $Namespace $Class ([int]$BudgetMs[$Field])
}

# 每个字段都从这里走：查询、组装、吐一行。任一步失败都降级为 `未知`。
# `-Compose` 拿到该查询的全部实例，返回这个字段的 `values` 数组。
function Collect([string] $Field, [string] $Class, [scriptblock] $Compose) {
  try {
    $instances = @(Query $Field $Class)
    if ($instances.Count -eq 0) { throw "没有实例" }
    Emit-Field $Field @(& $Compose $instances)
  }
  catch {
    Emit-Unknown $Field
  }
}

function Emit-Unknown([string] $Field) {
  Emit-Field $Field @(New-Unknown)
}

# ---- 型号信息（设备型号 + 计算机名 + PCSystemType 翻译）----
Collect 'model' 'Win32_ComputerSystem' {
  param($instances)
  $cs = $instances[0]
  $model = ("$($cs.Manufacturer) $($cs.Model)").Trim()
  if (-not $model) { throw '型号为空' }
  # `PCSystemType` 不在这里翻——UI 侧查表（issue #4「枚举翻译」）。
  $secondary = New-Composite @((New-EnumPart 'systemType' ([int]$cs.PCSystemType)), (New-TextPart (" · $($cs.Name)")))
  @((New-Value $model), $secondary)
}

# ---- 系统信息（OS 名称 + 位数 + 内部版本号）----
Collect 'system' 'Win32_OperatingSystem' {
  param($instances)
  $os = $instances[0]
  $name = ($os.Caption -replace '^Microsoft\s+', '').Trim()
  if (-not $name) { throw 'OS 名称为空' }
  @((New-Value $name), (New-Value "$($os.OSArchitecture) · 内部版本 $($os.BuildNumber)"))
}

# ---- 运行时间（死钟：启动那一刻的快照，之后不再动）----
Collect 'uptime' 'Win32_OperatingSystem' {
  param($instances)
  $os = $instances[0]
  if (-not $os.LastBootUpTime) { throw '没有启动时间' }
  $boot = [System.Management.ManagementDateTimeConverter]::ToDateTime([string]$os.LastBootUpTime)
  $span = (Get-Date) - $boot
  $parts = @()
  if ($span.Days -gt 0) { $parts += "$($span.Days)天" }
  if ($span.Days -gt 0 -or $span.Hours -gt 0) { $parts += "$($span.Hours)小时" }
  if ($span.Days -gt 0 -or $span.Hours -gt 0 -or $span.Minutes -gt 0) { $parts += "$($span.Minutes)分钟" }
  $parts += "$($span.Seconds)秒"
  @((New-Value ($parts -join '')))
}

# ---- 处理器 ----
Collect 'processor' 'Win32_Processor' {
  param($instances)
  $cpu = $instances[0]
  if (-not $cpu.Name) { throw 'CPU 名称为空' }
  $suffix = ''
  if ($null -ne $cpu.NumberOfCores -and $null -ne $cpu.NumberOfLogicalProcessors) {
    $suffix = "（$($cpu.NumberOfCores) 核 / $($cpu.NumberOfLogicalProcessors) 线程）"
  }
  @((New-Value "$($cpu.Name)$suffix"))
}

# ---- 主板 ----
Collect 'mainboard' 'Win32_BaseBoard' {
  param($instances)
  $board = $instances[0]
  $name = ("$($board.Manufacturer) $($board.Product)").Trim()
  if (-not $name) { throw '主板型号为空' }
  @((New-Value $name))
}

# ---- 内存（厂商 + 总容量 + SMBIOSMemoryType + 频率 + 逐条容量）----
Collect 'memory' 'Win32_PhysicalMemory' {
  param($instances)
  $total = ($instances | Measure-Object -Property Capacity -Sum).Sum
  $maker = @($instances | ForEach-Object { $_.Manufacturer } | Where-Object { $_ } | Select-Object -Unique) -join ' / '
  $perStick = @($instances | ForEach-Object { '{0}GB' -f [math]::Round([double]$_.Capacity / 1GB) }) -join ' + '
  $speed = [int]$instances[0].Speed
  $type = [int]$instances[0].SMBIOSMemoryType
  if (-not $total -or -not $speed) { throw '内存容量或频率为空' }
  # `SMBIOSMemoryType = 26` 原样交给 UI，由它翻成 `DDR4`。
  $parts = @(
    (New-TextPart ("$maker {0}GB " -f [math]::Round($total / 1GB))),
    (New-EnumPart 'memoryType' $type),
    (New-TextPart (" ${speed}MHz（$perStick）"))
  )
  @((New-Composite $parts))
}

# ---- 磁盘：设备树挑实例，容量问 Win32_DiskDrive（标称 GB 与实测 GiB 两个真值）----

# ============================ 设备树（issue #5）============================
#
# 显卡 / 显示器 / 磁盘 / 声卡 / 网卡 的**实例**都从一次 Win32_PnPEntity 枚举里按
# `PNPClass` 分。若不从同一个设备树枚举、而是各自去查对应的 `Win32_*` 类，实例数
# 就会与参考图对不上（网卡会变成 19 条：Hyper-V、WAN Miniport、Wi-Fi Direct……）。
# 设备树决定「哪些实例算数」；展示用的名字与明细再去各自对应的类里按
# `PNPDeviceID` 对齐。

# `物理设备` 白名单：只认这些**真实总线前缀**开头的 `PNPDeviceID`（issue #5）。
# 其余（`ROOT\`、`SWD\`、`SW\`、`BTH`…、`{GUID}\`、`INDIRECTDSP\`…）一律算
# `虚拟设备`，**默认排除未知**（见 docs/adr/0003）。选白名单而不是黑名单：
# 新出现的虚拟设备不会溜进来；代价是某种新总线上的真实设备会被默默漏掉。
$RealBusPrefixes = @(
  'PCI\'
  'USB\'
  'SCSI\'
  'NVME\'
  'INTELAUDIO\'
  'HDAUDIO\'
  'DISPLAY\'
)

function Test-PhysicalDevice([string] $PnpDeviceId) {
  if (-not $PnpDeviceId) { return $false }
  foreach ($prefix in $RealBusPrefixes) {
    if ($PnpDeviceId.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
  }
  return $false
}

# `DISPLAY\CMN1604\4&9fb62f5&1&UID265988` → `CMN1604`（设备树与 EDID 用同一段对齐）。
function Get-DeviceCode([string] $PnpDeviceId) {
  if (-not $PnpDeviceId) { return '' }
  $segments = $PnpDeviceId.Split('\')
  if ($segments.Count -ge 2) { return $segments[1] }
  return ''
}

# WmiMonitorID 的字节数组转 ASCII，NUL 截断（issue #5）。
function Convert-Ascii($Bytes) {
  if ($null -eq $Bytes) { return '' }
  $chars = @()
  foreach ($byte in $Bytes) {
    if ($byte -eq 0) { break }
    $chars += [char]$byte
  }
  return (-join $chars).Trim()
}

# 某个 PNPClass 下、通过白名单的实例。
function Get-Class($ByClass, [string] $Class) {
  if ($ByClass.ContainsKey($Class)) { return @($ByClass[$Class]) }
  return @()
}

# 按 `PNPDeviceID` 从某个明细类取展示名（取不到就退回设备树自己的 Name）。
function Get-NameMap([string] $Field, [string] $Class) {
  $map = @{}
  try {
    foreach ($instance in @(Query $Field $Class)) {
      if ($instance.PNPDeviceID) { $map["$($instance.PNPDeviceID)"] = "$($instance.Name)".Trim() }
    }
  }
  catch { }
  return $map
}

function Compose-ByName($Entities, $Names) {
  $values = @()
  foreach ($entity in $Entities) {
    $name = $Names["$($entity.PNPDeviceID)"]
    if (-not $name) { $name = "$($entity.Name)".Trim() }
    if ($name) { $values += New-Value $name }
  }
  if ($values.Count -eq 0) { return @(New-Unknown) }
  return @($values)
}

# ---- 显卡：设备树给型号，显存与子厂商问 Win32_VideoController ----
function Compose-Gpu($GpuEntities) {
  if ($GpuEntities.Count -eq 0) { return @(New-Unknown) }
  $controllers = @{}
  try {
    foreach ($controller in @(Query 'gpu' 'Win32_VideoController')) {
      if ($controller.PNPDeviceID) { $controllers["$($controller.PNPDeviceID)"] = $controller }
    }
  }
  catch { }
  $values = @()
  foreach ($display in $GpuEntities) {
    $detail = $controllers["$($display.PNPDeviceID)"]
    $name = if ($detail -and $detail.Name) { "$($detail.Name)".Trim() } else { "$($display.Name)".Trim() }
    if (-not $name) { continue }
    $vendor = if ($detail) { "$($detail.AdapterCompatibility)".Trim() } else { '' }
    # `AdapterRAM` 是 32 位字段，>4GB 会给溢出的垃圾数——`照抄`，不校正（ADR-0003）。
    if ($detail -and $null -ne $detail.AdapterRAM -and $vendor) {
      $mb = [long][math]::Round([double]$detail.AdapterRAM / 1MB)
      $values += New-Value "$name（${mb}MB / $vendor）"
    }
    else {
      $values += New-Value $name
    }
  }
  if ($values.Count -eq 0) { return @(New-Unknown) }
  return @($values)
}

# ---- 磁盘：设备树挑实例，容量问 Win32_DiskDrive ----
function Compose-Disk($DiskEntities) {
  if ($DiskEntities.Count -eq 0) { return @(New-Unknown) }
  $drives = @{}
  try {
    foreach ($drive in @(Query 'disk' 'Win32_DiskDrive')) {
      if ($drive.PNPDeviceID) { $drives["$($drive.PNPDeviceID)"] = $drive }
    }
  }
  catch { }
  $values = @()
  foreach ($disk in $DiskEntities) {
    $detail = $drives["$($disk.PNPDeviceID)"]
    $size = if ($detail) { [double]$detail.Size } else { 0 }
    if ($size -le 0) {
      $name = "$($disk.Name)".Trim()
      if ($name) { $values += New-Value $name }
      continue
    }
    $values += [pscustomobject]@{
      kind    = 'pair'
      lead    = ("$($detail.Model)").Trim()
      nominal = '{0}GB' -f [math]::Round($size / 1e9)
      actual  = '{0:N1} GiB' -f ($size / 1GB)
    }
  }
  if ($values.Count -eq 0) { return @(New-Unknown) }
  return @($values)
}

# ---- 显示器：型号 + 设备 ID + 物理英寸 + 逐显示器的分辨率与刷新率 ----
# 分辨率必须逐显示器拿：`Win32_VideoController` 按适配器报，不是按显示器报。
# `EnumDisplaySettings` 只有 P/Invoke 一条路（`.NET Screen` 没有刷新率），
# 于是用 Add-Type 现编一个 C# 包装；编译失败就退化成「型号 + 英寸」。
$DisplayModeSource = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class CowaDisplays
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DEVMODE
    {
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
    public struct DISPLAY_DEVICE
    {
        public int cb;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string DeviceName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceString;
        public int StateFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceID;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceKey;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern bool EnumDisplayDevices(string lpDevice, uint iDevNum, ref DISPLAY_DEVICE lpDisplayDevice, uint dwFlags);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern bool EnumDisplaySettings(string lpszDeviceName, int iModeNum, ref DEVMODE lpDevMode);

    const int ENUM_CURRENT_SETTINGS = -1;
    const int DISPLAY_DEVICE_ATTACHED_TO_DESKTOP = 0x00000001;

    // 每个接在桌面上的输出一行：`<型号代码>|<宽>|<高>|<刷新率>`。
    public static string[] Modes()
    {
        var lines = new List<string>();
        uint index = 0;
        var adapter = new DISPLAY_DEVICE();
        adapter.cb = Marshal.SizeOf(typeof(DISPLAY_DEVICE));
        while (EnumDisplayDevices(null, index, ref adapter, 0))
        {
            if ((adapter.StateFlags & DISPLAY_DEVICE_ATTACHED_TO_DESKTOP) != 0)
            {
                var monitor = new DISPLAY_DEVICE();
                monitor.cb = Marshal.SizeOf(typeof(DISPLAY_DEVICE));
                string code = "";
                if (EnumDisplayDevices(adapter.DeviceName, 0, ref monitor, 0))
                {
                    var parts = monitor.DeviceID.Split('\\');
                    if (parts.Length > 1) code = parts[1];
                }
                var mode = new DEVMODE();
                if (EnumDisplaySettings(adapter.DeviceName, ENUM_CURRENT_SETTINGS, ref mode))
                {
                    lines.Add(code + "|" + mode.dmPelsWidth + "|" + mode.dmPelsHeight + "|" + mode.dmDisplayFrequency);
                }
            }
            adapter = new DISPLAY_DEVICE();
            adapter.cb = Marshal.SizeOf(typeof(DISPLAY_DEVICE));
            index++;
        }
        return lines.ToArray();
    }
}
'@

function Get-MonitorIds {
  # `WmiMonitorID` 的 ManufacturerName + ProductCodeID = `CMN` + `1604`。
  $map = @{}
  try {
    foreach ($monitor in @(Query 'display' 'WmiMonitorID' 'root\wmi')) {
      $code = Get-DeviceCode $monitor.InstanceName
      if (-not $code) { continue }
      $id = (Convert-Ascii $monitor.ManufacturerName) + (Convert-Ascii $monitor.ProductCodeID)
      if ($id) { $map[$code] = $id }
    }
  }
  catch { }
  return $map
}

function Get-MonitorSizes {
  # `WmiMonitorBasicDisplayParams` 给的是厘米长宽，取对角线 ÷ 2.54 得英寸。
  $map = @{}
  try {
    foreach ($params in @(Query 'display' 'WmiMonitorBasicDisplayParams' 'root\wmi')) {
      $code = Get-DeviceCode $params.InstanceName
      $horizontal = [double]$params.MaxHorizontalImageSize
      $vertical = [double]$params.MaxVerticalImageSize
      if ($code -and $horizontal -gt 0 -and $vertical -gt 0) {
        $inches = [math]::Sqrt($horizontal * $horizontal + $vertical * $vertical) / 2.54
        $map[$code] = $inches.ToString('0.0', [System.Globalization.CultureInfo]::InvariantCulture)
      }
    }
  }
  catch { }
  return $map
}

function Get-DisplayModes {
  $map = @{}
  # `.NET Framework` 的 csc 会把 `LIB` 环境变量当库路径，指错地方（比如装了
  # PostgreSQL 的机器）就编译失败；编译前先摘掉它，退出时还原。编译不了就
  # 退化成没有分辨率——型号与英寸还在。
  $savedLib = $env:LIB
  $env:LIB = $null
  try {
    Add-Type -ErrorAction Stop -TypeDefinition $DisplayModeSource
    foreach ($line in [CowaDisplays]::Modes()) {
      $parts = $line -split '\|'
      if ($parts.Count -ge 4 -and $parts[0] -and $parts[1] -and $parts[2] -and $parts[3]) {
        $map[$parts[0]] = "$($parts[1])×$($parts[2]) @ $($parts[3])Hz"
      }
    }
  }
  catch { }
  finally { $env:LIB = $savedLib }
  return $map
}

function Compose-Display($Monitors) {
  if ($Monitors.Count -eq 0) { return @(New-Unknown) }
  $ids = Get-MonitorIds
  $sizes = Get-MonitorSizes
  $modes = Get-DisplayModes
  $values = @()
  foreach ($monitor in $Monitors) {
    $code = Get-DeviceCode $monitor.PNPDeviceID
    $name = "$($monitor.Name)".Trim()
    if (-not $name) { continue }
    $text = $name
    $deviceId = if ($ids.ContainsKey($code)) { $ids[$code] } else { $code }
    if ($deviceId) { $text += " [$deviceId]" }
    if ($sizes.ContainsKey($code)) { $text += "（$($sizes[$code]) 英寸）" }
    if ($modes.ContainsKey($code)) { $text += $modes[$code] }
    $values += New-Value $text
  }
  if ($values.Count -eq 0) { return @(New-Unknown) }
  return @($values)
}

function Collect-DeviceTree {
  $entities = @()
  try {
    $entities = @(Query-Ms 'root\cimv2' 'Win32_PnPEntity' $DeviceTreeBudgetMs)
  }
  catch {
    foreach ($field in @('gpu', 'display', 'disk', 'sound', 'network')) { Emit-Unknown $field }
    return
  }

  $byClass = @{}
  foreach ($entity in $entities) {
    if (-not (Test-PhysicalDevice $entity.PNPDeviceID)) { continue }
    $key = "$($entity.PNPClass)"
    if (-not $byClass.ContainsKey($key)) { $byClass[$key] = @() }
    $byClass[$key] += $entity
  }

  Emit-Field 'gpu' @(Compose-Gpu @(Get-Class $byClass 'Display'))
  Emit-Field 'display' @(Compose-Display @(Get-Class $byClass 'Monitor'))
  Emit-Field 'disk' @(Compose-Disk @(Get-Class $byClass 'DiskDrive'))
  Emit-Field 'sound' @(Compose-ByName @(Get-Class $byClass 'MEDIA') (Get-NameMap 'sound' 'Win32_SoundDevice'))
  Emit-Field 'network' @(Compose-ByName @(Get-Class $byClass 'Net') (Get-NameMap 'network' 'Win32_NetworkAdapter'))
}

# ---- 电池：有电池才有循环次数，台式机照旧写 `未知` ----
function Collect-Battery {
  try {
    $batteries = @(Query 'battery' 'Win32_Battery')
    if ($batteries.Count -eq 0) { throw '没有电池实例' }
    $cycles = $null
    try {
      $counters = @(Query 'battery' 'BatteryCycleCount' 'root\wmi')
      if ($counters.Count -gt 0 -and $null -ne $counters[0].CycleCount) {
        $cycles = [int]$counters[0].CycleCount
      }
    }
    catch { }
    if ($null -ne $cycles) {
      Emit-Field 'battery' @(New-Value "$cycles 次循环")
      return
    }
    $name = "$($batteries[0].Name)".Trim()
    if ($name) { Emit-Field 'battery' @(New-Value $name) } else { Emit-Unknown 'battery' }
  }
  catch {
    Emit-Unknown 'battery'
  }
}

# ---- 五行：设备树一次枚举分五行，电池单独 ----
Collect-DeviceTree
Collect-Battery
