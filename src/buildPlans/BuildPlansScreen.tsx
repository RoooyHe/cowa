import type { BuildPlan } from "./contract";

// `装机方案` 屏（issue #21）。取数在组合根完成——这里只收映射好的 `BuildPlan[]`，
// **不自己发请求**（spec 的「那条缝」）。因此这一屏的测试里既没有 Supabase 也没有网络。
//
// 卡片渲染在 issue #22；此刻只把注入的结果落到容器上。
export function BuildPlansScreen({ plans }: { plans: BuildPlan[] }) {
  return <div className="build-plans" data-plan-count={plans.length} />;
}
