import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import appCss from "../App.css?raw";
import { loadBuildPlans } from "../test/buildPlans";
import { BuildPlans } from "./BuildPlans";
import type { BuildPlan } from "./contract";

// `装机方案` 的内容（ADR-0010）：一列文本卡。注入点在最高处——组件只收
// `BuildPlan[]`，测试里没有 Supabase、没有网络、没有 Tauri（见 spec 的「那条缝」）。
//
// 部件分类**故意硬编码**：从 `PART_ORDER` 推导测不出「顺序被改了」。它就是要
// 锁住的事实（参照 src/test/blueprint.ts）。

const EXPECTED_PART_ORDER = [
  "cpu",
  "mainboard",
  "memory",
  "gpu",
  "disk",
  "psu",
  "case",
  "cooling",
  "accessory",
];

function cards(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(".build-plan"));
}

function cardFor(name: string): HTMLElement {
  const card = screen.getByRole("heading", { name }).closest<HTMLElement>(".build-plan");
  if (!card) throw new Error(`no build plan card for ${name}`);
  return card;
}

function categories(card: HTMLElement): Array<string | null> {
  return Array.from(card.querySelectorAll("[data-category]")).map((element) =>
    element.getAttribute("data-category"),
  );
}

describe("BuildPlans（issue #22）", () => {
  it("N 条方案按给定顺序渲染 N 张卡", () => {
    const plans = loadBuildPlans();
    const { container } = render(<BuildPlans plans={plans} />);

    expect(cards(container)).toHaveLength(plans.length);
    expect(cards(container).map((card) => card.querySelector(".plan-name")?.textContent)).toEqual(
      plans.map((plan) => plan.name),
    );
  });

  it("每张卡都有名称、档次、一句介绍", () => {
    const plans = loadBuildPlans();
    render(<BuildPlans plans={plans} />);

    for (const plan of plans) {
      const card = cardFor(plan.name);
      expect(within(card).getByText(plan.tier)).toBeInTheDocument();
      expect(within(card).getByText(plan.intro)).toBeInTheDocument();
    }
  });

  it("部件清单按固定顺序", () => {
    const { container } = render(<BuildPlans plans={loadBuildPlans()} />);

    // 夹具里的高端创作机九格全填——顺序里没有空缺的干扰。
    expect(categories(cardFor("高端创作机"))).toEqual(EXPECTED_PART_ORDER);
    expect(cards(container)).toHaveLength(3);
  });

  it("空分类不出现，含没填的 `辅助配件`", () => {
    const plans = loadBuildPlans();
    render(<BuildPlans plans={plans} />);

    // 入门办公机：显卡与辅助配件都是 null。
    const entry = cardFor("入门办公机");
    expect(within(entry).queryByText("显卡")).not.toBeInTheDocument();
    expect(within(entry).queryByText("辅助配件")).not.toBeInTheDocument();
    // 填了的分类照常出现，且顺序从 CPU 起。
    expect(categories(entry)).toEqual(["cpu", "mainboard", "memory", "disk", "psu", "case", "cooling"]);

    // 主流游戏机：仅辅助配件为空。
    expect(categories(cardFor("主流游戏机"))).toEqual([
      "cpu",
      "mainboard",
      "memory",
      "gpu",
      "disk",
      "psu",
      "case",
      "cooling",
    ]);
  });

  it("空白字符串写的分类与 null 同等——不出现", () => {
    const [entry] = loadBuildPlans();
    const blankAccessory: BuildPlan = {
      ...entry,
      parts: entry.parts.map((part) =>
        part.category === "accessory" ? { ...part, value: "   " } : part,
      ),
    };

    render(<BuildPlans plans={[blankAccessory]} />);

    expect(within(cardFor(entry.name)).queryByText("辅助配件")).not.toBeInTheDocument();
  });

  it("`参考价` 为 null 时整个价格块不出现；有数字时出现", () => {
    const plans = loadBuildPlans();
    render(<BuildPlans plans={plans} />);

    // 入门办公机：3299。
    const entry = cardFor("入门办公机");
    expect(entry.querySelector(".plan-price")).not.toBeNull();
    expect(within(entry).getByText("参考价")).toBeInTheDocument();
    expect(within(entry).getByText("3299")).toBeInTheDocument();

    // 高端创作机：null——连「参考价」三个字都不出现。
    const high = cardFor("高端创作机");
    expect(high.querySelector(".plan-price")).toBeNull();
    expect(within(high).queryByText("参考价")).not.toBeInTheDocument();
  });

  it("卡片内没有任何可点元素", () => {
    const { container } = render(<BuildPlans plans={loadBuildPlans()} />);
    const interactive = [
      "button",
      "a",
      "input",
      "select",
      "textarea",
      "[onclick]",
      "[contenteditable]",
      "[role='button']",
    ].join(",");

    expect(cards(container).length).toBeGreaterThan(0);
    for (const card of cards(container)) {
      expect(card.querySelectorAll(interactive)).toHaveLength(0);
    }
  });

  it("空数组渲染成空：无卡、无骨架、无错误文案", () => {
    const { container } = render(<BuildPlans plans={[]} />);

    const list = container.querySelector(".build-plans");
    expect(list).not.toBeNull();
    expect(cards(container)).toHaveLength(0);
    expect(screen.queryAllByTestId("skeleton")).toHaveLength(0);
    expect(list?.textContent).toBe("");
  });
});

describe("`装机方案` 的样式契约", () => {
  it("单屏一列纵向排布，用主题令牌着色", () => {
    expect(appCss).toMatch(/\.build-plans\s*\{[^}]*flex-direction:\s*column/s);
    expect(appCss).toMatch(/\.build-plan\s*\{[^}]*var\(--/s);
  });
});
