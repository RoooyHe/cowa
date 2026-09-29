// 采集器 → UI 的唯一契约。见 docs/adr/0004 与 issue #1「唯一的那条缝」。
//
// 契约只表达「到了什么」，不表达「还没到」——`骨架` 是 UI 侧由
// 「这个 FieldId 还没收到 FieldUpdate」推出来的状态，不在契约里。
// `未知` 则在契约里：它是采集器的主动放弃。

export type SnapshotValue =
  | { kind: "value"; text: string }
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
