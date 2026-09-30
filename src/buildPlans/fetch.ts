import { toBuildPlans, type BuildPlan, type BuildPlanRow } from "./contract";

// Supabase 取数（issue #21）。见 ADR-0008（客户端只读直连）、ADR-0009（启动一次、取不到即空）。
//
// 这是**唯一**发起网络请求的地方；环境变量由 `useBuildPlans.supabaseConfig`
// 读入后传进来。它不抛：失败 / 超时 / 空表都归空数组——
// 信使不为空缺编故事，屏上也就没有错误文案（ADR-0009）。
//
// 没有自建后端：一条 REST GET，publishable key + RLS 在服务端只放行 `published = true`。
// 因此**不引入** `@supabase/supabase-js`。

// 查询只带 `apikey` 一个凭证头。
//
// Supabase 新版的 publishable key（`sb_publishable_...`）**不是 JWT**：它只认
// `apikey` 头，扔进 `Authorization: Bearer` 会被 PostgREST 当坏 JWT 拒掉
// （PGRST301 Invalid JWT parts），于是取数失败、第二屏永远空。
//
// 不带 `Authorization` 也不影响 RLS：PostgREST 没有用户 JWT 时就落到
// `db-anon-role`（即 `anon`），正是我们要的角色。V2 没有登录（ADR-0008）。
const REQUEST_HEADERS = (anonKey: string): Record<string, string> => ({
  apikey: anonKey,
  Accept: "application/json",
});

// 表与查询形状锁在这里：`?select=*&order=sort.asc`（issue #21）。`published`
// 的过滤是 RLS 的活，不在客户端拼 `eq`。
const BUILD_PLANS_URL = "/rest/v1/build_plans?select=*&order=sort.asc";

// 网络上限：超时就不再等，这一屏为空（ADR-0009 的「超时 → 空」）。**不重试**。
const TIMEOUT_MS = 5000;

export type BuildPlansConfig = {
  url: string | undefined;
  anonKey: string | undefined;
};

// 只需 `fetch` 的最小形状——测试注入假实现，不必模拟整个 `Response`。
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export type FetchBuildPlansDeps = {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
};

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${BUILD_PLANS_URL}`;
}

// 启动时取一次、之后冻结：无缓存、无重试、无手动刷新、不轮询。
// 返回 `BuildPlan[]`；任何一步出岔子都返回空数组。
export async function fetchBuildPlans(
  config: BuildPlansConfig,
  deps: FetchBuildPlansDeps = {},
): Promise<BuildPlan[]> {
  const { url, anonKey } = config;
  // 没配好（打包漏注入 / 本地没 .env）＝取不到，不是错误。
  if (!url || !anonKey) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? TIMEOUT_MS);

  try {
    // 解析 `fetch` 也放进 try：环境里没有全局 `fetch` 时算取不到，不抛。
    const fetchImpl = deps.fetchImpl ?? (fetch as unknown as FetchLike);
    const response = await fetchImpl(endpoint(url), {
      method: "GET",
      headers: REQUEST_HEADERS(anonKey),
      signal: controller.signal,
    });

    if (!response.ok) return [];
    const body = await response.json();
    // `select=*` 的顶层必须是数组；形状不对就当空表。
    if (!Array.isArray(body)) return [];
    return toBuildPlans(body as BuildPlanRow[]);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
