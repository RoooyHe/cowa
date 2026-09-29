import type { ReactNode } from "react";

import { BuildPlansIcon, HardwareIcon, type ScreenIconProps } from "./icons";

// `屏幕` 的固定清单：`标签栏` 按这个顺序画标签，`应用外壳` 按 id 选内容。
// 两个标签，不为假想的第三个留抽象（issue #19 / #23）。
//
// 每一格的图标也在这里——屏幕的身份（id / 文字 / 图标）只写一份，标签栏照着画。
// 图标是 SVG，不用 Emoji（issue #23）。
export type ScreenId = "hardware" | "build-plans";

export type Screen = {
  id: ScreenId;
  label: string;
  Icon: (props: ScreenIconProps) => ReactNode;
};

export const SCREENS = [
  { id: "hardware", label: "硬件概览", Icon: HardwareIcon },
  { id: "build-plans", label: "装机方案", Icon: BuildPlansIcon },
] as const satisfies readonly Screen[];

// 启动永远落 `硬件概览`，不记忆上次停留的屏（无持久化）。
export const DEFAULT_SCREEN: ScreenId = "hardware";
