import responseRaw from "../../fixtures/build-plans.json?raw";

import { toBuildPlans, type BuildPlan, type BuildPlanRow } from "../buildPlans/contract";

// 真实 Supabase REST 响应夹具（fixtures/build-plans.json）——`?select=*` 原样的
// JSON 数组，`ref_price` 同时覆盖 null 与数字，部件列同时覆盖有值与空列。
// 契约侧与 UI 侧共用这一份，方法参照 src/test/fixture.ts。
export function loadBuildPlanRows(): BuildPlanRow[] {
  return JSON.parse(responseRaw) as BuildPlanRow[];
}

export function loadBuildPlans(): BuildPlan[] {
  return toBuildPlans(loadBuildPlanRows());
}
