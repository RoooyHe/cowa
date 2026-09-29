# cowa 采集脚本。
#
# Rust 侧只 spawn 这一个进程（见 docs/adr/0004），脚本每解析出一个字段就吐一行
# JSON，Rust 逐行读出、逐条发给前端。绝不整份一次性返回——`骨架` 要逐格填满。
#
# issue #4 覆盖：三张卡（型号信息 / 系统信息 / 运行时间）+ 处理器 / 主板 /
# 内存 / 磁盘 四行。其余五行由后续的采集票（#5）补齐，这里不吐它们。
#
# 三条跨字段的规矩：
#   1. `并陈`    —— 磁盘容量写出 `512GB` 与 `476.9 GiB` 两个真值。
#   2. `枚举翻译` —— 采集侧只吐 WMI 的原始枚举值（`enum`），翻成人话是 UI 的事
#                    （见 docs/adr/0006）。
#   3. `查询上限` —— 每个字段各有自己的上限（$BudgetMs），不是一个全局值。
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
}

# 一次 WMI 查询，按该字段自己的上限等待。
# 用 System.Management 而不是 Get-CimInstance：前者的 Options.Timeout 是
# TimeSpan，能表达毫秒级的上限（后者只有整秒）。它是每次操作的等待上限，
# 不含首次连接命名空间的开销（实测 1 ms 的上限也要 ~300 ms 才返回）——
# 标定预算时把这段算进去。
function Query([string] $Field, [string] $Class) {
  if (-not $BudgetMs.ContainsKey($Field)) {
    throw "字段 $Field 没有查询上限"
  }
  $searcher = New-Object System.Management.ManagementObjectSearcher('root\cimv2', "SELECT * FROM $Class")
  $searcher.Options.Timeout = [TimeSpan]::FromMilliseconds($BudgetMs[$Field])
  return @($searcher.Get())
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

# ---- 磁盘（型号 + 容量的两个真值：标称 GB 与实测 GiB）----
Collect 'disk' 'Win32_DiskDrive' {
  param($instances)
  $values = @()
  foreach ($disk in $instances) {
    $size = [double]$disk.Size
    if (-not $size) { throw '磁盘容量为空' }
    $values += [pscustomobject]@{
      kind    = 'pair'
      lead    = ("$($disk.Model)").Trim()
      nominal = '{0}GB' -f [math]::Round($size / 1e9)
      actual  = '{0:N1} GiB' -f ($size / 1GB)
    }
  }
  $values
}
