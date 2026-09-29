// 采集器的真机集成测试（issue #8）。
//
// 这一份**不进 CI**（默认 `vitest run` 只收 `src/**`，这里在 `integration/**`），
// 跑在**当前这台 Windows 机器**上：
//
//   bun run test:integration
//
// 断言的全是**机器无关**的行为——「三张卡 + 九行都在」「每个格子要么是值要么是
// `未知`」「只列物理设备的过滤真的过滤掉了东西」「一个 CIM 类失败不拖垮其余字段」。
// **不**断言「这台机器内存恰好是 Samsung」这类只有某台机器才成立的值。
//
// 缝（seam）是采集脚本的 stdout：一行一个 `FieldUpdate` 的 JSONL。Rust 侧
// `run_collection` 消费的是同一条流（ADR-0004），所以这里测的就是真东西——脚本
// 一旦吐出契约外的字段或形态，这里就红。

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { FieldId, FieldUpdate, SnapshotValue, ValuePart } from "../src/hardware/contract";
import { applyFieldUpdate, initialStreamState, resolveField } from "../src/hardware/stream";

// 固定图纸：三张卡 + 九行，共 12 个字段。**故意把这 12 个名字硬编码**——图纸的固定性
// 正是被测对象；从 CARDS/ROWS 推导的话，图纸少一行测试会跟着一起少，测不出「图纸缩水」。
const EXPECTED_FIELDS: readonly FieldId[] = [
  "model",
  "system",
  "uptime",
  "processor",
  "mainboard",
  "memory",
  "gpu",
  "display",
  "disk",
  "sound",
  "network",
  "battery",
];

const SCRIPT = readFileSync(new URL("../src-tauri/src/collect.ps1", import.meta.url), "utf8");

// 采集一次约 5 秒，模拟失败会再采一次。别让 shell 无限挂住。
const SHELL_TIMEOUT_MS = 120_000;

type ShellRun = { stdout: string; stderr: string; status: number | null };
type CollectorRun = ShellRun & { updates: FieldUpdate[] };

// 优先 `pwsh`，退回 `powershell` 5.1——与 Rust 侧 `spawn_shell` 同一策略（ADR-0004）。
function runPowerShell(script: string): ShellRun {
  const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script];
  let missing: unknown;
  for (const shell of ["pwsh", "powershell"]) {
    const result = spawnSync(shell, args, {
      encoding: "utf8",
      timeout: SHELL_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const code = (result.error as { code?: string } | undefined)?.code;
    if (code === "ENOENT") {
      missing = result.error; // 这个 shell 不存在，试下一个
      continue;
    }
    if (result.error) throw result.error; // 超时 / 被杀，不吞
    return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", status: result.status };
  }
  throw new Error(`找不到 pwsh 或 powershell：${String(missing)}`);
}

function runCollector(script: string): CollectorRun {
  const run = runPowerShell(script);
  return { ...run, updates: parseUpdates(run.stdout) };
}

function parseUpdates(stdout: string): FieldUpdate[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch (error) {
        throw new Error(`采集器吐出了非 JSON 的行：${line}\n${String(error)}`);
      }
      assertFieldUpdate(parsed, line);
      return parsed;
    });
}

// 一次采集约 5 秒：所有断言共用同一份输出，别每个 test 各采一遍。
let cachedBaseline: CollectorRun | undefined;
function baseline(): CollectorRun {
  cachedBaseline ??= runCollector(SCRIPT);
  return cachedBaseline;
}

function fieldOf(run: CollectorRun, field: FieldId): FieldUpdate {
  const matches = run.updates.filter((update) => update.field === field);
  if (matches.length !== 1) {
    throw new Error(`字段 ${field} 出现了 ${matches.length} 次，应当恰好 1 次`);
  }
  return matches[0];
}

// 采集要跑干净：以 0 退出，且恰好吐出固定图纸上的 12 个字段，不多不少不重。
function expectCleanRun(run: CollectorRun): void {
  expect(run.status, `采集脚本非零退出：${run.stderr}`).toBe(0);
  const fields = run.updates.map((update) => update.field);
  expect(new Set(fields).size, `有字段重复出现：${fields.join(", ")}`).toBe(fields.length);
  expect([...fields].sort(), "字段集合与固定图纸不一致").toEqual([...EXPECTED_FIELDS].sort());
}

