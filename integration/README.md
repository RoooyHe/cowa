# 采集器的真机集成测试（issue #8）

跑在**当前这台 Windows 机器**上，断言采集器**机器无关**的行为。

**不进 CI。** 标记就是路径：默认 `vitest run` 只收 `src/**`，这里在 `integration/**`；
默认的 `vitest.config.ts` 里根本没有它。

## 怎么跑

```sh
bun run test:integration
```

等价于 `vitest run --config vitest.integration.config.ts`。需要一台 **Windows** 机器 +
PowerShell（优先 `pwsh`，退回 `powershell` 5.1）。约 15 秒（采集两趟 + 一次 `Net` 实例统计）。

## 断言什么

缝（seam）是采集脚本 `src-tauri/src/collect.ps1` 的 stdout——一行一个 `FieldUpdate` 的
JSONL。Rust 侧 `run_collection` 消费的是同一条流（ADR-0004），所以这里测的是真东西。

- **三张卡 + 九行全在**：恰好 12 个 `FieldId`，不重不漏
- **每个值要么是值要么是 `未知`**：没有「骨架」这第三种形态
- **枚举以结构到达**：内存 / 型号带 enum 段，采集侧只吐原始 code（翻是 UI 的活，ADR-0006）
- **只列物理设备的过滤真生效**：网卡条数 < `Win32_PnPEntity` 里 `Net` 实例总数
- **一个 CIM 类失败不拖垮其余字段**：把处理器的类换成不存在的类，断言它降级为 `未知`、
  脚本仍以 0 退出、其余字段状态不变

## 不做什么

- **不**断言「这台机器内存恰好是 Samsung」这类机器相关的值——那是在测这台机器，不是测采集器
- **不**进 CI：CI 读的是 `fixtures/field-updates.jsonl` 夹具，不是真机
