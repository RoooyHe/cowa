import { afterEach, describe, expect, it, vi } from "vitest";

import { loadBuildPlanRows, loadBuildPlans } from "../test/buildPlans";
import { fetchBuildPlans, type FetchLike } from "./fetch";

// 取数的唯一缝（issue #21）：`fetchBuildPlans` 是**唯一**碰网络与环境变量的地方，
// 所以组件测试里既没有 Supabase 也没有网络。见 ADR-0008 / ADR-0009。
//
// 依赖（fetch / 超时）全部注入，测试不打桩全局，也不碰真项目。

const CONFIG = { url: "https://proj.supabase.co", anonKey: "anon-key" };

afterEach(() => {
  vi.unstubAllGlobals();
});

const EXPECTED_URL =
  "https://proj.supabase.co/rest/v1/build_plans?select=*&order=sort.asc";

// 一个「成功」的 fetch：响应体是夹具原样（`?select=*` 的 JSON 数组，未映射的行）。
function okFetch(body: unknown = loadBuildPlanRows()): FetchLike {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => body,
  })) as unknown as FetchLike;
}

// 一个永不落地的 fetch：只在被 abort 时 reject——用来测「查询上限」。
function hangingFetch(): FetchLike {
  return vi.fn(
    (_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
  ) as unknown as FetchLike;
}

function callArgs(fetchImpl: FetchLike, index = 0) {
  const mock = fetchImpl as unknown as ReturnType<typeof vi.fn>;
  return mock.mock.calls[index] as [string, RequestInit];
}

describe("装机方案取数（issue #21 / ADR-0008 / ADR-0009）", () => {
  it("成功：返回映射后的 BuildPlan[]，顺序照抄响应", async () => {
    const plans = await fetchBuildPlans(CONFIG, { fetchImpl: okFetch() });

    expect(plans).toEqual(loadBuildPlans());
    expect(plans.map((plan) => plan.name)).toEqual(loadBuildPlans().map((plan) => plan.name));
  });

  it("查询形状：`?select=*&order=sort.asc`，anon key 走 apikey 与 Bearer", async () => {
    const fetchImpl = okFetch();

    await fetchBuildPlans(CONFIG, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = callArgs(fetchImpl);
    expect(url).toBe(EXPECTED_URL);
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({
      apikey: CONFIG.anonKey,
      Authorization: `Bearer ${CONFIG.anonKey}`,
      Accept: "application/json",
    });
  });

  it("base URL 末尾的斜杠不拼出双斜杠", async () => {
    const fetchImpl = okFetch();

    await fetchBuildPlans({ ...CONFIG, url: "https://proj.supabase.co/" }, { fetchImpl });

    expect(callArgs(fetchImpl)[0]).toBe(EXPECTED_URL);
  });

  it("HTTP 非 2xx → 空，不抛", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => {
        throw new Error("不该读 body");
      },
    })) as unknown as FetchLike;

    await expect(fetchBuildPlans(CONFIG, { fetchImpl })).resolves.toEqual([]);
  });

  it("网络异常（fetch reject）→ 空，不抛", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as FetchLike;

    await expect(fetchBuildPlans(CONFIG, { fetchImpl })).resolves.toEqual([]);
  });

  it("响应不是数组（形状异常）→ 空，不抛", async () => {
    const fetchImpl = okFetch({ message: "unexpected" });

    await expect(fetchBuildPlans(CONFIG, { fetchImpl })).resolves.toEqual([]);
  });

  it("JSON 解析失败 → 空，不抛", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    })) as unknown as FetchLike;

    await expect(fetchBuildPlans(CONFIG, { fetchImpl })).resolves.toEqual([]);
  });

  it("空表 → 空", async () => {
    await expect(fetchBuildPlans(CONFIG, { fetchImpl: okFetch([]) })).resolves.toEqual([]);
  });

  it("超时 → 空，且在查询上限内返回，不抛", async () => {
    const fetchImpl = hangingFetch();

    const plans = await fetchBuildPlans(CONFIG, { fetchImpl, timeoutMs: 10 });

    expect(plans).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("缺 URL 或 anon key → 空，且不发起请求", async () => {
    const fetchImpl = okFetch();

    await expect(fetchBuildPlans({ url: undefined, anonKey: "k" }, { fetchImpl })).resolves.toEqual([]);
    await expect(fetchBuildPlans({ url: "https://x", anonKey: undefined }, { fetchImpl })).resolves.toEqual([]);
    await expect(fetchBuildPlans({ url: "", anonKey: "" }, { fetchImpl })).resolves.toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("环境里没有全局 fetch 也永不抛：当取不到", async () => {
    vi.stubGlobal("fetch", undefined);

    await expect(fetchBuildPlans(CONFIG)).resolves.toEqual([]);
  });

  it("无缓存、无重试：一次调用只发一个请求", async () => {
    const fetchImpl = okFetch();

    await fetchBuildPlans(CONFIG, { fetchImpl });
    await fetchBuildPlans(CONFIG, { fetchImpl });

    // 两次调用 = 两次请求（没有跨调用缓存）；但单次调用内部绝不重试。
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
