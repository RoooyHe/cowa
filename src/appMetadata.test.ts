import { describe, expect, it } from "vitest";

import indexHtml from "../index.html?raw";
import tauriConfig from "../src-tauri/tauri.conf.json";

// issue #7「应用元信息」：窗口标题 / productName / identifier 不再是模板默认。
//
// 模板默认 = 脚手架按项目名自动填的那组：
//   - `tauri init`：productName `tauri-app`、title `Tauri App`、identifier `com.tauri.dev`
//   - `create-tauri-app`（项目名 `cowa`）：productName `cowa`、title `cowa`、identifier `com.cowa.app`
// 这三处一旦退回其中任一值，这里就红。

const TEMPLATE_DEFAULTS = {
  productName: ["tauri-app", "cowa", "MyApp"],
  title: ["tauri-app", "Tauri App", "Tauri", "cowa"],
  identifier: ["com.tauri.dev", "com.tauri-app.app", "com.cowa.app"],
};

const windowTitle = tauriConfig.app.windows[0].title;

describe("应用元信息（issue #7）", () => {
  it("productName 是给系统看的名字，不再是模板默认", () => {
    expect(TEMPLATE_DEFAULTS.productName).not.toContain(tauriConfig.productName);
    expect(tauriConfig.productName).toContain("cowa");
    // 可执行文件仍叫 ASCII 的 cowa——CJK / 空格只留在展示名里。
    expect(tauriConfig.mainBinaryName).toBe("cowa");
  });

  it("窗口标题不再是模板默认", () => {
    expect(TEMPLATE_DEFAULTS.title).not.toContain(windowTitle);
    expect(windowTitle).toContain("cowa");
  });

  it("identifier 是反向域名，不再是模板默认", () => {
    expect(TEMPLATE_DEFAULTS.identifier).not.toContain(tauriConfig.identifier);
    // 反向域名写法：至少三段，只含小写字母、数字、点、连字符。
    expect(tauriConfig.identifier).toMatch(/^[a-z0-9.-]+$/);
    expect(tauriConfig.identifier.split(".").length).toBeGreaterThanOrEqual(3);
  });

  it("入口 HTML 的 title 与窗口标题一致", () => {
    expect(indexHtml).toContain(`<title>${windowTitle}</title>`);
  });
});
