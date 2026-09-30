# 装机方案内容存 Supabase，客户端只读直连

第二屏的「精选装机方案」内容不在 cowa 里产生，由远端管理员在 Supabase 里维护。cowa 客户端**直连** Supabase（前端内嵌 anon key + RLS），只允许 `SELECT`，且只放行标记为已发布的行（`published = true`，草稿对客户端不可见）。没有自建后端、没有代理。

**为什么直连。** 这些方案本来就是要展示给每一个装机用户的，等于公开数据——不因为有代理而变得更保密。因此 anon key 能被从安装包里抠出来**不是问题**：它只给读，RLS 已经把草稿挡在外面。

**补充（2026-09）：key 从 `anon` 改称 publishable。** Supabase 把客户端低权限 key 从 legacy 的 `anon` JWT 换成 **publishable key**（`sb_publishable_...`），语义不变（可公开、只给读）。本项目变量名仍叫 `VITE_SUPABASE_ANON_KEY`，填 publishable key。它与 JWT 不同：请求只带 `apikey` 头，**不得**放进 `Authorization: Bearer`，否则 PostgREST 会当坏 JWT 拒掉（PGRST301），第二屏永远空。secret key（`sb_secret_...`）绕过 RLS，绝不进客户端。

## Considered Options

- **自建代理服务**：否决——多一个要部署、要维护、要付钱的服务；内容本就公开，代理只增成本不增保密。若将来内容变成不该公开（例如含未公开价格），这条要重开。

## Consequences

- 锁死 Supabase：换掉要同时动客户端与数据。
- cowa 从此有一个网络依赖，但它**只影响第二屏**（`ADR-0009`）；`硬件概览` 照旧不联网。
- cowa 里**不存在**「管理员」这个角色。管理员只活在 Supabase Studio 里，cowa 只知道「已发布的方案」——领域模型不为一个不进入应用的人建 Actor。
