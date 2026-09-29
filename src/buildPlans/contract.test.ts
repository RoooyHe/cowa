import { describe, expect, it } from "vitest";

import contractSource from "./contract?raw";
import { loadBuildPlanRows, loadBuildPlans } from "../test/buildPlans";
import { PART_LABELS, PART_ORDER, toBuildPlan, type BuildPlanRow } from "./contract";

// 固定分类与顺序**故意硬编码**——从 PART_ORDER / PART_LABELS 推导测不出
// 「顺序被改了」「翻译被换了」。它就是要锁住的事实（参照 src/test/blueprint.ts）。
const EXPECTED_CATEGORIES = [
  "cpu",
  "mainboard",
  "memory",
  "gpu",
  "disk",
  "psu",
  "case",
  "cooling",
  "accessory",
] as const;

const EXPECTED_LABELS = [
  "CPU",
  "主板",
  "内存",
  "显卡",
  "硬盘",
  "电源",
  "机箱",
  "散热",
  "辅助配件",
] as const;

// 夹具里不是部件列的字段。其余列都该出现在映射结果的部件格里。
const NON_PART_KEYS = new Set(["id", "sort", "published", "name", "intro", "tier", "ref_price"]);

function row(overrides: Partial<BuildPlanRow> = {}): BuildPlanRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    sort: 1,
    published: true,
    name: "示例方案",
    intro: "一句介绍。",
    tier: "示例档",
    ref_price: 1,
    cpu: null,
    mainboard: null,
    memory: null,
    gpu: null,
    disk: null,
    psu: null,
    case: null,
    cooling: null,
    accessory: null,
    ...overrides,
  };
}

describe("BuildPlan 契约（issue #20）", () => {
  it("固定分类恰好九格，顺序固定", () => {
    expect(PART_ORDER).toEqual([...EXPECTED_CATEGORIES]);
    expect(PART_ORDER).toHaveLength(9);
  });

  it("每个分类都有中文显示名，且与分类一一对应", () => {
    expect(EXPECTED_CATEGORIES.map((category) => PART_LABELS[category])).toEqual([
      ...EXPECTED_LABELS,
    ]);
  });

  it("真实 Supabase REST 响应夹具能映射成 BuildPlan[]", () => {
    const rows = loadBuildPlanRows();
    const plans = loadBuildPlans();

    expect(rows.length).toBeGreaterThan(0);
    expect(plans).toHaveLength(rows.length);

    // 逐条对应、不打乱，字段原样传递。夹具内容是示例数据（见 fixtures/README.md），
    // 所以这里与入参比，不写死具体方案名——改样例不该测红。
    expect(plans.map((plan) => plan.name)).toEqual(rows.map((row) => row.name));
    expect(plans.map((plan) => plan.tier)).toEqual(rows.map((row) => row.tier));
    expect(plans.map((plan) => plan.intro)).toEqual(rows.map((row) => row.intro));
    expect(plans.every((plan) => plan.parts.length === 9)).toBe(true);
  });

  it("部件列名 → 固定分类的映射完整：不丢列、不错序", () => {
    const rows = loadBuildPlanRows();
    const plans = loadBuildPlans();
    expect(rows.length).toBeGreaterThan(0);

    // 丢列：`select=*` 的每行都带全部列——先锁所有行的部件列集一致，
    // 再把列集与映射结果的分类集对上。
    const union = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row)) if (!NON_PART_KEYS.has(key)) union.add(key);
    }
    for (const row of rows) {
      const keys = Object.keys(row).filter((key) => !NON_PART_KEYS.has(key));
      expect(new Set(keys)).toEqual(union);
    }
    const rowColumns = [...union].sort();
    const mappedCategories = plans[0].parts.map((part) => part.category).sort();
    expect(mappedCategories).toEqual(rowColumns);

    // 不错序：映射结果逐格是固定分类、固定顺序、固定标签。
    expect(plans[0].parts.map((part) => part.category)).toEqual([...EXPECTED_CATEGORIES]);
    expect(plans[0].parts.map((part) => part.label)).toEqual([...EXPECTED_LABELS]);
  });

  it("每个部件格读的是自己那一列——不错位", () => {
    const wired = row({
      cpu: "v-cpu",
      mainboard: "v-mainboard",
      memory: "v-memory",
      gpu: "v-gpu",
      disk: "v-disk",
      psu: "v-psu",
      case: "v-case",
      cooling: "v-cooling",
      accessory: "v-accessory",
    });

    const parts = toBuildPlan(wired).parts;

    expect(parts.map((part) => part.value)).toEqual([
      "v-cpu",
      "v-mainboard",
      "v-memory",
      "v-gpu",
      "v-disk",
      "v-psu",
      "v-case",
      "v-cooling",
      "v-accessory",
    ]);
  });

  it("ref_price 的 null 与数字两种都覆盖，且原样照抄", () => {
    const plans = loadBuildPlans();
    const prices = plans.map((plan) => plan.ref_price);

    expect(prices).toContain(null);
    expect(prices.some((price) => typeof price === "number")).toBe(true);

    // 直接映射也照抄，不校正、不换算。
    expect(toBuildPlan(row({ ref_price: 42 })).ref_price).toBe(42);
    expect(toBuildPlan(row({ ref_price: null })).ref_price).toBeNull();
  });

  it("空部件列不丢格：仍是九格，值为 null", () => {
    const parts = toBuildPlan(row()).parts;

    expect(parts).toHaveLength(9);
    expect(parts.map((part) => part.value)).toEqual(Array(9).fill(null));
    expect(parts[8].label).toBe("辅助配件");
  });

  it("映射是纯函数：不触网、不依赖 Tauri", () => {
    // 契约层只允许纯映射。取数（issue #21）与渲染（issue #22）在别处，
    // 一旦有人把 fetch / Tauri 塞进来，这条守卫会红。用词边界匹配，
    // `window.fetch` / `fetch (` 也逃不掉。
    expect(contractSource).not.toMatch(/\bfetch\b/);
    expect(contractSource).not.toContain("@tauri-apps");
  });
});
