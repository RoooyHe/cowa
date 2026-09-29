import { HardwareOverview } from "./HardwareOverview";
import { useCollection } from "./useCollection";

// `硬件概览` 屏的内容。唯一碰采集（Tauri）的地方在这一层——
// `HardwareOverview` 只收 `StreamState`，所以组件测试里连 Tauri 都不存在（issue #1）。
export function HardwareOverviewScreen() {
  const state = useCollection();

  return <HardwareOverview state={state} />;
}
