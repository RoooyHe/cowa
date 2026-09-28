// PROTOTYPE — 布局 + 主题原型。
//
// 结构已定：B 规格单。这一轮问的是**主题**——「有科技感的白」到底是哪种白。
// 四个主题共用同一份结构，所以 ?theme= 换的是打扮，不是布局。
// ?theme=system 走 prefers-color-scheme，用来演示「随系统」。
//
// 值来自 prototype/wmi-probe 的实测输出。不接任何真实采集，页面上没有任何交互元素
// （真实产品是 `零交互` 的——这几个切换器属于原型，不属于设计）。
//
// 看完就删：整份代码在 prototype/layout 分支上，不进 master。

import { useCallback, useEffect, useState } from "react";
import { cards, rows, withPhase, PHASES, type Phase } from "./data";
import { PrototypeBar } from "./PrototypeSwitcher";
import { VariantA } from "./variants/VariantA";
import { VariantB } from "./variants/VariantB";
import { VariantC } from "./variants/VariantC";
import { VariantD } from "./variants/VariantD";
import "./prototype.css";

const VARIANTS = [
  { key: "A", name: "参考图直系（三卡 + 两列列表）" },
  { key: "B", name: "规格单（连续等宽表）" },
  { key: "C", name: "磁贴网格（每字段一块砖）" },
  { key: "D", name: "单列大卡（值最大、密度最低）" },
];

const THEMES = [
  { key: "t1", name: "T1 蓝图（冷白 · 工业蓝）" },
  { key: "t2", name: "T2 仪器（纸白 · 琥珀）" },
  { key: "t3", name: "T3 终端（冷灰 · 微网格 · 青绿）" },
  { key: "dark", name: "暗色（上一轮那套）" },
  { key: "system", name: "跟随系统 auto" },
];

const isPhase = (x: string): x is Phase => PHASES.some((p) => p.key === x);

function readParam(key: string, fallback: string) {
  return new URLSearchParams(window.location.search).get(key) ?? fallback;
}

function writeParam(key: string, value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.replaceState(null, "", url);
}

export default function PrototypeApp() {
  const [variant, setVariant] = useState(() => readParam("variant", "B").toUpperCase());
  const [theme, setTheme] = useState(() => readParam("theme", "t1"));
  const [phase, setPhase] = useState<Phase>(() => {
    const p = readParam("phase", "loaded");
    return isPhase(p) ? p : "loaded";
  });
  const [sysDark, setSysDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  // 「跟随系统」的全部实现：监听 prefers-color-scheme，别的什么都不做。
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setSysDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const onPop = () => {
      setVariant(readParam("variant", "B").toUpperCase());
      setTheme(readParam("theme", "t1"));
      const p = readParam("phase", "loaded");
      setPhase(isPhase(p) ? p : "loaded");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const pickVariant = useCallback((k: string) => {
    writeParam("variant", k);
    setVariant(k);
  }, []);
  const pickTheme = useCallback((k: string) => {
    writeParam("theme", k);
    setTheme(k);
  }, []);
  const pickPhase = useCallback((k: string) => {
    writeParam("phase", k);
    setPhase(isPhase(k) ? k : "loaded");
  }, []);

  const shownRows = withPhase(rows, phase);
  const Body =
    variant === "A" ? VariantA : variant === "C" ? VariantC : variant === "D" ? VariantD : VariantB;

  const themeKey = THEMES.some((t) => t.key === theme) ? theme : "t1";
  const resolved = themeKey === "system" ? (sysDark ? "dark" : "t1") : themeKey;

  return (
    <div className="pt-shell">
      <div className="pt-hint">
        800 × 600 —— tauri.conf.json 里的默认窗口
        {themeKey === "system" && ` ｜ 跟随系统：系统现在是${sysDark ? "深色" : "浅色"} → 解析为 ${resolved}`}
      </div>

      <div className="pt-frame" data-theme={resolved}>
        <Body cards={cards} rows={shownRows} />
      </div>

      <div className="pt-bar">
        <PrototypeBar
          items={VARIANTS}
          current={VARIANTS.some((x) => x.key === variant) ? variant : "B"}
          onSelect={pickVariant}
          tag="变体"
        />
        <PrototypeBar items={THEMES} current={themeKey} onSelect={pickTheme} tag="主题" />
        <PrototypeBar items={PHASES} current={phase} onSelect={pickPhase} tag="状态" />
      </div>
    </div>
  );
}
