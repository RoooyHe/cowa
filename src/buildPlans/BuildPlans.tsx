import type { BuildPlan } from "./contract";

// 一条部件格是否该上屏。契约把「列缺失 / null」都归一成 null，但管理员也可能
// 敲进空串——空分类在屏上不出现（ADR-0010），两种都算没配。
// 注意：这是「显不显示」的判断，不是改值——真值照抄，不 trim、不校正。
function isFilled(value: string | null): boolean {
  return value !== null && value.trim() !== "";
}

// 一张文本卡：名称 / 档次 / `参考价`（可空）/ 一句介绍 / 部件清单。
// 卡片里**没有**任何可点元素——V2 没有收藏、复制、分享（ADR-0007 / ADR-0010）。
function PlanCard({ plan }: { plan: BuildPlan }) {
  const parts = plan.parts.filter((part) => isFilled(part.value));

  return (
    <li className="build-plan">
      <div className="plan-head">
        <h2 className="plan-name">{plan.name}</h2>
        <span className="plan-tier">{plan.tier}</span>
        {plan.ref_price != null && (
          <span className="plan-price">
            <span className="plan-price-label">参考价</span>
            <span className="plan-price-value">{plan.ref_price}</span>
          </span>
        )}
      </div>
      <p className="plan-intro">{plan.intro}</p>
      <dl className="plan-parts">
        {parts.map((part) => (
          <div className="plan-part" data-category={part.category} key={part.category}>
            <dt className="plan-part-label">{part.label}</dt>
            <dd className="plan-part-value">{part.value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

// `装机方案` 的内容：一列纵向滚动的文本卡。只收 `BuildPlan[]`——取数在
// `BuildPlansScreen`（issue #21），这里不触网；空数组就是空屏，无 `骨架`、
// 无错误文案（ADR-0009）。
export function BuildPlans({ plans }: { plans: readonly BuildPlan[] }) {
  return (
    <ul className="build-plans">
      {plans.map((plan, index) => (
        <PlanCard key={index} plan={plan} />
      ))}
    </ul>
  );
}
