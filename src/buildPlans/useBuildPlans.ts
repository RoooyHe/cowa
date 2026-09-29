import { useEffect, useState } from "react";

import type { BuildPlan } from "./contract";
import { fetchBuildPlans, type BuildPlansConfig } from "./fetch";

// 组合根用的取数钩子（issue #21）。见 ADR-0008 / ADR-0009。
//
// 启动时取一次、之后冻结：无缓存、无重试、无手动刷新、不轮询。屏只收
// `BuildPlan[]`；网络与环境变量只出现在这一层与 `fetch.ts`，所以屏的测试里
// 既没有网络也没有 Supabase（同 issue #1「唯一的那条缝」）。
//
// 与采集一样，开发模式的 StrictMode 会跑两次 effect；这里是只读 GET，第二次
// 覆盖第一次，生产只跑一次。
export function useBuildPlans(): BuildPlan[] {
  const [plans, setPlans] = useState<BuildPlan[]>([]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await fetchBuildPlans(supabaseConfig());
        if (!cancelled) setPlans(result);
      } catch {
        // 取数契约上永不抛；真抛了也只当没取到（ADR-0009）。
        if (!cancelled) setPlans([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return plans;
}

// URL 与 anon key 在构建期由 Vite 注入（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）。
// anon key 内嵌进安装包不是问题：它只给读，草稿由 RLS 挡在服务端（ADR-0008）。
function supabaseConfig(): BuildPlansConfig {
  return {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}
