import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// 组件测试的注入点在最高处（the `FieldUpdate` 流），组件本身不碰 Tauri，
// 所以这里只需要 jsdom，不需要任何 Tauri mock。见 issue #1「唯一的那条缝」。
//
// `css: true`：主题守卫（issue #6）要读 `App.css` 的原文来断言深浅两套令牌。
// Vitest 默认把 CSS 换成空串，`?raw` 也一并被吞掉。
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: true,
  },
});