// 数设备树里 `Net` 实例的**总数**。刻意不复用采集器的过滤逻辑：复用就成了重言
// （用同一份逻辑验证自己）。只有「过滤后 < 全部」才证明只列物理设备的过滤真起到了作用。
const NET_TOTAL_SCRIPT = String.raw`
$scope = New-Object System.Management.ManagementScope('root\cimv2')
$scope.Connect()
$searcher = New-Object System.Management.ManagementObjectSearcher($scope, 'SELECT PNPClass FROM Win32_PnPEntity')
@($searcher.Get() | Where-Object { $_.PNPClass -eq 'Net' }).Count
`;

function countNetInstances(): number {
  const run = runPowerShell(NET_TOTAL_SCRIPT);
  if (run.status !== 0) throw new Error(`统计 Win32_PnPEntity 的 Net 实例失败：${run.stderr}`);
  const total = Number(run.stdout.trim());
  if (!Number.isInteger(total) || total < 0) {
    throw new Error(`Net 实例总数不是非负整数：${JSON.stringify(run.stdout)}`);
  }
  return total;
}

function assertFieldUpdate(value: unknown, where: string): asserts value is FieldUpdate {
  if (typeof value !== "object" || value === null) throw new Error(`${where}: 不是对象`);
  const field = (value as { field?: unknown }).field;
  if (typeof field !== "string" || !EXPECTED_FIELDS.includes(field as FieldId)) {
    throw new Error(`${where}: 契约外的 FieldId：${JSON.stringify(field)}`);
  }
  const values = (value as { values?: unknown }).values;
  if (!Array.isArray(values)) throw new Error(`${where}: values 不是数组`);
  if (values.length === 0) {
    throw new Error(`${where}: values 为空——这是 UI 侧的「骨架」形态，采集器不该吐`);
  }
  values.forEach((entry, index) => assertSnapshotValue(entry, `${where} values[${index}]`));
}

function assertSnapshotValue(value: unknown, where: string): asserts value is SnapshotValue {
  if (typeof value !== "object" || value === null) throw new Error(`${where}: 不是对象`);
  const kind = (value as { kind?: unknown }).kind;
  switch (kind) {
    case "value": {
      const text = (value as { text?: unknown }).text;
      if (typeof text !== "string" || text.trim() === "") {
        throw new Error(`${where}: value.text 必须是非空字符串`);
      }
      return;
    }
    case "parts": {
      const parts = (value as { parts?: unknown }).parts;
      if (!Array.isArray(parts) || parts.length === 0) {
        throw new Error(`${where}: parts 必须是非空数组`);
      }
      parts.forEach((part, index) => assertValuePart(part, `${where}.parts[${index}]`));
      return;
    }
    case "pair": {
      const { lead, nominal, actual } = value as { lead?: unknown; nominal?: unknown; actual?: unknown };
      for (const [name, text] of [["lead", lead], ["nominal", nominal], ["actual", actual]] as const) {
        if (typeof text !== "string" || text.trim() === "") {
          throw new Error(`${where}: pair.${name} 必须是非空字符串`);
        }
      }
      return;
    }
    case "unknown":
      return;
    default:
      throw new Error(
        `${where}: 第三种形态的 kind=${JSON.stringify(kind)}——契约里只有 value / parts / pair / unknown`,
      );
  }
}

function assertValuePart(part: unknown, where: string): asserts part is ValuePart {
  if (typeof part !== "object" || part === null) throw new Error(`${where}: 不是对象`);
  const kind = (part as { kind?: unknown }).kind;
  if (kind === "text") {
    if (typeof (part as { text?: unknown }).text !== "string") {
      throw new Error(`${where}: text 不是字符串`);
    }
    return;
  }
  if (kind === "enum") {
    const table = (part as { table?: unknown }).table;
    const code = (part as { code?: unknown }).code;
    if (table !== "memoryType" && table !== "systemType") {
      throw new Error(`${where}: 契约外的枚举表：${JSON.stringify(table)}`);
    }
    if (typeof code !== "number" || !Number.isInteger(code)) {
      throw new Error(`${where}: enum.code 不是整数：${JSON.stringify(code)}`);
    }
    return;
  }
  throw new Error(`${where}: 契约外的 ValuePart kind=${JSON.stringify(kind)}`);
}

