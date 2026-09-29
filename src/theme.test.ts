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

// 深浅跟随系统的收尾守卫（issue #23）：`装机方案` 与 `硬件概览` 用同一套
// 颜色令牌，两套调色板都定义齐全，屏上没有任何写死的颜色。

// `App.css` 里全部颜色令牌。深度两套各自定义一次——少一个，某屏在某个
// 主题下就会用回继承色 / 透明。
const COLOR_TOKENS = [
  "--bg",
  "--line-soft",
  "--head",
  "--rule",
  "--ink",
  "--ink-dim",
  "--ink-faint",
  "--skeleton",
  "--skeleton-highlight",
  "--accent",
  "--accent-edge",
  "--grid",
  "--shadow",
] as const;

// 从 `App.css` 里取一个选择器的声明块。选择器总在行首（前面可能是 `}` 或注释），
// 这样 `.plan-part` 不会误中 `.plan-parts`。
function cssRule(css: string, selector: string): string | undefined {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|[}\\n])\\s*${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1];
}

describe("深浅跟随系统（issue #23）", () => {
  it("所有颜色令牌在浅色与深色两套里都定义", () => {
    for (const token of COLOR_TOKENS) {
      expect(lightPalette, `浅色缺 ${token}`).toContain(`${token}:`);
      expect(darkPalette, `深色缺 ${token}`).toContain(`${token}:`);
    }
  });

  it("凡是用到的令牌都有定义——没有悬空的 var()", () => {
    const defined = new Set([...appCss.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
    const used = new Set([...appCss.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((match) => match[1]));

    expect(used.size, "一个令牌都没用到——断言会空转").toBeGreaterThan(0);
    for (const token of used) {
      expect(defined.has(token), `${token} 被引用但没有定义`).toBe(true);
    }
  });

  it("第二屏只用主题令牌上色，不写死颜色", () => {
    const secondScreenSelectors = [
      ".build-plans",
      ".build-plan",
      ".plan-head",
      ".plan-name",
      ".plan-tier",
      ".plan-price",
      ".plan-price-label",
      ".plan-intro",
      ".plan-parts",
      ".plan-part",
      ".plan-part-label",
      ".plan-part-value",
    ];

    let colored = 0;
    for (const selector of secondScreenSelectors) {
      const block = cssRule(appCss, selector);
      expect(block, `App.css 里没有 ${selector} 的规则`).not.toBeUndefined();
      // 颜色必须走 var(--…)：出现十六进制 / rgb / hsl 就是写死，深浅会不同步。
      expect(block, `${selector} 写死了颜色`).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
      if (/var\(--/.test(block ?? "")) colored += 1;
    }
    expect(colored, "第二屏一条用令牌上色的规则都没有——断言空转").toBeGreaterThan(0);
  });
});
