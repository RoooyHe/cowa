// `标签栏` 的图标（issue #23）：内联 SVG，不用 Emoji。
//
// 一律 `stroke="currentColor"` / `fill="currentColor"` 上色——图标不写死颜色，
// 只继承所在标签的文字色。于是深浅两套完全由 `App.css` 的令牌 +
// `prefers-color-scheme` 决定，图标侧没有任何主题分支。
//
// 图标是装饰：文字标签已经说明了这一格是什么，所以恒为 `aria-hidden`，
// 不参与按钮的无障碍名字。尺寸由 `.tab-icon` 一处定（App.css），这里不写 width/height。

export type ScreenIconProps = { className?: string };

// `硬件概览`：一颗芯片——外框 + 核心 + 引脚。
export function HardwareIcon({ className }: ScreenIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
      <rect x="10" y="10" width="4" height="4" rx="0.5" />
      <path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21" />
    </svg>
  );
}

// `装机方案`：一份清单——三行条目。
export function BuildPlansIcon({ className }: ScreenIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="4.5" cy="6.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="17.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
