// 变体 A — 参考图直系
// 三张卡横排 + 下方「标题 + 两列 label/value 列表」，跟鲁大师那张图同构。
// 并陈的解法：**照抄**，括号套括号，一字不改。
// PROTOTYPE

import type { Card, Row, Value } from "../data";

const SKEL_W = [220, 150, 260, 300, 240, 210, 180, 200, 120];

function Val({ value, i }: { value: Value; i: number }) {
  if (value.kind === "loading") {
    return <span className="sk" style={{ width: SKEL_W[i % SKEL_W.length] }} />;
  }
  if (value.kind === "unknown") return <span className="unk">未知</span>;
  if (value.kind === "pair") {
    return (
      <span>
        {value.lead}
        （{value.nominal}（<span className="paren-inner">{value.actual}</span>））
      </span>
    );
  }
  return <span>{value.text}</span>;
}

export function VariantA({ cards, rows }: { cards: Card[]; rows: Row[] }) {
  return (
    <div className="va">
      <div className="va-cards">
        {cards.map((c) => (
          <div className="va-card" key={c.label}>
            <div className="va-card-label">{c.label}</div>
            <div className="va-card-primary">{c.primary}</div>
            {c.secondary && <div className="va-card-secondary">{c.secondary}</div>}
          </div>
        ))}
      </div>

      <div className="va-title">详细信息</div>

      {rows.map((row) => (
        <div className="va-row" key={row.label}>
          <div className="va-row-label">{row.label}</div>
          <div className="va-row-values">
            {row.values.map((value, i) => (
              <div className="va-val" key={i}>
                <Val value={value} i={i + row.label.length} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
