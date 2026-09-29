# fixtures

`field-updates.jsonl` 是**契约两侧共用的唯一事实源**（issue #3）。

## 它是什么

一行一个 `FieldUpdate`，JSON 形状与 `src-tauri/src/collect.ps1` 流式吐出的**目标形状**一致。
12 行，恰好覆盖全部 12 个 `FieldId`，且每个字段只出现一次。

- 多值行：`显卡` / `显示器` / `声卡` 各两条值
- 一条 `并陈`：`磁盘`，`nominal` = `512GB`，`actual` = `476.9 GiB`

**夹具是契约，不是采集器当前输出。** `collect.ps1` 这一票（#2）只采 `processor`，
其余字段由后续的采集票补齐——补齐前，这份夹具就是它们要长成的样子。

## 它从哪来

值取自 `prototype/wmi-probe` 分支探针的**实测输出**（`.scratch/wmi-probe/RESULT.txt`、
`RESULT3.txt`、`VERDICT.md`），机器为 `HUAWEI HBL-WX9` / Windows 11 build 26200 /
非管理员。`prototype/layout` 的 `src/prototype/data.ts` 已把这些实测值转写过一遍
（含 `枚举翻译` 后的 `DDR4`、`笔记本` 等），夹具沿用它的文字。不是编的，是那台机器真报出来的值。

## 抹除

入库前已抹除**主板序列号、SMBIOS 标识号、显示器序列号与全部 MAC 地址**。
夹具里只保留可读的展示文本，不含 `PNPDeviceID`、`DeviceID` 这类可能带序列号的字段。
Rust 侧的 `fixture_has_no_serial_numbers_or_mac_addresses` 测试会挡住混入的 MAC。

## 谁在读它

- Rust：`src-tauri/src/lib.rs` 的 `contract_fixture` 测试——反序列化锁 `FieldId` /
  `SnapshotValue` 契约，并核对 `collect.ps1` 吐出的字段名都在契约内
- UI：`src/hardware/fixture.test.tsx`——渲染锁展示侧：9 行 3 卡、多值条数、
  并陈的 `nominal` 与 `actual` 都在屏上
