import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ROW_LABELS, cell } from "../test/blueprint";
import { HardwareOverview } from "./HardwareOverview";
import { applyFieldUpdate, closeStream, initialStreamState } from "./stream";

const PROCESSOR = "Intel(R) Core(TM) i5-8265U CPU @ 1.60GHz";

function stateWithProcessor() {
  return applyFieldUpdate(initialStreamState, {
    field: "processor",
    values: [{ kind: "value", text: PROCESSOR }],
  });
}

describe("HardwareOverview", () => {
  it("renders the fixed blueprint, fills the returned field, skeletons the rest", () => {
    const { container } = render(<HardwareOverview state={stateWithProcessor()} />);

    for (const label of ROW_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    // 固定图纸：三张卡 + 九行，卡在顶栏、行在对齐表里，顺序不变。
    expect(container.querySelectorAll('[data-region="cards"] [data-field]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-region="rows"] [data-field]')).toHaveLength(9);

    expect(screen.getByText(PROCESSOR)).toBeInTheDocument();
    expect(cell("处理器")).toHaveAttribute("data-state", "value");

    expect(cell("主板")).toHaveAttribute("data-state", "skeleton");
    expect(screen.getAllByTestId("skeleton")).toHaveLength(11);
  });

  it("renders 未知 for fields the closed stream never filled", () => {
    render(<HardwareOverview state={closeStream(stateWithProcessor())} />);

    expect(screen.getByText(PROCESSOR)).toBeInTheDocument();
    expect(cell("处理器")).toHaveAttribute("data-state", "value");

    expect(screen.queryAllByTestId("skeleton")).toHaveLength(0);
    expect(screen.getAllByText("未知")).toHaveLength(11);
    expect(cell("电池")).toHaveAttribute("data-state", "unknown");
  });

  it("renders one line per value in a multi-value field", () => {
    // 多值行（issue #5）：两条值就是两行，不多不少。
    const state = closeStream(
      applyFieldUpdate(initialStreamState, {
        field: "gpu",
        values: [
          { kind: "value", text: "Intel(R) UHD Graphics 620" },
          { kind: "value", text: "NVIDIA GeForce MX250" },
        ],
      }),
    );
    render(<HardwareOverview state={state} />);

    const values = cell("显卡").querySelector(".blueprint-value");
    expect(values?.children).toHaveLength(2);
    expect(screen.getByText("Intel(R) UHD Graphics 620")).toBeInTheDocument();
    expect(screen.getByText("NVIDIA GeForce MX250")).toBeInTheDocument();
  });
});
