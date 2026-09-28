# 探针裁决

**问题**：范围清单里的每一格，在这台机器（`HUAWEI HBL-WX9` / Windows 11 build 26200 / 非管理员）上到底拿不拿得到，各要多久？

**跑法**：`bun run probe:wmi`（`probe.ps1`，pwsh 7.6.6）
**原始输出**：`.scratch/wmi-probe/RESULT.txt`（502 行）
**日期**：2026-09-28

---

## 结论：三个已定决策被推翻

### ❌ 1. `档 A / 档 B` 那条轴选错了

我当时让你在「只查现成 WMI 类」和「读注册表 EDID 二进制自己解析」之间选，你选了 A。**这个二选一是假的。**

真实情况：显示器那一整行的数据，**全都在 WMI 里，没有一个字节需要啃二进制**。

| 参考图上的字样 | 真值 | 来源 | 需要解析二进制吗 |
|---|---|---|---|
| `[奇美 CMN1604]` | `CMN1604` | `root\wmi:WmiMonitorID` 的 `ManufacturerName` + `ProductCodeID`（**字节数组**，转 ASCII 即可） | 否 |
| `Redmi 215 NF` | `Redmi 215 NF` | 同上，`UserFriendlyName` 字节数组 = `82,101,100,109,105,32,50,49,53,32,78,70` | 否 |
| `[小米 XMIA011]` | `XMIA011` | 同上，`InstanceName` | 否 |
| `（16.2英寸）` | 16.21" | `root\wmi:WmiMonitorBasicDisplayParams`：36cm × 20cm，对角线 ÷ 2.54 | 否（只是勾股定理） |
| `（21.5英寸）` | 21.49" | 同上：48cm × 26cm | 否 |
| `N161HCA-EA3` | — | **拿不到**（面板零件号，鲁大师多半自带数据库） | — |

**正确的轴是**：「**调系统 API / 查 WMI**」vs「**自己啃二进制**」。显示器型号与英寸属于前者——我们白白砍掉了它们。

### ❌ 2. `照抄` 在这台机器上会炸

`照抄` 是为「不判断**值的真伪**」立的。但探针暴露了另一件事：它同时禁止判断**哪些实例算数**。实测实例数：

| 行 | 实例数 | 内容 | 参考图显示 |
|---|---|---|---|
| 网卡 | **19** | Hyper-V 虚拟交换机 ×4、WAN Miniport ×8、Wi-Fi Direct 虚拟适配器 ×2、蓝牙 PAN、vEthernet ×2… | **1** |
| 显卡 | **3** | Intel UHD 620、NVIDIA MX250、**Virtual Display Device**（华为间接显示驱动） | 2 |
| 声卡 | **3** | Realtek、**NVIDIA Virtual Audio Device**、英特尔显示器音频 | 2 |
| 显示器 | **3** | 真实 1 + 「默认监视器」×2（其中一个全空） | 2 |

**字面执行 `照抄` = 屏上列 19 行网卡。**

### ❌ 3. `★通电时间` 拿不到，而且太慢

```
Get-PhysicalDisk                      3675 ms   OK（1 个）
Get-StorageReliabilityCounter           FAIL: 无法从客户端中访问 CIM 资源。(CimException)
root\wmi:MSStorageDriver_ATAPISmartData FAIL: 不支持
MSFT_PhysicalDisk                       OK —— 但全属性里没有 PowerOnHours
```
- 三条路都已试过：SMART 原始字节那条**驱动不支持**；`MSFT_PhysicalDisk` **根本没有这个字段**；只剩 `Get-StorageReliabilityCounter`，它报的是**访问拒绝**。
- 探针是**非管理员**跑的（`Admin = False`）。**若它需要提权，cowa 就基本没戏**——一个零交互的信息应用不能为了一个字段要求 UAC。**需要一次提权重跑定性**（要你点一下 UAC）。
- 即使能拿到，`Get-PhysicalDisk` 单次 **3675 ms**，而设想的查询上限是 **2 秒**——**它会永远超时成 `未知`**。
- 旁证：`Win32_DiskDrive` 只用 **12 ms**，且给了型号与容量。慢的是 `Get-PhysicalDisk`（Storage 模块）。

---

## 其它实证发现

**慢查询排行**（决定查询上限该定多少）
| 查询 | 耗时 |
|---|---|
| `Get-PhysicalDisk` | **3675 ms** |
| `Win32_Processor` | **1295 ms** |
| `WmiMonitorID` | 333 ms |
| `Win32_ComputerSystem` | 230 ms |
| `Win32_NetworkAdapter` | 194 ms |
| 其余 | ≤ 100 ms |

**传输开销**：一个 PowerShell 进程冷启动 + 3 个查询 = **1701 ms**（pwsh）/ **2118 ms**（powershell 5.1）。**若每个字段起一个进程，成本是灾难性的**；若一个进程包办全部，约 = 1.7 秒固定开销 + 查询时间。

**值层面的坑（都有实测数字）**
- `Win32_VideoController.AdapterRAM`：Intel UHD 620 → **1 GB**，鲁大师显示 **128 MB**；MX250 → **2 GB**，鲁大师显示 **1968 MB**。**两个都对不上。** `照抄` 会给出一个既非真实显存、也非参考图数字的**第三个数**。
- `SMBIOSMemoryType = 26` —— 要显示「DDR4」必须写一张枚举映射表（26→DDR4）。`照抄` 字面执行会显示「26」。
- 系统信息：WMI 只给 `Microsoft Windows 11 专业版` + build `26200`，**没有「25H2」**。参考图上的「25H2」不在 WMI 里。
- 磁盘容量两个来源**互不相等**：`Win32_DiskDrive.Size` = `512105932800`，`Get-PhysicalDisk.Size` = `512110190592`（差 ~4 MB）。两者都约等于 512 GB / 476.9 GiB。
- 处理器：`Name` 里自带 `@ 1.60GHz`，而 `MaxClockSpeed` = `1800`。参考图的 `@ 1.60GHz` 来自 `Name`。
- NVMe 盘在 `Win32_DiskDrive.InterfaceType` 里报的是 **`SCSI`**；`BusType: NVMe` 只有 `Get-PhysicalDisk` 给。
- 网卡 `Speed`：Wi-Fi Direct 虚拟适配器报 `9223372036854775807`（int64 上限，垃圾值）。
- 电池：`Win32_Battery` 给了型号 `HB6081V1ECW-41`；**`root\wmi:BatteryCycleCount` → `CycleCount = 324`** ✅（你要的那个，拿得到）；`BatteryStaticData` → **FAIL: 常规故障**；`MSBatteryStaticData` → **无效类**。

**多显示器 / 分辨率（正面结论）**
| 途径 | 结果 |
|---|---|
| `Win32_VideoController` | **不行**——3 个适配器里只有 1 个报分辨率（1920x1080@60），其余全空。它按**适配器**报，不按显示器。 |
| `.NET Screen.AllScreens` | 2 块，均 1920x1080，**但没有刷新率** |
| **`EnumDisplaySettings`** | ✅ 逐显示器：`\\.\DISPLAY1` 1920x1080@60、`\\.\DISPLAY2` 1920x1080@60 |

→ **逐显示器的分辨率/刷新率必须调 `EnumDisplaySettings`（在 Rust 里是一次 `windows` crate 调用，不是啃二进制）。**

---

## 待办

1. **以管理员重跑探针**，定性 `Get-StorageReliabilityCounter` 是权限问题还是驱动不支持。
2. 上述三个推翻项，各需要一次决策。
