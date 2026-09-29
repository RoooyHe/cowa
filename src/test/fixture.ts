import fixtureRaw from "../../fixtures/field-updates.jsonl?raw";

import type { FieldUpdate } from "../hardware/contract";
import { applyFieldUpdate, closeStream, initialStreamState, type StreamState } from "../hardware/stream";

// 真实夹具，与 Rust 的 contract_fixture 测试读同一份文件（见 fixtures/README.md）。
// 抹除过的实测输出，覆盖全部 12 个 FieldId、多值行、一条并陈。
function loadFixture(): FieldUpdate[] {
  return fixtureRaw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as FieldUpdate);
}

// 把夹具喂进已关闭的流：所有格子都是真值，没有骨架也没有 `未知`。
export function loadedState(): StreamState {
  let state = initialStreamState;
  for (const update of loadFixture()) state = applyFieldUpdate(state, update);
  return closeStream(state);
}
