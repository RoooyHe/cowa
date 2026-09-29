import "./App.css";
import { BuildPlansScreen } from "./buildPlans/BuildPlansScreen";
import { useBuildPlans } from "./buildPlans/useBuildPlans";
import { HardwareOverviewScreen } from "./hardware/HardwareOverviewScreen";
import { AppShell } from "./shell/AppShell";

// 组合根：把两个 `屏幕` 的内容交给 `应用外壳`。
// 启动落哪一屏由外壳决定（`DEFAULT_SCREEN`）。
//
// 远端取数（issue #21）在这里发生——注入点在最高处。它与 `HardwareOverviewScreen`
// 里的本地采集**并行、互不影响**：第二屏失败 / 超时 / 空表都是空数组，绝不改变
// `硬件概览`（ADR-0009）。
function App() {
  const plans = useBuildPlans();

  return (
    <AppShell
      content={{
        hardware: <HardwareOverviewScreen />,
        "build-plans": <BuildPlansScreen plans={plans} />,
      }}
    />
  );
}

export default App;
