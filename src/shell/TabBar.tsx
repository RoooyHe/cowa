import { SCREENS, type ScreenId } from "./screens";

type TabBarProps = {
  active: ScreenId;
  onSelect: (screen: ScreenId) => void;
};

// `应用外壳` 里那条底部悬浮、用于在 `屏幕` 之间切换的横条。
// 它是全应用**唯一**允许有可点元素的地方（ADR-0007）——只有这两个标签。
export function TabBar({ active, onSelect }: TabBarProps) {
  return (
    <nav className="tab-bar" aria-label="屏幕切换">
      {SCREENS.map((screen) => (
        <button
          key={screen.id}
          type="button"
          className="tab"
          aria-current={screen.id === active ? "page" : undefined}
          onClick={() => onSelect(screen.id)}
        >
          <screen.Icon className="tab-icon" />
          {screen.label}
        </button>
      ))}
    </nav>
  );
}
