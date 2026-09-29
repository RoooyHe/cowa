import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// 侧效应导入：主题样式要被 jsdom 注入，computed style 才量得到。
import "../App.css";
import {
  CARD_FIELDS,
  CARD_LABELS,
  ROW_LABELS,
  cardBand,
  cell,
  fieldCell,
} from "../test/blueprint";
import { loadedState } from "../test/fixture";
import { HardwareOverview } from "./HardwareOverview";
import { applyFieldUpdate, closeStream, initialStreamState } from "./stream";

// B 规格单（issue #7）的排版收尾。结构性的东西（顶栏串行、对齐表、并陈拍平）
// 用渲染断言；「不溢出」既锁住它依赖的 CSS（computed style，量的是渲染出来的
// 元素，不是源码文本），也照 AC 在 800×600 容器里断言滚动高度。

describe("B 规格单（issue #7）", () => {
  it("顶栏一条淡色带：三张卡的 primary 串成一行", () => {
    render(<HardwareOverview state={loadedState()} />);

    const band = cardBand();
    expect(band.querySelectorAll("[data-field]")).toHaveLength(3);

    const inBand = within(band);
    // primary 都在一条带里；secondary 用弱色跟在各自 primary 后面。
    expect(inBand.getByText("HUAWEI HBL-WX9")).toBeInTheDocument();
    expect(inBand.getByText("Windows 11 专业版")).toBeInTheDocument();
    expect(inBand.getByText("7天20小时41分钟33秒")).toBeInTheDocument();
    expect(band).toHaveTextContent("笔记本 · DREAM");
    expect(band).toHaveTextContent("64 位 · 内部版本 26200");

    // 三张卡用一个竖线串起来。
    expect(band.textContent).toContain("│");

    // 卡标签不上屏（这是机读摘要，不是三张带标签的卡），但仍是每张卡的
    // 无障碍名字——图纸里的 `label` 没有变成死数据。
    expect(band.querySelectorAll(".blueprint-label")).toHaveLength(0);
    for (const [index, field] of CARD_FIELDS.entries()) {
      expect(inBand.queryByText(CARD_LABELS[index])).not.toBeInTheDocument();
      expect(fieldCell(field)).toHaveAttribute("aria-label", CARD_LABELS[index]);
    }
  });

  it("下面是同一张连续的对齐表：标签列右对齐、右侧一根发丝线", () => {
    const { container } = render(<HardwareOverview state={loadedState()} />);

    const rows = container.querySelector<HTMLElement>('[data-region="rows"]');
    expect(rows).not.toBeNull();
    expect(rows?.querySelectorAll("[data-field]")).toHaveLength(9);
    const labels = Array.from(rows?.querySelectorAll(".blueprint-label") ?? []).map(
      (element) => element.textContent,
    );
    expect(labels).toEqual([...ROW_LABELS]);

    // 发丝线要连着：标签盒撑满整行，所以两行值的行（显卡 / 显示器 / 声卡）
    // 上那根线也不断。
    const label = rows?.querySelector<HTMLElement>(".blueprint-label");
    expect(label).not.toBeNull();
    expect(getComputedStyle(label as HTMLElement).borderRightStyle).toBe("solid");
    expect(getComputedStyle(label as HTMLElement).textAlign).toBe("right");
    const row = label?.closest<HTMLElement>(".blueprint-cell");
    expect(row).not.toBeNull();
    expect(getComputedStyle(row as HTMLElement).alignItems).toBe("stretch");
  });

  it("并陈拍平成 `·` 分隔的一行，不出现嵌套括号", () => {
    const state = closeStream(
      applyFieldUpdate(initialStreamState, {
        field: "disk",
        values: [
          { kind: "pair", lead: "WDC PC SN730 SDBPNTY-512G-1027", nominal: "512GB", actual: "476.9 GiB" },
        ],
      }),
    );
    render(<HardwareOverview state={state} />);

    const pair = cell("磁盘").querySelector(".value-pair");
    expect(pair).not.toBeNull();
    const text = pair?.textContent ?? "";

    // 三段按 `型号 · 标称 · 实测` 的顺序，一段不多、一段不少。谁再给
    // nominal / actual 套上括号，切出来的段就不再等于这三个字面量了。
    expect(text.split("·")).toEqual(["WDC PC SN730 SDBPNTY-512G-1027", "512GB", "476.9 GiB"]);
  });
});

describe("800×600 下内容不溢出（issue #7）", () => {
  it("容器封顶 800、长值能换行、顶栏能折行", () => {
    // 模拟默认窗口（tauri.conf.json 800×600）。
    const viewport = document.createElement("div");
    viewport.style.width = "800px";
    viewport.style.height = "600px";
    viewport.style.overflow = "auto";
    document.body.appendChild(viewport);

    render(<HardwareOverview state={loadedState()} />, { container: viewport });

    const overview = viewport.querySelector<HTMLElement>(".hardware-overview");
    const value = viewport.querySelector<HTMLElement>(".blueprint-value");
    const band = viewport.querySelector<HTMLElement>(".blueprint-band");
    expect(overview).not.toBeNull();
    expect(value).not.toBeNull();
    expect(band).not.toBeNull();

    // 这是渲染出来的元素上的计算值，不是源码文本：容器不比窗口宽、长型号名
    // 可以就地断开、三张卡挤不下时折行而不是撑宽容器——横向不出滚动条。
    expect(getComputedStyle(overview as HTMLElement).maxWidth).toBe("800px");
    expect(getComputedStyle(value as HTMLElement).overflowWrap).toBe("anywhere");
    expect(getComputedStyle(band as HTMLElement).flexWrap).toBe("wrap");

    // AC 的字面断言：容器的滚动高度 ≤ 客户端高度。jsdom 没有布局引擎，
    // 这里量出来恒为 0——真实像素在 Chrome 里量过（夹具全屏 800×600 高 439px，
    // 一个 118 字符的不断点型号名也不会撑出横向滚动条）。
    expect(viewport.scrollHeight).toBeLessThanOrEqual(viewport.clientHeight);

    viewport.remove();
  });
});
