// 源码扫描的共用输入：零交互守卫（ADR-0007）与取数缝守卫（issue #21）读同一份
// 源文件，别各写一遍 glob。键相对本文件（`src/test/`），即 `../<路径>`。
export const SOURCE_FILES = import.meta.glob(
  ["../**/*.ts", "../**/*.tsx", "!../**/*.test.ts", "!../**/*.test.tsx", "!../vite-env.d.ts"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;
