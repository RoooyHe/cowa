import { defineConfig } from "vitest/config";

// 采集器的真机集成测试（issue #8）——跑在**当前这台 Windows 机器**上，**不进 CI**。
//
// 默认的 `vitest.config.ts` 只收 `src/**`，所以 `integration/**` 天然落在 CI 之外；
// 这一份配置单独收 `integration/**`，用朴素的 node 环境（不需要 jsdom / React setup）。
// 运行方式是 `bun run test:integration`，不是 `bun run test`。
export default defineConfig({
  test: {
    environment: "node",
    include: ["integration/**/*.test.ts"],
    // 真机采集一次约 5 秒，脚本内最慢的字段还有 3 秒查询上限；留足余量。
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // 采集是重活：不让多个 PowerShell 同时抢 WMI。
    fileParallelism: false,
  },
});
