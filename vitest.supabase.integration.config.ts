import { defineConfig } from "vitest/config";

// 装机方案的真项目集成测试（issue #23）：只收它一个文件，并且**要求**配好 Supabase
// 凭据——没配好就让整个 run 报错，而不是静默跳过（避免假绿）。
//
//   bun run test:integration:supabase
//
// 需要 `.env.local`（或环境变量）里的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY。
// 「连不上即空」那条也在这里，但它不需要凭据；真项目那几条才是重点。
export default defineConfig({
  test: {
    environment: "node",
    include: ["integration/buildPlans.integration.test.ts"],
    // 真项目走公网：给足余量。
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // 标记「这次必须配好凭据」，测试文件据此把「缺凭据」从跳过升级为报错。
    env: { COWA_REQUIRE_SUPABASE_INTEGRATION: "1" },
  },
});
