// 变体 D — 单列大卡
// 顶部一条细横带装三张卡，下面一个字段一张大卡，值最大、密度最低、滚动最多。
// 并陈的解法：标称当主角（大号），实测做脚注（等宽、强调色）。
// PROTOTYPE

import type { Card, Row, Value } from "../data";

const SKEL_W = [260, 170, 300, 340, 280, 240, 200, 220, 140];

function Val({ value, i }: { value: Value; i: number }) {
  if (value.kind === "loading") {
    return <span className="sk" style={{ width: SKEL_W[i % SKEL_W.length] }} />;
  }
  if (value.kind === "unknown") return <span className="unk">未知</span>;
  if (value.kind === "pair") {
    return (
      <>
        <div className="vd-big">{value.nominal}</div>
        <div className="vd-sub">{value.actual}</div>
        <div className="vd-lead">{value.lead}</div>
      </>
    );
  }
  return <span>{value.text}</span>;
}

export function VariantD({ cards, rows }: { cards: Card[]; rows: Row[] }) {
  return (
    <div className="vd">
      <div className="vd-strip">
        {cards.map((c) => (
          <div className="vd-strip-item" key={c.label}>
            <div className="vd-strip-label">{c.label}</div>
            <div className="vd-strip-val">{c.primary}</div>
            {c.secondary && <div className="vd-strip-sub">{c.secondary}</div>}
          </div>
        ))}
      </div>

      {rows.map((row) => (
        <div className="vd-card" key={row.label}>
          <div className="vd-card-label">{row.label}</div>
          {row.values.map((value, i) => (
            <div className="vd-card-val" key={i}>
              <Val value={value} i={i + row.label.length} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
