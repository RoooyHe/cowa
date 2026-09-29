import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { cell, fieldCell } from "../test/blueprint";
import type { FieldUpdate } from "./contract";
import { translateEnum } from "./enums";
import { HardwareOverview } from "./HardwareOverview";
import { applyFieldUpdate, closeStream, initialStreamState } from "./stream";

// 把一条 FieldUpdate 喂进关闭的流里——其余格子渲染成 `未知`，正好证明
// 枚举是被翻出来的，不是被别的值盖住的。
function renderField(update: FieldUpdate) {
  render(<HardwareOverview state={closeStream(applyFieldUpdate(initialStreamState, update))} />);
}

function modelWithSystemType(code: number): FieldUpdate {
  return {
    field: "model",
    values: [{ kind: "parts", parts: [{ kind: "enum", table: "systemType", code }] }],
  };
}

describe("枚举翻译（issue #4）", () => {
  it("SMBIOSMemoryType 26 渲染成 DDR4，而不是 26", () => {
    // 26 是采集器原样吐出的 WMI 值；屏上必须出现 DDR4。
    renderField({
      field: "memory",
      values: [
        {
          kind: "parts",
          parts: [
            { kind: "text", text: "Samsung 16GB " },
            { kind: "enum", table: "memoryType", code: 26 },
            { kind: "text", text: " 2400MHz（8GB + 8GB）" },
          ],
        },
      ],
    });

    const memory = cell("内存");
    expect(within(memory).getByText("DDR4")).toBeInTheDocument();
    expect(memory).not.toHaveTextContent("26");
  });

  it("PCSystemType 2 渲染成 笔记本", () => {
    renderField(modelWithSystemType(2));
    expect(within(fieldCell("model")).getByText("笔记本")).toBeInTheDocument();
  });

  it("PCSystemType 1 渲染成 台式机", () => {
    renderField(modelWithSystemType(1));
    expect(within(fieldCell("model")).getByText("台式机")).toBeInTheDocument();
  });

  it("查不到的枚举写 未知，绝不写裸数值", () => {
    renderField({ field: "memory", values: [{ kind: "parts", parts: [{ kind: "enum", table: "memoryType", code: 9999 }] }] });

    const memory = cell("内存");
    expect(within(memory).getByText("未知")).toBeInTheDocument();
    expect(memory).not.toHaveTextContent("9999");
  });

  it("表本身锁住两条规矩：26 → DDR4，2 → 笔记本", () => {
    expect(translateEnum("memoryType", 26)).toBe("DDR4");
    expect(translateEnum("systemType", 2)).toBe("笔记本");
    expect(translateEnum("systemType", 1)).toBe("台式机");
  });
});
