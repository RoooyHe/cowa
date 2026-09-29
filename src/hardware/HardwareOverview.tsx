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

function BlueprintCell({ entry, resolved }: { entry: BlueprintEntry; resolved: ResolvedField }) {
  return (
    <div className="blueprint-cell" data-field={entry.field} data-state={resolved.state}>
      <span className="blueprint-label">{entry.label}</span>
      <div className="blueprint-value">
        {resolved.state === "skeleton" ? (
          <span className="skeleton" data-testid="skeleton" aria-hidden="true" />
        ) : (
          resolved.values.map((value, index) => <ValueView key={index} value={value} />)
        )}
      </div>
    </div>
  );
}

export function HardwareOverview({ state }: { state: StreamState }) {
  return (
    <main className="hardware-overview">
      <header className="blueprint-cards" data-region="cards">
        {CARDS.map((entry) => (
          <BlueprintCell key={entry.field} entry={entry} resolved={resolveField(state, entry.field)} />
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
