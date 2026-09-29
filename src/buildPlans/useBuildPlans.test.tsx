import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadBuildPlanRows, loadBuildPlans } from "../test/buildPlans";
import { useBuildPlans } from "./useBuildPlans";

// 组合根的取数钩子（issue #21）。缝是「环境变量 + fetch」这两条边界：
// 测试替换它们，钩子对外只给 `BuildPlan[]`。
//
// 钩子的行为就是 ADR-0009 的三句话：启动时取一次；成功给方案；失败 / 超时 / 空
// 都给空。超时在 fetch.test.ts 验（那里能注入短上限）。

function stubOkFetch(body: unknown) {
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => body }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("useBuildPlans（issue #21）", () => {
  it("启动时取一次：成功后给出 BuildPlan[]", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://proj.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    const fetchMock = stubOkFetch(loadBuildPlanRows());

    const { result } = renderHook(() => useBuildPlans());
    // 取数期间与失败时一样是空——第二屏不设 `骨架`（ADR-0009）。
    expect(result.current).toEqual([]);

    await waitFor(() => expect(result.current).toEqual(loadBuildPlans()));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("网络失败 → 空数组，永不抛", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://proj.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useBuildPlans());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current).toEqual([]);
  });

  it("缺环境变量 → 空，且不发起请求", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    const fetchMock = stubOkFetch(loadBuildPlanRows());

    const { result } = renderHook(() => useBuildPlans());

    await waitFor(() => expect(result.current).toEqual([]));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
