# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## 环境变量

第二屏的 `精选装机方案` 在启动时直连 Supabase 取一次（`ADR-0008` / `ADR-0009`）。
本地开发把 `.env.example` 复制成 `.env.local` 并填入项目值：

- `VITE_SUPABASE_URL`——Supabase 项目 URL
- `VITE_SUPABASE_ANON_KEY`——anon key（只读；草稿由服务端 RLS 挡住）

两项都缺时第二屏为空，不报错、不影响 `硬件概览`。

## 测试

```sh
bun run test                        # 单测 / 组件测试（CI 跑这个；只收 src/**）
bun run test:integration            # 真机采集 + 真 Supabase 项目（不进 CI，见 integration/README.md）
bun run test:integration:supabase   # 只跑真项目那组，且要求配好凭据（缺则报错）
```

`test:integration` 里的装机方案一组复用上面同一份 `.env.local`；没配好时会跳过，
「断网 / 错 key 即空」那条仍会跑。想确保真项目那组真的跑了，就用
`test:integration:supabase`（缺凭据直接报错）。

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
