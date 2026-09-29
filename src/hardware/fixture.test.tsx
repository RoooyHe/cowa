import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// 真实夹具，与 Rust 的 contract_fixture 测试读同一份文件（见 fixtures/README.md）。
// 抹除过的实测输出，覆盖全部 12 个 FieldId、多值行、一条并陈。
import fixtureRaw from "../../fixtures/field-updates.jsonl?raw";

import { FIXED_LABELS, cell } from "../test/blueprint";
import type { FieldUpdate } from "./contract";
import { HardwareOverview } from "./HardwareOverview";
import { applyFieldUpdate, closeStream, initialStreamState, type StreamState } from "./stream";

// 夹具里各行的值条数：三条多值行 + 两处单值行（防「把 1 条渲染成 2 条」这种错）。
const VALUE_COUNTS: Array<{ label: string; count: number }> = [
  { label: "显卡", count: 2 },
  { label: "显示器", count: 2 },
  { label: "声卡", count: 2 },
  { label: "处理器", count: 1 },
  { label: "网卡", count: 1 },
];

function loadFixture(): FieldUpdate[] {
  return fixtureRaw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as FieldUpdate);
}

function loadedState(): StreamState {
  let state = initialStreamState;
  for (const update of loadFixture()) state = applyFieldUpdate(state, update);
  return closeStream(state);
}

function valueCount(label: string): number {
  const values = cell(label).querySelector(".blueprint-value");
  if (!values) throw new Error(`no value container for ${label}`);
  return values.children.length;
}

describe("HardwareOverview × 真实夹具", () => {
  it("renders exactly 3 cards and 9 rows", () => {
    const { container } = render(<HardwareOverview state={loadedState()} />);

    expect(container.querySelectorAll('[data-region="cards"] [data-field]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-region="rows"] [data-field]')).toHaveLength(9);
  });

  it("fills every field of the fixed blueprint", () => {
    render(<HardwareOverview state={loadedState()} />);

    for (const label of FIXED_LABELS) {
      expect(cell(label)).toHaveAttribute("data-state", "value");
    }
    expect(screen.queryAllByTestId("skeleton")).toHaveLength(0);
    expect(screen.queryByText("未知")).not.toBeInTheDocument();
  });

  it("renders each multi-value row with the right number of values", () => {
    render(<HardwareOverview state={loadedState()} />);

    for (const { label, count } of VALUE_COUNTS) {
      expect(valueCount(label), label).toBe(count);
    }
  });

  it("shows both sides of the pair", () => {
    render(<HardwareOverview state={loadedState()} />);

    const disk = cell("磁盘");
    expect(within(disk).getByText("WDC PC SN730 SDBPNTY-512G-1027")).toBeInTheDocument();
    expect(within(disk).getByText("512GB")).toBeInTheDocument();
    expect(within(disk).getByText("476.9 GiB")).toBeInTheDocument();
  });

  it("translates the fixture's enums on screen", () => {
    render(<HardwareOverview state={loadedState()} />);

    // 夹具里存的是原始枚举值（`26` / `2`），屏上必须是翻好的字。
    const memory = cell("内存");
    expect(within(memory).getByText("DDR4")).toBeInTheDocument();
    expect(memory).not.toHaveTextContent("26");
    expect(within(cell("型号信息")).getByText("笔记本")).toBeInTheDocument();
  });
});
