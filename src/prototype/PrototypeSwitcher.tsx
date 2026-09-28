// PROTOTYPE — 漂浮切换器。故意长得跟页面不像，免得被当成设计的一部分。
// 键盘 ← → 也能翻。生产构建里不渲染。
// PROTOTYPE

import { useEffect } from "react";

type Item = { key: string; name: string };

export function PrototypeBar({
  items,
  current,
  onSelect,
  tag,
}: {
  items: Item[];
  current: string;
  onSelect: (key: string) => void;
  tag: string;
}) {
  const i = Math.max(
    0,
    items.findIndex((x) => x.key === current),
  );

  const step = (d: number) => onSelect(items[(i + d + items.length) % items.length].key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowLeft") onSelect(items[(i - 1 + items.length) % items.length].key);
      if (e.key === "ArrowRight") onSelect(items[(i + 1) % items.length].key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, items, onSelect]);

  if (import.meta.env.PROD) return null;

  return (
    <div className="pt-pill">
      <button onClick={() => step(-1)} aria-label="上一个">
        ←
      </button>
      <span className="pt-label">
        {current} — {items[i].name}
      </span>
      <button onClick={() => step(1)} aria-label="下一个">
        →
      </button>
      <span className="pt-tag">{tag}</span>
    </div>
  );
}
