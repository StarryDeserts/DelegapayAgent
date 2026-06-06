'use client'

export type SigningMode = 'server' | 'metamask'

export interface SigningModeToggleProps {
  mode: SigningMode
  disabled?: boolean
  onChange: (mode: SigningMode) => void
}

const OPTIONS: { value: SigningMode; label: string; hint: string }[] = [
  { value: 'server', label: 'Server key', hint: 'backend signer' },
  { value: 'metamask', label: 'MetaMask', hint: 'EIP-7715' },
]

/** Swaps which execute panel renders. Server-key is the default/fallback path. */
export function SigningModeToggle({ mode, disabled, onChange }: SigningModeToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Signing</span>
      <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
        {OPTIONS.map((opt) => {
          const active = opt.value === mode
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              disabled={disabled}
              aria-pressed={active}
              className={`flex items-baseline gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                active ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {opt.label}
              <span className={`font-mono text-[10px] font-normal ${active ? 'text-zinc-500' : 'text-zinc-600'}`}>
                {opt.hint}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
