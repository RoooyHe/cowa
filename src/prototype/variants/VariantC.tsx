// 变体 C — 磁贴网格
// 没有 label 列。每个字段是一块砖，标签是砖上的小字。多值行占满整行。
// 并陈的解法：两枚并排徽标，标称 / 实测一眼分清。
// PROTOTYPE

import type { Card, Row, Value } from "../data";

const SKEL_W = [16, 11, 20, 24, 18, 15, 13, 14, 8];

function Val({ value, i }: { value: Value; i: number }) {
  if (value.kind === "loading") {
    return <span className="sk" style={{ width: `${SKEL_W[i % SKEL_W.length]}ch` }} />;
  }
  if (value.kind === "unknown") return <span className="unk">未知</span>;
  if (value.kind === "pair") {
    return (
      <>
        <div className="vc-badges">
          <span className="vc-badge">{value.nominal}</span>
          <span className="vc-badge actual">{value.actual}</span>
        </div>
        <div className="vc-lead">{value.lead}</div>
      </>
    );
  }
  return <span>{value.text}</span>;
}

export function VariantC({ cards, rows }: { cards: Card[]; rows: Row[] }) {
  return (
    <div className="vc">
      {cards.map((c, i) => (
        <div className={"vc-tile" + (i === 0 ? " vc-tile-wide" : "")} key={c.label}>
          <div className="vc-tile-label">{c.label}</div>
          <div className="vc-tile-val">{c.primary}</div>
          {c.secondary && <div className="vc-tile-val vc-lead">{c.secondary}</div>}
        </div>
      ))}

      {rows.map((row) => (
        <div
          className={"vc-tile" + (row.values.length > 1 ? " vc-tile-wide" : "")}
          key={row.label}
        >
          <div className="vc-tile-label">{row.label}</div>
          {row.values.map((value, i) => (
            <div className="vc-tile-val" key={i}>
              <Val value={value} i={i + row.label.length} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
