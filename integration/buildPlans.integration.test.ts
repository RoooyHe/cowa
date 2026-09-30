// 装机方案的真项目集成测试（issue #23）。**不进 CI**——默认 `vitest run` 只收
// `src/**`，这里在 `integration/**`；那份默认配置里根本没有它。
//
// 跑法见 integration/README.md：
//
//   bun run test:integration
//
// 需要 `.env.local`（或环境变量）里的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，
// 对着一个**真 Supabase 项目**取一次。没配好时这一组跳过（采集器那组照跑），
// 并在控制台留一行提示；「连不上即空」那一组不需要凭据，永远跑。
//
// 断言的是**项目 / 机器无关**的行为：anon 只看得见 published 行、按 sort 升序、
// 生产取数路径与真响应对得上、错 key / 连不上都返回空且不抛。
// **不**断言任何具体方案名 / 条数 / 价格——那是项目内容，不是行为。

import { loadEnv } from "vite";
import { describe, expect, it } from "vitest";

import { fetchBuildPlans } from "../src/buildPlans/fetch";

// Vite 的加载顺序（.env → .env.local → .env.test → …）与开发时一致，所以
// `.env.example` 复制出来的 `.env.local` 这里读得到；process.env 再兜一层。
function credentials(): { url: string; anonKey: string } {
  const env = loadEnv("test", process.cwd(), "VITE_");
  return {
    url: env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
    anonKey: env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
  };
}

const { url, anonKey } = credentials();
const configured = url !== "" && anonKey !== "";

// 专用 run（`bun run test:integration:supabase`）把「缺凭据」当错，不静默跳过。
const requireCredentials = process.env.COWA_REQUIRE_SUPABASE_INTEGRATION === "1";
if (requireCredentials && !configured) {
  throw new Error(
    "要求真 Supabase 凭据，但没读到 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY。" +
      "把 .env.example 复制成 .env.local 并填值后重跑。",
  );
}

if (!configured) {
  console.warn(
    "[装机方案集成] 未配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY——跳过真项目一组。" +
      "把 .env.example 复制成 .env.local 并填值后重跑。",
  );
}

// 真响应里行是我们的字段，外加 Supabase 的列。这里只读排序 / 发布用的几列，
// 不读方案内容——断言不该依赖项目里有哪些方案。
type RawRow = { id: string; sort: number; published: boolean; name: string };

// 绕开生产取数、直接打 REST：这样才能观察 RLS 在**服务端**的行为。
// 生产路径（`fetchBuildPlans`）不拼 `published` 过滤，全靠 RLS——这里就是验它。
//
// 只发 `apikey`：新版 publishable key 不是 JWT，放 `Authorization: Bearer` 会被
// PostgREST 当坏 JWT 拒掉（PGRST301）——与生产取数（fetch.ts）保持同一种头。
async function rawRows(query: string): Promise<RawRow[]> {
  const response = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/build_plans?${query}`, {
    headers: {
      apikey: anonKey,
      Accept: "application/json",
    },
  });
  // 这一组只在配好凭据时跑：状态不对就报出来（含状态码），不静静地当空表。
  if (!response.ok) throw new Error(`GET ${query} → HTTP ${response.status}`);
  return (await response.json()) as RawRow[];
}

describe.skipIf(!configured)("装机方案真项目集成（issue #23）", () => {
  it("anon 只看得见 published 行：结果里没有草稿", async () => {
    const rows = await rawRows("select=*&order=sort.asc");

    // 非空前提：空项目上「只回 published」会空洞通过。
    expect(rows.length, "该项目没有任何 published 方案——发布断言会空洞通过").toBeGreaterThan(0);
    expect(rows.every((row) => row.published === true)).toBe(true);
  });

  it("草稿列对 anon 不可见：published=eq.false 一行都不回", async () => {
    // 没有草稿行时这条会平凡通过，但一旦有草稿且 RLS 没挡住，它就红。
    expect(await rawRows("select=id&published=eq.false")).toHaveLength(0);
  });

  it("按 sort 升序返回", async () => {
    const rows = await rawRows("select=sort&order=sort.asc");
    expect(rows.length).toBeGreaterThan(0);

    const sorts = rows.map((row) => row.sort);
    // 升序，允许并列（sort 不保证唯一）。
    for (let index = 1; index < sorts.length; index += 1) {
      expect(
        sorts[index],
        `第 ${index} 行的 sort=${sorts[index]} 小于前一行 ${sorts[index - 1]}`,
      ).toBeGreaterThanOrEqual(sorts[index - 1]);
    }
  });

  it("生产取数路径与真响应一致：映射的是同一批行，且每案九格", async () => {
    const rows = await rawRows("select=*&order=sort.asc");
    // 真项目走公网，比单测那 5 秒上限放宽一点。
    const plans = await fetchBuildPlans({ url, anonKey }, { timeoutMs: 15_000 });

    // 同一条方案取两次：映射的是同一批行（名字的多重集相等，没丢没错位）。
    // 用多重集而非逐位比较——`sort` 允许并列，两次请求在并列行上的先后无保证；
    // 排序本身由上面那条 `select=sort&order=sort.asc` 独立验。
    expect([...plans.map((plan) => plan.name)].sort()).toEqual(
      [...rows.map((row) => row.name)].sort(),
    );
    expect(plans.every((plan) => plan.parts.length === 9)).toBe(true);
  });

  it("错 anon key → 返回空，不抛", async () => {
    await expect(
      fetchBuildPlans({ url, anonKey: "definitely-not-a-valid-key" }),
    ).resolves.toEqual([]);
  });
});

describe("装机方案取数失败即空（issue #23）", () => {
  it("连不上（断网 / 地址不可达）→ 返回空，不抛到 UI", async () => {
    // 127.0.0.1:9（discard）通常立刻拒绝；即使被挂住，`timeoutMs` 也在上限内收手。
    await expect(
      fetchBuildPlans({ url: "http://127.0.0.1:9", anonKey: "any" }, { timeoutMs: 2000 }),
    ).resolves.toEqual([]);
  });
});
