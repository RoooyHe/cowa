import { Fragment } from "react";

import type { BlueprintEntry, SnapshotValue, ValuePart } from "./contract";
import { CARDS, ROWS } from "./contract";
import { translateEnum } from "./enums";
import { resolveField, type ResolvedField, type StreamState } from "./stream";

function PartView({ part }: { part: ValuePart }) {
  if (part.kind === "text") return <>{part.text}</>;
  // 裸数值绝不上屏：枚举一律走翻译表（issue #4）。
  return <span className="value-enum">{translateEnum(part.table, part.code)}</span>;
}

function ValueView({ value }: { value: SnapshotValue }) {
  switch (value.kind) {
    case "value":
      return <span className="value-text">{value.text}</span>;
    case "parts":
      return (
        <span className="value-parts">
          {value.parts.map((part, index) => (
            <PartView key={index} part={part} />
          ))}
        </span>
      );
    case "pair":
      // `并陈` 拍平成 `型号 · 标称 · 实测` 一行：不套括号，两个真值都留着（issue #7）。
      return (
        <span className="value-pair">
          <span className="value-lead">{value.lead}</span>
          <span className="value-sep">·</span>
          <span className="value-nominal">{value.nominal}</span>
          <span className="value-sep">·</span>
          <span className="value-actual">{value.actual}</span>
        </span>
      );
    case "unknown":
      return <span className="value-unknown">未知</span>;
  }
}

function Skeleton() {
  return <span className="skeleton" data-testid="skeleton" aria-hidden="true" />;
}

// 九行：一张连续的对齐表。标签列右对齐、右侧一根发丝线；值列左对齐（issue #7）。
function BlueprintCell({ entry, resolved }: { entry: BlueprintEntry; resolved: ResolvedField }) {
  return (
    <div className="blueprint-cell" data-field={entry.field} data-state={resolved.state}>
      <span className="blueprint-label">{entry.label}</span>
      <div className="blueprint-value">
        {resolved.state === "skeleton" ? (
          <Skeleton />
        ) : (
          resolved.values.map((value, index) => <ValueView key={index} value={value} />)
        )}
      </div>
    </div>
  );
}

// 三张卡：顶栏一条淡色带，primary 串成一行，secondary 用弱色跟在各自 primary 后面。
// 卡上没有可见标签——这一行是机读摘要，不是三张带标签的卡（issue #7）；
// 图纸里的卡标签仍作每张卡的无障碍名字。
function CardSummary({ entry, resolved }: { entry: BlueprintEntry; resolved: ResolvedField }) {
  return (
    <span
      className="blueprint-card"
      role="group"
      aria-label={entry.label}
      data-field={entry.field}
      data-state={resolved.state}
    >
      {resolved.state === "skeleton" ? (
        <Skeleton />
      ) : resolved.state === "unknown" ? (
        <span className="value-unknown">未知</span>
      ) : (
        resolved.values.map((value, index) =>
          index === 0 ? (
            <b className="card-primary" key={index}>
              <ValueView value={value} />
            </b>
          ) : (
            <span className="card-secondary" key={index}>
              {" "}
              <ValueView value={value} />
            </span>
          ),
        )
      )}
    </span>
  );
}

export function HardwareOverview({ state }: { state: StreamState }) {
  return (
    <main className="hardware-overview">
      <header className="blueprint-band" data-region="cards">
        {CARDS.map((entry, index) => (
          <Fragment key={entry.field}>
            {index > 0 && (
              <span className="band-sep" aria-hidden="true">
                │
              </span>
            )}
            <CardSummary entry={entry} resolved={resolveField(state, entry.field)} />
          </Fragment>
        ))}
      </header>
      <div className="blueprint-rows" data-region="rows">
        {ROWS.map((entry) => (
          <BlueprintCell key={entry.field} entry={entry} resolved={resolveField(state, entry.field)} />
        ))}
      </div>
    </main>
  );
}
