/// <reference types="vite/client" />

// 装机方案取数走 Vite 环境变量（issue #21 / ADR-0008）。缺省即取不到——
// 屏上为空，不报错（ADR-0009）。
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
