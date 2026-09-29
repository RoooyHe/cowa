// 采集器 → UI 的唯一契约。见 docs/adr/0004 与 issue #1「唯一的那条缝」。
//
// 契约只表达「到了什么」，不表达「还没到」——`骨架` 是 UI 侧由
// 「这个 FieldId 还没收到 FieldUpdate」推出来的状态，不在契约里。
// `未知` 则在契约里：它是采集器的主动放弃。

// 枚举翻译（issue #4）：采集侧只吐 WMI 的原始值，翻成人话是 UI 的活。
// 不翻的话值根本无法阅读（`SMBIOSMemoryType = 26`），而且翻不翻需要能在
// 没有 Windows 的环境里测——所以表在 UI 侧，采集器不碰。
export type EnumTable = "memoryType" | "systemType";

// 一个值可以由多段拼成：固定文本 + 需要翻译的枚举。
// 枚举是以结构到达 UI 的，不是拼好的字符串——「屏上不出现裸数值」由类型保证。
export type ValuePart =
  | { kind: "text"; text: string }
  | { kind: "enum"; table: EnumTable; code: number };

export type SnapshotValue =
  | { kind: "value"; text: string }
  // 组合值：一段型号信息里混着一个需要翻译的枚举（如内存的 `DDR4`）。
  | { kind: "parts"; parts: ValuePart[] }
  // 并陈：一个字段有两个来源、两个值不一致。刻意不在采集侧拼好字符串——
  // 「括号套括号」是排版问题，属于 UI 的职责。
  | { kind: "pair"; lead: string; nominal: string; actual: string }
  | { kind: "unknown" };

export type FieldId =
  | "model"
  | "system"
  | "uptime"
  | "processor"
  | "mainboard"
  | "memory"
  | "gpu"
  | "display"
  | "disk"
  | "sound"
  | "network"
  | "battery";

// 采集器 → UI 的流式消息。一行一个字段。
export type FieldUpdate = { field: FieldId; values: SnapshotValue[] };

export type BlueprintEntry = { field: FieldId; label: string };

// 固定图纸：三张卡 + 九行，任何机器上都是这 12 个，顺序固定。
export const CARDS: readonly BlueprintEntry[] = [
  { field: "model", label: "型号信息" },
  { field: "system", label: "系统信息" },
  { field: "uptime", label: "运行时间" },
];

export const ROWS: readonly BlueprintEntry[] = [
  { field: "processor", label: "处理器" },
  { field: "mainboard", label: "主板" },
  { field: "memory", label: "内存" },
  { field: "gpu", label: "显卡" },
  { field: "display", label: "显示器" },
  { field: "disk", label: "磁盘" },
  { field: "sound", label: "声卡" },
  { field: "network", label: "网卡" },
  { field: "battery", label: "电池" },
];
