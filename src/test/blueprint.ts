import { screen } from "@testing-library/react";

import type { FieldId } from "../hardware/contract";

// 固定图纸（issue #1）：三张卡 + 九行，顺序固定。**故意硬编码**——它就是要
// 锁住的事实：从 CARDS/ROWS 推导会让「图纸被改了」测不出来。
//
// `B 规格单`（issue #7）把三张卡拍成顶栏一条淡色带，卡不再有可见标签，
// 只有 primary 串成一行——所以只有九行的标签还上屏，`cell(label)` 只服务行；
// 顶栏用 `fieldCell(field)` / `cardBand()` 按字段找。

export const CARD_FIELDS = ["model", "system", "uptime"] as const satisfies readonly FieldId[];

export const CARD_LABELS = ["型号信息", "系统信息", "运行时间"] as const;

// 行是 `{field, label}` 配对的：两张平行数组会各自漂移，这里只写一份。
export const ROW_SPEC = [
  { field: "processor", label: "处理器" },
  { field: "mainboard", label: "主板" },
  { field: "memory", label: "内存" },
  { field: "gpu", label: "显卡" },
  { field: "display", label: "显示器" },
  { field: "disk", label: "磁盘" },
  { field: "sound", label: "声卡" },
  { field: "network", label: "网卡" },
  { field: "battery", label: "电池" },
] as const satisfies readonly { field: FieldId; label: string }[];

export const ROW_FIELDS = ROW_SPEC.map((row) => row.field);
export const ROW_LABELS = ROW_SPEC.map((row) => row.label);

// 12 个字段的顺序：三张卡在前，九行在后。
export const FIXED_FIELDS: readonly FieldId[] = [...CARD_FIELDS, ...ROW_FIELDS];

export function cell(label: string): HTMLElement {
  const found = screen.getByText(label).closest<HTMLElement>("[data-field]");
  if (!found) throw new Error(`no blueprint cell for ${label}`);
  return found;
}

// 卡在顶栏里没有可见标签，只能按字段找。
export function fieldCell(field: FieldId): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-field="${field}"]`);
  if (!found) throw new Error(`no blueprint cell for field ${field}`);
  return found;
}

export function cardBand(): HTMLElement {
  const found = document.querySelector<HTMLElement>('[data-region="cards"]');
  if (!found) throw new Error("no card band");
  return found;
}
