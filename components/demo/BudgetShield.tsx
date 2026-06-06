import { BoundedBudgetField } from '@/components/landing/BoundedBudgetField'
import { BudgetMeter } from '@/components/mission/BudgetMeter'

export interface BudgetShieldProps {
  budgetUsdc: string
  committedUsdc: number
  premiumUnlocked: boolean
}

export function BudgetShield({ budgetUsdc, committedUsdc, premiumUnlocked }: BudgetShieldProps) {
  return (
    <section className="rounded-[1.75rem] border border-emerald-300/15 bg-[#03100d] p-4 shadow-[0_0_55px_rgba(16,185,129,0.08)]">
      <BoundedBudgetField
        compact
        budgetUsdc={budgetUsdc}
        committedUsdc={committedUsdc}
        premiumUnlocked={premiumUnlocked}
      />
      <div className="mt-4">
        <BudgetMeter budgetUsdc={budgetUsdc} spentUsdc={committedUsdc.toFixed(2)} />
      </div>
    </section>
  )
}
