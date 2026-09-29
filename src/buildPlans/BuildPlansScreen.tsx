import { BuildPlans } from "./BuildPlans";

// `装机方案` 屏。取数（Supabase，issue #21）接在这一层——`BuildPlans` 只收
// `BuildPlan[]`，所以渲染层测试里没有网络与 Tauri。在 #21 落地前，屏上就是
// 空数组：ADR-0009 的「取不到即空」。
export function BuildPlansScreen() {
  return <BuildPlans plans={[]} />;
}
