// 变体 B — 规格单
// 一张卡都没有。顶部一行机读摘要，下面是一张连续的、等宽的、BIOS 式对齐表。
// 密度最高、装饰最少，最贴「信使」这个性格。
// 并陈的解法：拍平成 `·` 分隔的一行，不嵌套，实测值用强调色。
// PROTOTYPE

import type { Card, Row, Value } from "../data";

const SKEL_W = [18, 12, 22, 26, 20, 16, 14, 15, 9];

function Val({ value, i }: { value: Value; i: number }) {
  if (value.kind === "loading") {
    return <span className="sk" style={{ width: `${SKEL_W[i % SKEL_W.length]}ch` }} />;
  }
  if (value.kind === "unknown") return <span className="unk">未知</span>;
  if (value.kind === "pair") {
    return (
      <span>
        <span className="vb-pair-lead">{value.lead}</span>
        <span className="vb-sep">·</span>
        <span className="vb-nominal">{value.nominal}</span>
        <span className="vb-sep">·</span>
        <span className="vb-actual">{value.actual}</span>
      </span>
    );
  }
  return <span>{value.text}</span>;
}

export function VariantB({ cards, rows }: { cards: Card[]; rows: Row[] }) {
  return (
    <div className="vb">
      <div className="vb-head">
        {cards.map((c, i) => (
          <span key={c.label}>
            {i > 0 && <span className="sep"> | </span>}
            <b>{c.primary}</b>
            {c.secondary && <span className="vb-pair-lead"> {c.secondary}</span>}
          </span>
        ))}
      </div>

      {rows.map((row) => (
        <div className="vb-row" key={row.label}>
          <div className="vb-label">{row.label}</div>
          <div className="vb-values">
            {row.values.map((value, i) => (
              <div className="vb-val" key={i}>
                <Val value={value} i={i + row.label.length} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
