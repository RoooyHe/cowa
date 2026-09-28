import type { FieldId, FieldUpdate, SnapshotValue } from "./contract";

// UI 侧由流推出的状态。契约里没有「还没到」，骨架在这里。
export type StreamState = {
  open: boolean;
  received: Partial<Record<FieldId, SnapshotValue[]>>;
};

export const initialStreamState: StreamState = { open: true, received: {} };

export function applyFieldUpdate(state: StreamState, update: FieldUpdate): StreamState {
  return { ...state, received: { ...state.received, [update.field]: update.values } };
}

export function closeStream(state: StreamState): StreamState {
  return { ...state, open: false };
}

export type FieldState = "skeleton" | "value" | "unknown";

export type ResolvedField = { state: FieldState; values: SnapshotValue[] };

// 状态规则：流还开着而该字段未回 → 骨架；流已关闭而该字段仍空 → 未知。
export function resolveField(state: StreamState, field: FieldId): ResolvedField {
  const values = state.received[field];
  if (values && values.length > 0) {
    if (values.every((value) => value.kind === "unknown")) {
      return { state: "unknown", values: [{ kind: "unknown" }] };
    }
    return { state: "value", values };
  }
  if (state.open) return { state: "skeleton", values: [] };
  return { state: "unknown", values: [{ kind: "unknown" }] };
}
