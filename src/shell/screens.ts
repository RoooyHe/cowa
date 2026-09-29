// `屏幕` 的固定清单：`标签栏` 按这个顺序画标签，`应用外壳` 按 id 选内容。
// 两个标签，不为假想的第三个留抽象（issue #19 / #23）。
export type ScreenId = "hardware" | "build-plans";

export const SCREENS = [
  { id: "hardware", label: "硬件概览" },
  { id: "build-plans", label: "装机方案" },
] as const satisfies readonly { id: ScreenId; label: string }[];

// 启动永远落 `硬件概览`，不记忆上次停留的屏（无持久化）。
export const DEFAULT_SCREEN: ScreenId = "hardware";
