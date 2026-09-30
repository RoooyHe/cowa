-- cowa 第二屏的数据：`build_plans` 表 + RLS（issue #18 / ADR-0008 / ADR-0010）
--
-- 在 Supabase Dashboard → SQL Editor 里**整段执行一次**即可。
-- 管理员此后的增删改都只活在 Supabase Studio 里，cowa 只读（ADR-0008）。
--
-- 客户端（publishable key，落到 `anon` 角色）只有 SELECT，且 RLS 只放行
-- `published = true` 的行——草稿挡在服务端，客户端看不见。

create table if not exists public.build_plans (
  id          uuid primary key default gen_random_uuid(),
  sort        int     not null default 0,          -- 管理员排序，cowa 按它升序取
  published   boolean not null default false,      -- 只有 true 的行对 anon 可见
  name        text    not null,
  intro       text    not null default '',
  tier        text    not null default '',
  ref_price   numeric,                             -- 可空：`参考价` 是编辑内容，照抄不换算
  -- 固定九格，均可空；空分类在屏上不出现（ADR-0010）
  cpu         text,
  mainboard   text,
  memory      text,
  gpu         text,
  disk        text,
  psu         text,
  case        text,
  cooling     text,
  accessory   text
);

-- 只读：RLS 打开，只放行已发布的方案。
alter table public.build_plans enable row level security;

drop policy if exists "build_plans readable when published" on public.build_plans;
create policy "build_plans readable when published"
  on public.build_plans
  for select
  to anon, authenticated
  using (published = true);

-- 权限面也锁死：只给 SELECT，不给写（RLS 之外再加一层）。
grant select on public.build_plans to anon, authenticated;
revoke insert, update, delete on public.build_plans from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 下列是**示例数据**，只为让第二屏非空 / 集成测试有东西可断言。
-- 真实方案由管理员在 Supabase Studio 里维护，可随时删掉这几行替换掉。
-- ---------------------------------------------------------------------------
insert into public.build_plans
  (sort, published, name, intro, tier, ref_price,
   cpu, mainboard, memory, gpu, disk, psu, case, cooling, accessory)
values
  (10, true, '入门办公', '够用就好，安静省电。', '入门', 3200,
   'Intel Core i5-12400', 'B660M', '16GB DDR4 3200', null,
   '1TB NVMe', '550W 金牌', 'M-ATX 中塔', '原装风冷', null),
  (20, true, '主流游戏', '2K 高刷，三年不换。', '主流', 9800,
   'AMD Ryzen 7 7800X3D', 'B650', '32GB DDR5 6000', 'RTX 4070 Super',
   '2TB NVMe', '750W 金牌', '中塔', '双塔风冷', '定制线'),
  -- 草稿：用来验证 RLS 真的把没发布的行挡在服务端。
  (30, false, '草稿·不该被看到', '没发布的方案不该出现在 cowa 里。', '草稿', 1,
   null, null, null, null, null, null, null, null, null);
