import { useState, type ReactNode } from "react";

import { DEFAULT_SCREEN, SCREENS, type ScreenId } from "./screens";
import { TabBar } from "./TabBar";

type AppShellProps = {
  // 每个 `屏幕` 画什么，由组合根（`App`）注入——外壳不知道屏的内容。
  content: Record<ScreenId, ReactNode>;
};

// `应用外壳`：窗口里始终在场的部分——底部悬浮的 `标签栏` 加各屏的内容。
//
// 两个屏**都常驻**，只用 `hidden` 切换可见性：采集与取数都是「启动时一次、
// 之后冻结」（ADR-0001 / ADR-0009）。切走再切回若重挂，采集不会重跑
// （Rust 侧一个进程只 spawn 一次，也不重放事件），屏会永远停在骨架上。
export function AppShell({ content }: AppShellProps) {
  const [active, setActive] = useState<ScreenId>(DEFAULT_SCREEN);

  return (
    <div className="app-shell">
      {SCREENS.map((screen) => (
        <div
          key={screen.id}
          className="screen-content"
          data-screen={screen.id}
          hidden={screen.id !== active}
        >
          {content[screen.id]}
        </div>
      ))}
      <TabBar active={active} onSelect={setActive} />
    </div>
  );
}
