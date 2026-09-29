import { BuildPlans } from "./BuildPlans";
import type { BuildPlan } from "./contract";

// `装机方案` 屏（issue #21 / #22）。取数在组合根完成——这里只收映射好的
// `BuildPlan[]`，**不自己发请求**（spec 的「那条缝」）；卡片渲染交给
// `BuildPlans`（issue #22）。因此这一屏的测试里既没有 Supabase 也没有网络。
export function BuildPlansScreen({ plans }: { plans: BuildPlan[] }) {
  return <BuildPlans plans={plans} />;
}