function enumParts(update: FieldUpdate): Array<Extract<ValuePart, { kind: "enum" }>> {
  return update.values
    .flatMap((value) => (value.kind === "parts" ? value.parts : []))
    .filter((part): part is Extract<ValuePart, { kind: "enum" }> => part.kind === "enum");
}

describe("采集器真机集成（issue #8）", () => {
  it("真机跑一次采集：三张卡 + 九行全在，不多不少", () => {
    expectCleanRun(baseline());
  });

  it("每个格子要么是值要么是 未知：没有骨架这第三种形态", () => {
    const run = baseline();
    const stream = run.updates.reduce(applyFieldUpdate, initialStreamState);
    // 流**故意不关**：缺字段在 UI 侧就是骨架——这正是要被排除的第三种形态。
    for (const field of EXPECTED_FIELDS) {
      const { state } = resolveField(stream, field);
      expect(state, `${field} 落在骨架上——采集器没吐这一行`).not.toBe("skeleton");
      expect(["value", "unknown"], `${field} 是 ${state}`).toContain(state);
    }
  });

  it("枚举以结构到达、采集侧不预先翻译（机器无关）", () => {
    const run = baseline();

    // 内存 / 型号只要有值，就必须带 enum 段——采集侧只吐原始 code，翻是 UI 的活（ADR-0006）。
    for (const [field, table] of [
      ["memory", "memoryType"],
      ["model", "systemType"],
    ] as const) {
      const update = fieldOf(run, field);
      if (resolveField(run.updates.reduce(applyFieldUpdate, initialStreamState), field).state === "unknown") {
        continue;
      }
      expect(
        enumParts(update).some((part) => part.table === table),
        `${field} 没有带上 ${table} 枚举结构`,
      ).toBe(true);
    }
  });

  it("只列物理设备的过滤真生效：网卡条数 < Win32_PnPEntity 的 Net 实例总数", () => {
    const network = fieldOf(baseline(), "network");
    const reported = network.values.filter((value) => value.kind !== "unknown").length;
    const total = countNetInstances();

    // 先堵住空洞：网卡整格退化成 `未知` 时 reported = 0，不加这条 `0 < total` 恒真。
    expect(reported, "网卡一条物理设备都没报——过滤断言会空洞通过").toBeGreaterThan(0);
    // 不比具体数字（机器相关），只比「过滤后 < 过滤前的全部」。
    expect(
      reported,
      `网卡 ${reported} 条不小于设备树 Net 实例总数 ${total}——只列物理设备的过滤没过滤掉任何虚拟设备`,
    ).toBeLessThan(total);
  });

  it("模拟一个失败的 CIM 类：其余字段照常拿到，且不抛", () => {
    // 把处理器的 CIM 类换成一个不存在的类，制造一次查询失败。
    const broken = SCRIPT.replace(/'Win32_Processor'/g, "'Win32_CowaMissingClass'").replace(
      /"Win32_Processor"/g,
      '"Win32_CowaMissingClass"',
    );
    expect(broken, "脚本里找不到 Win32_Processor——替换失效，测试需要更新").not.toBe(SCRIPT);

    const run = runCollector(broken);
    expectCleanRun(run); // 不抛：以 0 退出，12 个字段一行不少

    // 失败的字段降级为 `未知`……
    expect(fieldOf(run, "processor").values).toEqual([{ kind: "unknown" }]);

    // ……其余字段的状态与正常采集时一致（没被拖垮）。
    const brokenStream = run.updates.reduce(applyFieldUpdate, initialStreamState);
    const baselineStream = baseline().updates.reduce(applyFieldUpdate, initialStreamState);
    for (const field of EXPECTED_FIELDS) {
      if (field === "processor") continue;
      expect(resolveField(brokenStream, field).state, `${field} 的状态被处理器的失败改变了`).toBe(
        resolveField(baselineStream, field).state,
      );
    }
  });
});
