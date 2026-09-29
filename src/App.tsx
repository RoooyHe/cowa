import "./App.css";
import { BuildPlansScreen } from "./buildPlans/BuildPlansScreen";
import { HardwareOverviewScreen } from "./hardware/HardwareOverviewScreen";
import { AppShell } from "./shell/AppShell";

// 组合根：把两个 `屏幕` 的内容交给 `应用外壳`。
// 启动落哪一屏由外壳决定（`DEFAULT_SCREEN`）。
function App() {
  return (
    <AppShell
      content={{
        hardware: <HardwareOverviewScreen />,
        "build-plans": <BuildPlansScreen />,
      }}
    />
  );
}

export default App;
