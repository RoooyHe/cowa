// 装机方案契约（issue #20）。见 docs/adr/0010。
//
// 这一层只钉两件事：`BuildPlan` 的形状，以及「Supabase REST 行 → `BuildPlan`」的
// 纯映射。**不触网、不依赖 Tauri**——取数在 issue #21，渲染在 issue #22。
//
// 部件分类**固定**（同 `固定图纸`）：任何方案上都是这九格、这个顺序，
// 不随数据增减或重排。`辅助配件` 是预留的一格，收定制线、副屏这类东西。

// 固定分类的**顺序**。列名即分类 id——Supabase 表里的部件列名与它一一对应。
export const PART_ORDER = [
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

export type PartCategory = (typeof PART_ORDER)[number];

// 分类 id → 屏上显示名。全表：少一格编译期就报错，漏翻译不可能。
export const PART_LABELS: Record<PartCategory, string> = {
  cpu: "CPU",
  mainboard: "主板",
  memory: "内存",
  gpu: "显卡",
  disk: "硬盘",
  psu: "电源",
  case: "机箱",
  cooling: "散热",
  accessory: "辅助配件",
};

// 一条方案映射后的部件格。`value` 可空——空分类由 UI 决定不显示（ADR-0010），
// 映射侧不替它做取舍，九格一个不少地交出去。
export type BuildPlanPart = {
  category: PartCategory;
  label: string;
  value: string | null;
};

export type BuildPlan = {
  name: string;
  intro: string;
  tier: string;
  // 字段名沿用 issue #20 与表列名（`ref_price`）：照抄，不做单位/格式转换（ADR-0010）。
  ref_price: number | null;
  // 固定九格、固定顺序。
  parts: BuildPlanPart[];
};

// Supabase `build_plans` 表的一行（`?select=*` 的原样形状）。`id` / `sort` /
// `published` 是 RLS 与排序用的列，映射不读它们——只读展示字段；列在类型里是为了
// 夹具与真实响应形状一致。部件列由 `PartCategory` 保证完整。
export type BuildPlanRow = {
  id: string;
  sort: number;
  published: boolean;
  name: string;
  intro: string;
  tier: string;
  ref_price: number | null;
} & Record<PartCategory, string | null>;

// 行 → 方案。纯函数：只读入参、只吐出值，不触网、不读环境、不碰 Tauri。
export function toBuildPlan(row: BuildPlanRow): BuildPlan {
  return {
    name: row.name,
    intro: row.intro,
    tier: row.tier,
    ref_price: row.ref_price,
    parts: PART_ORDER.map((category) => ({
      category,
      label: PART_LABELS[category],
      // 列缺失与 null 同等看待：没有这一件，就是没配。
      value: row[category] ?? null,
    })),
  };
}

export function toBuildPlans(rows: readonly BuildPlanRow[]): BuildPlan[] {
  return rows.map(toBuildPlan);
}
