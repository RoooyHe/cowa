// PROTOTYPE — 布局原型的挂载点。
//
// 问题：硬件概览这块屏幕（固定图纸 / 多值行 / 并陈 / 骨架）到底该长什么样？
// 四个结构互不相同的变体挂在既有根路由上，用 ?variant= 切换；
// 外加 ?phase= 用来预览骨架 / 填充中 / 已完成三种状态。
//
// 值来自 prototype/wmi-probe 的实测输出。不接任何真实采集，页面上没有任何交互元素
// （真实产品是 `零交互` 的——那两个切换器属于原型，不属于设计）。
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
  const [variant, setVariant] = useState(() => readParam("variant", "A").toUpperCase());
  const [phase, setPhase] = useState<Phase>(() => {
    const p = readParam("phase", "loaded");
    return isPhase(p) ? p : "loaded";
  });

  useEffect(() => {
    const onPop = () => {
      setVariant(readParam("variant", "A").toUpperCase());
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
  const pickPhase = useCallback((k: string) => {
    writeParam("phase", k);
    setPhase(isPhase(k) ? k : "loaded");
  }, []);

  const shownRows = withPhase(rows, phase);
  const Body =
    variant === "B" ? VariantB : variant === "C" ? VariantC : variant === "D" ? VariantD : VariantA;

  return (
    <div className="pt-shell">
      <div className="pt-hint">
        800 × 600 —— tauri.conf.json 里的默认窗口。内容装不下就会出滚动条，滚动条本身就是结论。
      </div>

      <div className="pt-frame">
        <Body cards={cards} rows={shownRows} />
      </div>

      <div className="pt-bar">
        <PrototypeBar
          items={VARIANTS}
          current={VARIANTS.some((x) => x.key === variant) ? variant : "A"}
          onSelect={pickVariant}
          tag="PROTOTYPE · 变体"
        />
        <PrototypeBar items={PHASES} current={phase} onSelect={pickPhase} tag="状态" />
      </div>
    </div>
  );
}
