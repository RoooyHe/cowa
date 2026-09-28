// PROTOTYPE — 一次性 UI 原型的数据源，不接任何真实采集。
//
// 全部数值来自 `prototype/wmi-probe` 分支上探针的实测输出
// （HUAWEI HBL-WX9 / Win11 build 26200 / 非管理员）。
// 这样排版时面对的是真实长度、真实括号、真实多值行——而不是 Lorem Ipsum。

export type Value =
  | { kind: "value"; text: string }
  // 并陈：一个字段有两个来源、两个值不一致。刻意**不**在数据里拼好字符串——
  // 「括号套括号」是个排版问题，得让每个变体各自解一次。
  | { kind: "pair"; lead: string; nominal: string; actual: string }
  | { kind: "loading" }   // 骨架：还在查
  | { kind: "unknown" };  // 未知：没拿到

export const v = (text: string): Value => ({ kind: "value", text });
export const loading: Value = { kind: "loading" };
export const unknown: Value = { kind: "unknown" };

export type Row = { label: string; values: Value[] };
export type Card = { label: string; primary: string; secondary?: string };

export const cards: Card[] = [
  { label: "型号信息", primary: "HUAWEI HBL-WX9", secondary: "笔记本 · DREAM" },
  { label: "系统信息", primary: "Windows 11 专业版", secondary: "64 位 · 内部版本 26200" },
  { label: "运行时间", primary: "7天20小时41分钟33秒" },
];

export const rows: Row[] = [
  { label: "处理器", values: [v("Intel(R) Core(TM) i5-8265U CPU @ 1.60GHz（4 核 / 8 线程）")] },
  { label: "主板", values: [v("HUAWEI HBL-WX9-PCB")] },
  { label: "内存", values: [v("Samsung 16GB DDR4 2400MHz（8GB + 8GB）")] },
  {
    label: "显卡",
    values: [
      v("Intel(R) UHD Graphics 620（1024MB / Intel）"),
      v("NVIDIA GeForce MX250（2048MB / NVIDIA）"),
    ],
  },
  {
    label: "显示器",
    values: [
      v("Huawei PnP Monitor [CMN1604]（16.2 英寸）1920×1080 @ 60Hz"),
      v("Generic Monitor (Redmi 215 NF) [XMIA011]（21.5 英寸）1920×1080 @ 60Hz"),
    ],
  },
  {
    label: "磁盘",
    values: [
      { kind: "pair", lead: "WDC PC SN730 SDBPNTY-512G-1027", nominal: "512GB", actual: "476.9 GiB" },
    ],
  },
  { label: "声卡", values: [v("Realtek High Definition Audio"), v("英特尔(R) 显示器音频")] },
  { label: "网卡", values: [v("Intel(R) Wireless-AC 9560 160MHz")] },
  { label: "电池", values: [v("324 次循环")] },
];

export type Phase = "skeleton" | "partial" | "loaded";

export const PHASES: { key: Phase; name: string }[] = [
  { key: "skeleton", name: "骨架（还在查）" },
  { key: "partial", name: "填充中（慢查询 + 一个未知）" },
  { key: "loaded", name: "已完成" },
];

// 填充中：显示器（333ms）和磁盘的查询还没回来 → 骨架；
// 电池那格故意给成「未知」，好让四个变体各自的「未知」长相也能被看到。
export function withPhase(input: Row[], phase: Phase): Row[] {
  if (phase === "loaded") return input;
  if (phase === "skeleton") {
    return input.map((r) => ({ ...r, values: r.values.map(() => loading) }));
  }
  const pending = new Set(["显示器", "磁盘"]);
  return input.map((r) => {
    if (pending.has(r.label)) return { ...r, values: r.values.map(() => loading) };
    if (r.label === "电池") return { ...r, values: [unknown] };
    return r;
  });
}
