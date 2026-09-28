import type { BlueprintEntry, SnapshotValue } from "./contract";
import { CARDS, ROWS } from "./contract";
import { resolveField, type ResolvedField, type StreamState } from "./stream";

function ValueView({ value }: { value: SnapshotValue }) {
  switch (value.kind) {
    case "value":
      return <span className="value-text">{value.text}</span>;
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
      <header className="blueprint-cards">
        {CARDS.map((entry) => (
          <BlueprintCell key={entry.field} entry={entry} resolved={resolveField(state, entry.field)} />
        ))}
      </header>
      <div className="blueprint-rows">
        {ROWS.map((entry) => (
          <BlueprintCell key={entry.field} entry={entry} resolved={resolveField(state, entry.field)} />
        ))}
      </div>
    </main>
  );
}
