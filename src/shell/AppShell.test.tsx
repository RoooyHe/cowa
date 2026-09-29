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

// `App.css` 里三个与主题无关的几何令牌（issue #23）。
function pxToken(css: string, token: string): number {
  const match = css.match(new RegExp(`${token}\\s*:\\s*(\\d+)px`));
  if (!match) throw new Error(`App.css 里没有 ${token} 的 px 值`);
  return Number(match[1]);
}

describe("`标签栏` 图标（issue #23）", () => {
  it("两个标签各带一个内联 SVG 图标，不是 Emoji", () => {
    renderShell();
    const tabs = screen.getAllByRole("button");
    expect(tabs).toHaveLength(2);

    for (const tab of tabs) {
      const svg = tab.querySelector("svg.tab-icon");
      expect(svg, "标签缺少 .tab-icon 的 SVG").not.toBeNull();
      // 有真实图形，不是空壳。
      expect(svg?.querySelectorAll("path, rect, circle, line, polyline")).not.toHaveLength(0);
      // 装饰性：不参与无障碍名字，按钮名字仍由文字给。
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
    }

    // 禁 Emoji：标签的可见文字里没有任何 Emoji 码点。
    const visible = tabs.map((tab) => tab.textContent ?? "").join("");
    expect(visible).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("图标用 currentColor（含子节点），颜色只来自标签文字色——深浅纯跟随系统", () => {
    renderShell();
    const icons = Array.from(document.querySelectorAll(".tab-icon"));

    expect(icons).toHaveLength(2);
    for (const icon of icons) {
      // 根 svg 与所有子节点的 stroke / fill 都只能是 currentColor 或 none——
      // 任何一处写死颜色，这条就红。
      for (const node of [icon, ...icon.querySelectorAll("[stroke], [fill]")]) {
        for (const attr of ["stroke", "fill"] as const) {
          const value = node.getAttribute(attr);
          if (value === null) continue;
          expect(
            ["currentColor", "none"],
            `${node.tagName} 的 ${attr}=${value} 写死了颜色`,
          ).toContain(value);
        }
      }
    }
    // 文字色是主题令牌；深浅两套由 App.css 的 prefers-color-scheme 换。
    expect(appCss).toMatch(/\.tab\s*\{[^}]*color:\s*var\(--/s);
  });
});

describe("悬浮 `标签栏` 的留白（issue #23）", () => {
  it("内容区留白不小于「栏距底 + 栏高」——两个屏都不被遮住", () => {
    const inset = pxToken(appCss, "--tab-bar-inset");
    const height = pxToken(appCss, "--tab-bar-height");
    const clearance = pxToken(appCss, "--tab-bar-clearance");

    expect(clearance).toBeGreaterThanOrEqual(inset + height);
    // 还留有余量：`min-height` 允许栏长高，余量吸收这部分。
    expect(clearance - inset - height).toBeGreaterThan(0);
    // 两个屏共用同一个留白容器与同一个令牌，不存在哪个屏漏了。
    expect(appCss).toMatch(/\n\.screen-content\s*\{[^}]*padding-bottom:\s*var\(--tab-bar-clearance\)/s);
    expect(appCss).toMatch(/\.tab-bar\s*\{[^}]*bottom:\s*var\(--tab-bar-inset\)/s);
    expect(appCss).toMatch(/\.tab-bar\s*\{[^}]*min-height:\s*var\(--tab-bar-height\)/s);
  });
});
