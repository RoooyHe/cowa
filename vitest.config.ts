import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// 组件测试的注入点在最高处（the `FieldUpdate` 流），组件本身不碰 Tauri，
// 所以这里只需要 jsdom，不需要任何 Tauri mock。见 issue #1「唯一的那条缝」。
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
