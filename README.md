# cowa

Windows 桌面应用（Tauri 2 + React 19 + TypeScript）：一屏看**当前这台机器**的硬件
（`硬件概览`），一屏看远端维护的**精选装机方案**（`装机方案`），由底部悬浮的
`标签栏` 切换。领域模型见 `CONTEXT.md`，决策见 `docs/adr/`。

只支持 **Windows x64**。

## 环境变量

第二屏的 `精选装机方案` 在启动时直连 Supabase 取一次（`ADR-0008` / `ADR-0009`）。
本地开发把 `.env.example` 复制成 `.env.local` 并填入项目值：

- `VITE_SUPABASE_URL`——Supabase 项目 URL（`https://<project-ref>.supabase.co`）
- `VITE_SUPABASE_ANON_KEY`——**publishable key**（`sb_publishable_...`），即 Supabase 新版的
  「anon key」。**不要**填 secret key（`sb_secret_...`）——它绕过 RLS，只能留在服务端。

publishable key 不是 JWT：请求只走 `apikey` 头，不走 `Authorization: Bearer`
（带上会被 PostgREST 当坏 JWT 拒掉）。两项都缺时第二屏为空，不报错、不影响 `硬件概览`。

打包时这两项要注入（Vite `VITE_*`），否则安装出来的第二屏为空：

```sh
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=sb_publishable_... bun run tauri build
```

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
