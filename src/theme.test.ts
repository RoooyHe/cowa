import { describe, expect, it } from "vitest";

import appCss from "./App.css?raw";
import tauriConfig from "../src-tauri/tauri.conf.json";

// T3 终端主题（issue #6）：冷灰底 + 24px 微网格 + 青绿强调 + 等宽字，
// 深浅两套都由 `prefers-color-scheme` 驱动，屏上不出现任何切换控件。
//
// 主题是 CSS，jsdom 不会真的把样式表算进 computed style——所以这里读
// `App.css` 的令牌本身。断言的是 issue #6 写下的规格，不是实现细节：
// 谁删掉深色一套、谁把 24px 网格换成别的数，这里都该红。

const DARK_QUERY = "@media (prefers-color-scheme: dark)";
const darkAt = appCss.indexOf(DARK_QUERY);
const lightPalette = appCss.slice(0, darkAt);
const darkPalette = appCss.slice(darkAt);

describe("T3 终端主题（issue #6）", () => {
  it("冷灰底是 #eef2f5，青绿强调是 #0d7f74", () => {
    expect(lightPalette).toContain("#eef2f5");
    expect(lightPalette).toContain("#0d7f74");
  });

  it("铺的是 24px 微网格", () => {
    expect(appCss).toContain("linear-gradient");
    expect(appCss).toContain("background-size: 24px 24px");
  });

  it("用等宽字", () => {
    expect(lightPalette).toMatch(/font-family:[^;]*monospace/);
  });

  it("深浅两套都由 prefers-color-scheme 驱动，且各自定义全套令牌", () => {
    expect(darkAt, `App.css 里没有 ${DARK_QUERY}`).toBeGreaterThanOrEqual(0);

    for (const token of ["--bg", "--ink", "--accent", "--grid"]) {
      expect(lightPalette, `浅色缺 ${token}`).toContain(`${token}:`);
      expect(darkPalette, `深色缺 ${token}`).toContain(`${token}:`);
    }
  });
});

describe("窗口默认 800×600（issue #6）", () => {
  it("tauri.conf.json 的主窗口是 800×600", () => {
    expect(tauriConfig.app.windows[0]).toMatchObject({ width: 800, height: 600 });
  });
});
