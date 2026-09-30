# 集成测试（真机 / 真项目）

跑在**当前这台机器**与**一个真 Supabase 项目**上，断言与机型 / 项目内容无关的行为。

**不进 CI。** 标记就是路径：默认 `vitest run` 只收 `src/**`，这里在 `integration/**`；
默认的 `vitest.config.ts` 里根本没有它。

## 怎么跑

```sh
bun run test:integration              # 两组都跑；装机方案一组没配凭据则跳过
bun run test:integration:supabase     # 只跑装机方案一组，且**要求**配好凭据（缺则报错）
```

`test:integration` 等价于 `vitest run --config vitest.integration.config.ts`。两组：

| 组 | 断言对象 | 前置 |
| --- | --- | --- |
| 采集器（issue #8） | 本机采集脚本 `src-tauri/src/collect.ps1` | **Windows** + PowerShell（优先 `pwsh`，退回 `powershell` 5.1） |
| 装机方案（issue #23） | 真 Supabase 项目的 `build_plans` 表 | `.env.local` 里的 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` |

### 装机方案一组

配置方式：把 `.env.example` 复制成 `.env.local` 并填入测试项目的 URL 与
**publishable key**（`sb_publishable_...`，即新版「anon key」；不要填 `sb_secret_...`）。
这一组需要项目里**至少有一条 `published = true` 的方案**——否则「只回 published」
「按 sort 排序」会空洞通过，测试会直接报红提醒。

两种跑法：

- `bun run test:integration`——读 `.env.local`（与开发时同一套 Vite 加载顺序）。
  没配好时这一组**跳过**（采集器那组照跑），并在控制台留一行提示：

  ```
  [装机方案集成] 未配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY——跳过真项目一组。
  ```

- `bun run test:integration:supabase`——只跑这一组，且把「没配好凭据」从跳过
  升级为**报错**（避免静默跳过的假绿）。

「连不上即空」那条**不需要凭据**，永远跑：它连一个不可达地址，断言返回空且不抛。

## 采集器断言什么（issue #8）

缝（seam）是采集脚本 `src-tauri/src/collect.ps1` 的 stdout——一行一个 `FieldUpdate` 的
JSONL。Rust 侧 `run_collection` 消费的是同一条流（ADR-0004），所以这里测的是真东西。

- **三张卡 + 九行全在**：恰好 12 个 `FieldId`，不重不漏
- **每个值要么是值要么是 `未知`**：没有「骨架」这第三种形态
- **枚举以结构到达**：内存 / 型号带 enum 段，采集侧只吐原始 code（翻是 UI 的活，ADR-0006）
- **只列物理设备的过滤真生效**：网卡条数 < `Win32_PnPEntity` 里 `Net` 实例总数
- **一个 CIM 类失败不拖垮其余字段**：把处理器的类换成不存在的类，断言它降级为 `未知`、
  脚本仍以 0 退出、其余字段状态不变

## 装机方案断言什么（issue #23）

缝是 `src/buildPlans/fetch.ts` 的 `fetchBuildPlans`（生产取数路径）与真项目的 REST 响应。

- **anon 只看得见 `published` 行**：结果里没有草稿（RLS 在服务端生效）
- **草稿列不可见**：`?published=eq.false` 一行都不回
- **按 `sort` 升序**：返回行的 `sort` 单调不减（允许并列）
- **生产路径与真响应一致**：映射的是同一批行（名字的多重集相等），且每案九格
- **错 anon key → 空，不抛**
- **连不上（断网 / 地址不可达）→ 空，不抛到 UI**

## 不做什么

- **不**断言「这台机器内存恰好是 Samsung」这类机器相关的值——那是在测这台机器，不是测采集器
- **不**断言任何具体方案名 / 条数 / 价格——那是项目内容，不是装机方案取数的行为
- **不**进 CI：CI 读的是 `fixtures/` 夹具，不是真机 / 真项目
