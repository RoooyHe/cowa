import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FIXED_LABELS, cell } from "../test/blueprint";
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
    render(<HardwareOverview state={stateWithProcessor()} />);

    for (const label of FIXED_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

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
});
