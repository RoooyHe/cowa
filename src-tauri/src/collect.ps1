# cowa 采集脚本。
#
# Rust 侧只 spawn 这一个进程（见 docs/adr/0004），脚本每解析出一个字段就吐一行
# JSON，Rust 逐行读出、逐条发给前端。绝不整份一次性返回——`骨架` 要逐格填满。
#
# 这一票（issue #2）是 tracer bullet：只采 `处理器` 一个真字段，其余十个留空，
# 由 UI 侧在流关闭后渲染成 `未知`。后续票再逐行补齐。
# 任何失败都降级为 `unknown`，脚本永不抛。

$ErrorActionPreference = 'Stop'

function Emit-Field([string] $Field, $Values) {
  [pscustomobject]@{ field = $Field; values = $Values } | ConvertTo-Json -Compress -Depth 6
}

function New-Value([string] $Text) {
  [pscustomobject]@{ kind = 'value'; text = $Text }
}

function New-Unknown {
  [pscustomobject]@{ kind = 'unknown' }
}

try {
  $cpu = Get-CimInstance Win32_Processor -ErrorAction Stop | Select-Object -First 1
  if ($cpu -and $cpu.Name) {
    Emit-Field 'processor' @(New-Value $cpu.Name)
  }
  else {
    Emit-Field 'processor' @(New-Unknown)
  }
}
catch {
  Emit-Field 'processor' @(New-Unknown)
}
