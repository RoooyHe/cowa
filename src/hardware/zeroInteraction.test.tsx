import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import indexHtml from "../../index.html?raw";
import { HardwareOverview } from "./HardwareOverview";
import { applyFieldUpdate, closeStream, initialStreamState } from "./stream";

// ADR-0005：`硬件概览` 是零交互的——屏上没有任何可点元素，也没有快捷键。
// 这条守卫让那条 ADR 在 CI 里**会红**，而不只是文档里的一句话。
//
// 只从外面看得见的地方守：
//   1. DOM 里没有可交互元素（骨架态与填满态都查）；
//   2. 源码里没有可交互标签、没有事件绑定、没有全局键盘监听——
//      React 的 `onClick` 不落到 DOM 上，快捷键也只在源码里看得见。

// 能点的元素只有这五种。定义一次，DOM 选择器与源码扫描都从它派生——
// 少一个元素要改的地方就少一处。
const INTERACTIVE_TAGS = ["button", "a", "input", "select", "textarea"];

// 不是这五种、但同样能点的漏网之鱼。（React 的 `onClick` 不会变成 HTML
// 属性，所以 `[onclick]` 在这里几乎不会命中——真正兜住它的是下面的源码扫描。）
const INTERACTIVE_SELECTOR = [
  ...INTERACTIVE_TAGS,
  "[onclick]",
  "[contenteditable]",
  "[role='button']",
].join(",");

// 这一屏的全部源码（含 `.ts`——全局键盘监听可能藏在那里）。排除测试自己
// 与类型声明，否则下面那串禁用名单会把自己测红。
const SOURCES = import.meta.glob(
  ["../**/*.ts", "../**/*.tsx", "!../**/*.test.ts", "!../**/*.test.tsx", "!../vite-env.d.ts"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const INTERACTIVE_JSX = INTERACTIVE_TAGS.map((tag) => `<${tag}`);

// 任何「点了/敲了会发生什么」的绑定都在此列——不只是 onClick。
const EVENT_PROPS = [
  "onClick",
  "onDoubleClick",
  "onMouseDown",
  "onMouseUp",
  "onPointerDown",
  "onKeyDown",
  "onKeyUp",
  "onKeyPress",
  "onChange",
  "onInput",
  "onSubmit",
  "onContextMenu",
];

// 全局监听是快捷键的另一条路（`addEventListener("keydown", …)`）。事件名
// 大小写不一，统一小写后查。
const EVENT_LISTENERS = ["addeventlistener", "keydown", "keyup", "keypress"];

// 填满态：一个字段有真值，其余是 `未知`。与骨架态一起覆盖整屏的三条渲染分支。
const FILLED = closeStream(
  applyFieldUpdate(initialStreamState, {
    field: "processor",
    values: [{ kind: "value", text: "Intel(R) Core(TM) i5-8265U" }],
  }),
);

describe("零交互守卫（ADR-0005）", () => {
  it("骨架态屏上没有任何可交互元素", () => {
    const { container } = render(<HardwareOverview state={initialStreamState} />);

    expect(container.querySelectorAll(INTERACTIVE_SELECTOR)).toHaveLength(0);
  });

  it("填满态屏上没有任何可交互元素", () => {
    const { container } = render(<HardwareOverview state={FILLED} />);

    expect(container.querySelectorAll(INTERACTIVE_SELECTOR)).toHaveLength(0);
  });

  it("源码里没有可交互标签", () => {
    // 先保证 glob 真的扫到了东西——否则下面两条会空转通过。
    expect(Object.keys(SOURCES).length, "glob 一个源文件都没扫到").toBeGreaterThanOrEqual(3);

    for (const [path, source] of Object.entries(SOURCES)) {
      for (const tag of INTERACTIVE_JSX) {
        expect(source, `${path} 用了 ${tag}`).not.toContain(tag);
      }
    }
  });

  it("源码里没有绑交互事件，也没有全局键盘监听", () => {
    for (const [path, source] of Object.entries(SOURCES)) {
      for (const prop of EVENT_PROPS) {
        expect(source, `${path} 绑了 ${prop}`).not.toContain(prop);
      }
      const lower = source.toLowerCase();
      for (const listener of EVENT_LISTENERS) {
        expect(lower, `${path} 挂了 ${listener}`).not.toContain(listener);
      }
    }
  });

  it("入口 HTML 里没有可交互元素", () => {
    const html = indexHtml.toLowerCase();

    for (const tag of INTERACTIVE_JSX) {
      expect(html, `index.html 用了 ${tag}`).not.toContain(tag);
    }
  });
});
