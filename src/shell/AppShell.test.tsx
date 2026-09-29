import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import appCss from "../App.css?raw";
import { BuildPlansScreen } from "../buildPlans/BuildPlansScreen";
import { HardwareOverview } from "../hardware/HardwareOverview";
import { initialStreamState } from "../hardware/stream";
import { AppShell } from "./AppShell";

// 应用外壳（ADR-0007）：底部悬浮的 `标签栏` 在两个 `屏幕` 之间切换。
// 外壳是全应用唯一允许可点元素的地方——这里是它的行为守卫。
//
// 注入点仍在最高处：外壳只收「每个屏画什么」，测试里塞进真的
// `HardwareOverview`（喂固定状态）与空的第二屏，不碰 Tauri。

function renderShell() {
  return render(
    <AppShell
      content={{
        hardware: <HardwareOverview state={initialStreamState} />,
        "build-plans": <BuildPlansScreen plans={[]} />,
      }}
    />,
  );
}

function screenWrapper(container: HTMLElement, id: string): HTMLElement {
  const wrapper = container.querySelector<HTMLElement>(`[data-screen="${id}"]`);
  if (!wrapper) throw new Error(`no screen wrapper for ${id}`);
  return wrapper;
}

describe("应用外壳（ADR-0007）", () => {
  it("`标签栏` 恰好两个标签：硬件概览 / 装机方案", () => {
    renderShell();

    const tabs = screen.getAllByRole("button");

    expect(tabs).toHaveLength(2);
    expect(tabs.map((tab) => tab.textContent)).toEqual(["硬件概览", "装机方案"]);
  });

  it("启动默认落 `硬件概览`", () => {
    const { container } = renderShell();

    expect(screenWrapper(container, "hardware").hidden).toBe(false);
    expect(screenWrapper(container, "build-plans").hidden).toBe(true);
    expect(screen.getByText("处理器")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "硬件概览" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("切到第二个标签后第二屏出现、第一屏藏起", () => {
    const { container } = renderShell();

    fireEvent.click(screen.getByRole("button", { name: "装机方案" }));

    expect(screenWrapper(container, "build-plans").hidden).toBe(false);
    expect(screenWrapper(container, "hardware").hidden).toBe(true);
    // 第二屏此刻是空屏（内容留给后续票）。
    expect(screenWrapper(container, "build-plans").textContent).toBe("");
    // 屏是藏起来而不是卸载——重挂会让采集状态丢失（ADR-0001 / ADR-0009）。
    expect(screen.getByText("处理器")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "装机方案" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("悬浮 `标签栏` 的样式契约", () => {
  it("跟随 prefers-color-scheme：用主题令牌着色", () => {
    expect(appCss).toMatch(/\.tab-bar\s*\{[^}]*var\(--/s);
  });

  it("标签栏悬浮在底部，内容区底部留白不被遮住", () => {
    expect(appCss).toMatch(/\.tab-bar\s*\{[^}]*position:\s*fixed/s);
    expect(appCss).toMatch(/\.screen-content\s*\{[^}]*padding-bottom/s);
  });
});
