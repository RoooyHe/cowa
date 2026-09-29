import { screen } from "@testing-library/react";

// 固定图纸的 12 个标签。**故意硬编码**——它就是要锁住的事实（issue #1「固定图纸」）：
// 从 CARDS/ROWS 推导会让「图纸被改了」测不出来。
export const FIXED_LABELS = [
  "型号信息",
  "系统信息",
  "运行时间",
  "处理器",
  "主板",
  "内存",
  "显卡",
  "显示器",
  "磁盘",
  "声卡",
  "网卡",
  "电池",
];

export function cell(label: string): HTMLElement {
  const found = screen.getByText(label).closest<HTMLElement>("[data-field]");
  if (!found) throw new Error(`no blueprint cell for ${label}`);
  return found;
}
