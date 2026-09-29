import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BuildPlansScreen } from "./BuildPlansScreen";

// 取数缝的守卫（issue #21）：网络只能出现在 `fetch.ts`。
//
// 这是 spec「那条缝」的可执行版本——第二屏（以及 `硬件概览`）在任何实现下都
// 不该自己调 `fetch`；取数在组合根一次做完，往下只传 `BuildPlan[]`。
const SOURCES = import.meta.glob(
  ["../**/*.ts", "../**/*.tsx", "!../**/*.test.ts", "!../**/*.test.tsx", "!../vite-env.d.ts"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

// 唯一被允许碰网络的模块（glob 的键相对本文件）。
const FETCH_OWNER = "./fetch.ts";

// 只盯**发起网络请求**的写法，不误伤 import 说明符里的模块名（`"./fetch"`）
// 或 `fetchImpl` 这类标识符。
const NETWORK_CALL = /\bfetch\s*\(|\b(?:XMLHttpRequest|sendBeacon)\b/;

describe("第二屏不直接取数（issue #21）", () => {
  it("只有 fetch.ts 发起网络请求，其余源码里没有", () => {
    expect(Object.keys(SOURCES).length, "glob 一个源文件都没扫到").toBeGreaterThanOrEqual(3);

    for (const [path, source] of Object.entries(SOURCES)) {
      if (path === FETCH_OWNER) continue;
      expect(source, `${path} 发起网络请求`).not.toMatch(NETWORK_CALL);
    }
  });

  it("屏只收 BuildPlan[]：空方案渲染为空，无骨架、无错误文案", () => {
    const { container } = render(<BuildPlansScreen plans={[]} />);

    expect(container.querySelector(".skeleton")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("第二屏与 `硬件概览` 互不依赖：并行、互不影响", () => {
    // 两条路径在组合根（`App.tsx`）汇合，彼此不 import——远端取数失败
    // 不可能改变本机采集的结果（ADR-0009）。
    for (const [path, source] of Object.entries(SOURCES)) {
      if (path.startsWith("../hardware/")) {
        expect(source, `${path} 依赖了装机方案`).not.toMatch(/from\s+["'][^"']*buildPlans/);
      }
      if (path.startsWith("./")) {
        expect(source, `${path} 依赖了硬件`).not.toMatch(/from\s+["'][^"']*hardware/);
      }
    }
  });
});
